-- Triggers genéricos (03 §5.3, §5.4; AF-06). Triggers de regra de negócio (transições de estado, RN-122 etc.)
-- ficam na migração da etapa do módulo que os usa (doc 07, Etapa 1 "Fora desta etapa").
--
-- ATENÇÃO para migrações futuras de dados (ex.: standard_text, doc 07 Etapas 4, 6 e 9): o trigger de auditoria
-- exige contexto. Faça `SELECT set_config('app.source', 'SISTEMA', true);` na mesma transação antes do INSERT.

-- [P] updated_at e row_version em todo UPDATE.
CREATE FUNCTION trg_set_row_meta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;

-- [I] imutável.
CREATE FUNCTION trg_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tabela % é imutável (somente inclusão)', TG_TABLE_NAME USING ERRCODE = '23000';
END $$;

-- EL-1: nenhuma exclusão física em tabela de negócio.
CREATE FUNCTION trg_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'exclusão física proibida em % (usar exclusão lógica)', TG_TABLE_NAME USING ERRCODE = '23000';
END $$;

-- visit_occurrence: [I] + colunas de remoção, as únicas atualizáveis (03 §2.8).
CREATE FUNCTION trg_visit_occurrence_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  strip text[] := ARRAY['removed_at', 'removed_by_user_id', 'removal_reason'];
BEGIN
  IF (to_jsonb(NEW) - strip) IS DISTINCT FROM (to_jsonb(OLD) - strip) THEN
    RAISE EXCEPTION 'visit_occurrence: só removed_at, removed_by_user_id e removal_reason podem mudar'
      USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;

-- audit_log: somente inclusão (RNF-06).
CREATE FUNCTION trg_audit_log_protect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente de inclusão (% negado)', TG_OP USING ERRCODE = '23000';
END $$;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION trg_audit_log_protect();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION trg_audit_log_protect();

-- Auditoria (03 §5.3). Contexto vem de set_config('app.*', ..., true) gravado por withTransaction (AF-05).
CREATE FUNCTION audit_mask(j jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text;
BEGIN
  IF j IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['encrypted_pkcs12', 'encrypted_password'] LOOP
    IF j ? k THEN j := jsonb_set(j, ARRAY[k], '"***"'); END IF;
  END LOOP;
  RETURN j;
END $$;

CREATE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_source  text := nullif(current_setting('app.source', true), '');
  v_action  text;
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_record  text;
BEGIN
  IF v_source IS NULL THEN
    RAISE EXCEPTION 'escrita sem contexto (app.source vazio): use withTransaction' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new := to_jsonb(NEW);
    v_record := v_new ->> 'id';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_record := v_old ->> 'id';
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record := v_new ->> 'id';
    SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM jsonb_each(v_new) n
    WHERE n.key NOT IN ('updated_at', 'updated_by_user_id', 'row_version')
      AND n.value IS DISTINCT FROM v_old -> n.key;
    -- UPDATE sem mudança real de coluna não gera linha (03 §5.3 item 4).
    IF v_changed IS NULL THEN RETURN NULL; END IF;
    v_action := CASE
      WHEN v_old ->> 'deleted_at' IS NULL AND v_new ->> 'deleted_at' IS NOT NULL THEN 'SOFT_DELETE'
      WHEN v_old ->> 'deleted_at' IS NOT NULL AND v_new ->> 'deleted_at' IS NULL THEN 'RESTORE'
      ELSE 'UPDATE' END;
    -- Só as colunas alteradas.
    SELECT jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k) INTO v_old, v_new
    FROM unnest(v_changed) k;
  END IF;

  INSERT INTO audit_log (actor_user_id, actor_role, source, action, table_name, record_id,
                         changed_fields, old_values, new_values, reason, request_id, ip_address)
  VALUES (nullif(current_setting('app.actor_user_id', true), '')::uuid,
          nullif(current_setting('app.actor_role', true), ''),
          v_source, v_action, TG_TABLE_NAME, v_record,
          v_changed, audit_mask(v_old), audit_mask(v_new),
          nullif(current_setting('app.reason', true), ''),
          nullif(current_setting('app.request_id', true), '')::uuid,
          nullif(current_setting('app.ip_address', true), '')::inet);
  RETURN NULL;
END $$;

-- client_id desnormalizado (AF-06): preenchido no INSERT a partir do documento de origem; imutável.
CREATE FUNCTION trg_fill_client_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_client uuid;
BEGIN
  IF TG_TABLE_NAME = 'pmoc_version' THEN
    SELECT s.client_id INTO v_client FROM pmoc p
      JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id WHERE p.id = NEW.pmoc_id;
  ELSIF TG_TABLE_NAME = 'visit' THEN
    SELECT s.client_id INTO v_client FROM site s WHERE s.id = NEW.site_id;
  ELSIF TG_TABLE_NAME = 'visit_report_version' THEN
    SELECT v.client_id INTO v_client FROM visit_report r JOIN visit v ON v.id = r.visit_id
      WHERE r.id = NEW.visit_report_id;
  ELSIF TG_TABLE_NAME = 'visit_receipt' THEN
    SELECT v.client_id INTO v_client FROM visit v WHERE v.id = NEW.visit_id;
  END IF;
  IF v_client IS NULL THEN
    RAISE EXCEPTION '% : cliente de origem não encontrado para client_id', TG_TABLE_NAME USING ERRCODE = '23503';
  END IF;
  NEW.client_id := v_client;
  RETURN NEW;
END $$;

CREATE FUNCTION trg_client_id_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION '%.client_id é imutável', TG_TABLE_NAME USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
  -- [I]: somente inclusão (03 Convenções, bloco [I]). security_event é "só de inclusão" (06 §3.3.3).
  immutable_tables text[] := ARRAY['pmoc_ficha_export', 'stored_file', 'document_signature',
    'document_follow_up_note', 'visit_schedule_change', 'standard_text', 'visit_receipt', 'security_event'];
  -- EL-1 e 03 §5.4: exceções à regra de não excluir.
  deletable_tables text[] := ARRAY['idempotency_key', 'equipment_tag_counter', 'rate_limit_counter',
    'auth_user', 'schema_migration', 'audit_log'];
  -- 03 §5.3: tabelas fora da auditoria por trigger.
  unaudited_tables text[] := ARRAY['audit_log', 'notification', 'idempotency_key', 'equipment_tag_counter',
    'security_event', 'job_run', 'device', 'rate_limit_counter', 'auth_user', 'schema_migration'];
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'row_version') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_row_meta()',
                     t || '_row_meta', t);
    END IF;
    IF t = ANY (immutable_tables) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_immutable()',
                     t || '_immutable', t);
    ELSIF NOT (t = ANY (deletable_tables)) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_no_delete()',
                     t || '_no_delete', t);
    END IF;
    IF NOT (t = ANY (unaudited_tables)) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
                     t || '_audit', t);
    END IF;
  END LOOP;
END $$;

CREATE TRIGGER visit_occurrence_update BEFORE UPDATE ON visit_occurrence
  FOR EACH ROW EXECUTE FUNCTION trg_visit_occurrence_update();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pmoc_version', 'visit', 'visit_report_version', 'visit_receipt'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_fill_client_id()',
                   t || '_fill_client_id', t);
    IF t <> 'visit_receipt' THEN  -- visit_receipt já é imutável por inteiro
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_client_id_immutable()',
                     t || '_client_id_immutable', t);
    END IF;
  END LOOP;
END $$;
