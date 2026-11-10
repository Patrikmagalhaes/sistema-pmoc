-- Permissões (03 §5.3 "Proteção"; 05 §4.2; 06 DSP-10). Princípio do menor privilégio para app_rw.
-- apply_app_grants() é idempotente: db/migrate.ts a executa ao fim de TODA execução, então tabelas criadas
-- em migrações futuras recebem as permissões certas sem precisar repetir GRANT em cada arquivo.
CREATE FUNCTION apply_app_grants() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t text;
  -- Só inclusão: os triggers já impedem UPDATE/DELETE; aqui o privilégio também não existe.
  insert_only text[] := ARRAY['audit_log', 'security_event', 'pmoc_ficha_export', 'stored_file',
    'document_signature', 'document_follow_up_note', 'visit_schedule_change', 'standard_text', 'visit_receipt'];
  -- Únicas tabelas em que a aplicação pode excluir (03 §5.4, EL-1).
  deletable text[] := ARRAY['idempotency_key', 'equipment_tag_counter', 'rate_limit_counter', 'auth_user'];
  -- Sem acesso da aplicação.
  internal text[] := ARRAY['schema_migration'];
BEGIN
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_rw;
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
    CONTINUE WHEN t = ANY (internal);
    IF t = ANY (insert_only) THEN
      EXECUTE format('GRANT SELECT, INSERT ON %I TO app_rw', t);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO app_rw', t);
    END IF;
    IF t = ANY (deletable) THEN
      EXECUTE format('GRANT DELETE ON %I TO app_rw', t);
    END IF;
  END LOOP;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_rw;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_ro;
  GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_ro;
END $$;

SELECT apply_app_grants();
