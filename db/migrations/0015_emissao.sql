-- Etapa 4 – emissão do PMOC (RN-009; FL-08 passo 11). Triggers de regra que a emissão passa a usar
-- (doc 07: entram na etapa do módulo que os usa).

-- Doc 02 §7.3: transições do PMOC. Sem mudança de estado, nada a conferir.
CREATE FUNCTION trg_pmoc_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
       (OLD.status = 'RASCUNHO' AND NEW.status = 'EMITIDO')                       -- RN-009
    OR (OLD.status = 'EMITIDO' AND NEW.status = 'ASSINADO_CLIENTE')               -- RN-124
    OR (OLD.status = 'ASSINADO_CLIENTE' AND NEW.status = 'EMITIDO')               -- RN-016
    OR (OLD.status IN ('RASCUNHO', 'EMITIDO', 'ASSINADO_CLIENTE') AND NEW.status = 'HISTORICO') -- RN-014
  ) THEN
    RAISE EXCEPTION 'transição de PMOC não permitida: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514', CONSTRAINT = 'pmoc_status_transition';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pmoc_status BEFORE UPDATE OF status ON pmoc
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_pmoc_status();

-- 03 §2.6 e §6.2: a versão emitida é imutável, exceto `status`, `is_current`, `client_signed_pdf_*` e
-- `superseded_at` (e as colunas de controle do bloco [P]; `client_id` tem trigger próprio). 03 §4.2:
-- `AGUARDANDO_ASSINATURA` -> `ASSINADO_CLIENTE` ou `SUBSTITUIDA`; `is_current` só de `true` para `false`.
CREATE FUNCTION trg_pmoc_version_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.pmoc_id, NEW.version_number, NEW.issue_reason, NEW.snapshot, NEW.snapshot_schema_version,
      NEW.pdf_file_id, NEW.pdf_sha256, NEW.rt_signature_method, NEW.rt_certificate_id,
      NEW.rt_signed_at, NEW.issued_at, NEW.issued_by_user_id, NEW.renderer_version,
      NEW.verification_code, NEW.created_at, NEW.created_by_user_id)
     IS DISTINCT FROM
     (OLD.pmoc_id, OLD.version_number, OLD.issue_reason, OLD.snapshot, OLD.snapshot_schema_version,
      OLD.pdf_file_id, OLD.pdf_sha256, OLD.rt_signature_method, OLD.rt_certificate_id,
      OLD.rt_signed_at, OLD.issued_at, OLD.issued_by_user_id, OLD.renderer_version,
      OLD.verification_code, OLD.created_at, OLD.created_by_user_id) THEN
    RAISE EXCEPTION 'versão emitida do PMOC é imutável (RNF-15)'
      USING ERRCODE = '23514', CONSTRAINT = 'pmoc_version_immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       OLD.status = 'AGUARDANDO_ASSINATURA' AND NEW.status IN ('ASSINADO_CLIENTE', 'SUBSTITUIDA')) THEN
    RAISE EXCEPTION 'transição de versão do PMOC não permitida: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514', CONSTRAINT = 'pmoc_version_status_transition';
  END IF;
  IF NEW.is_current AND NOT OLD.is_current THEN
    RAISE EXCEPTION 'versão substituída não volta a ser a atual'
      USING ERRCODE = '23514', CONSTRAINT = 'pmoc_version_current_transition';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pmoc_version_rules BEFORE UPDATE ON pmoc_version
  FOR EACH ROW EXECUTE FUNCTION trg_pmoc_version_rules();

-- 03 §2.7: a ocorrência é do PMOC da atividade, de equipamento do local do contrato e do mesmo tipo da
-- atividade, num mês 1..N do contrato (RN-023).
CREATE FUNCTION trg_occurrence_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT pa.pmoc_id = NEW.pmoc_id
         AND e.site_id = k.site_id
         AND e.equipment_type_id = pa.equipment_type_id
         AND NEW.month_index <= k.month_count
    INTO v_ok
    FROM pmoc_activity pa
    JOIN pmoc p ON p.id = pa.pmoc_id
    JOIN contract k ON k.id = p.contract_id
    JOIN equipment e ON e.id = NEW.equipment_id
   WHERE pa.id = NEW.pmoc_activity_id;
  IF v_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ocorrência fora do PMOC, do local, do tipo ou dos meses do contrato (03 §2.7)'
      USING ERRCODE = '23514', CONSTRAINT = 'occurrence_consistency';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER occurrence_consistency
  BEFORE INSERT OR UPDATE OF pmoc_id, pmoc_activity_id, equipment_id, month_index ON occurrence
  FOR EACH ROW EXECUTE FUNCTION trg_occurrence_consistency();

-- 03 §2.8: o local da visita é o do contrato do PMOC.
CREATE FUNCTION trg_visit_site() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pmoc p JOIN contract k ON k.id = p.contract_id
                  WHERE p.id = NEW.pmoc_id AND k.site_id = NEW.site_id) THEN
    RAISE EXCEPTION 'o local da visita é o do contrato do PMOC (03 §2.8)'
      USING ERRCODE = '23514', CONSTRAINT = 'visit_site_of_contract';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER visit_site BEFORE INSERT OR UPDATE OF pmoc_id, site_id ON visit
  FOR EACH ROW EXECUTE FUNCTION trg_visit_site();

-- 03 §2.8 (RN-064, D-06 a): a ocorrência é do PMOC da visita e do mês de referência dela, exceto a
-- `PENDENTE`, que pode ir para a visita de outro mês.
CREATE FUNCTION trg_visit_occurrence_month() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM visit v JOIN occurrence o ON o.id = NEW.occurrence_id
                  WHERE v.id = NEW.visit_id AND o.pmoc_id = v.pmoc_id
                    AND (o.month_index = v.reference_month_index OR o.status = 'PENDENTE')) THEN
    RAISE EXCEPTION 'ocorrência de outro PMOC ou de outro mês da visita (03 §2.8, RN-064)'
      USING ERRCODE = '23514', CONSTRAINT = 'visit_occurrence_month';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER visit_occurrence_month BEFORE INSERT ON visit_occurrence
  FOR EACH ROW EXECUTE FUNCTION trg_visit_occurrence_month();
