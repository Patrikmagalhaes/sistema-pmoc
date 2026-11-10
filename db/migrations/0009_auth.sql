-- Etapa 2 – tabelas do Better Auth 1.7.10 (03 §2.1, AF-04). Colunas conferidas no spike S-04 (05 §10.4).
-- Fora da auditoria e sem RLS (03 §2.1 regra 2): os triggers genéricos de 0006 só alcançam as tabelas que
-- já existiam; a trilha de acesso vai para security_event.

ALTER TABLE auth_user
  ADD COLUMN image              text,
  ADD COLUMN role               text,
  ADD COLUMN banned             boolean DEFAULT false,
  ADD COLUMN ban_reason         text,
  ADD COLUMN ban_expires        timestamptz,
  ADD COLUMN two_factor_enabled boolean DEFAULT false;

CREATE TABLE auth_session (
  id              text PRIMARY KEY,
  expires_at      timestamptz NOT NULL,
  token           text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  user_id         text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  impersonated_by text
);
CREATE INDEX auth_session_user_idx ON auth_session (user_id);

CREATE TABLE auth_account (
  id                       text PRIMARY KEY,
  account_id               text NOT NULL,
  provider_id              text NOT NULL,
  user_id                  text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  access_token             text,
  refresh_token            text,
  id_token                 text,
  access_token_expires_at  timestamptz,
  refresh_token_expires_at timestamptz,
  scope                    text,
  password                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_account_user_idx ON auth_account (user_id);

CREATE TABLE auth_verification (
  id         text PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verification_identifier_idx ON auth_verification (identifier);

CREATE TABLE auth_two_factor (
  id                        text PRIMARY KEY,
  secret                    text NOT NULL,
  backup_codes              text NOT NULL,
  user_id                   text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  verified                  boolean DEFAULT true,
  failed_verification_count integer DEFAULT 0,
  locked_until              timestamptz
);
CREATE INDEX auth_two_factor_user_idx ON auth_two_factor (user_id);

-- Limitador da biblioteca com armazenamento "database" (06 SEG-60, SEG-62).
CREATE TABLE auth_rate_limit (
  id           text PRIMARY KEY,
  key          text NOT NULL UNIQUE,
  count        integer NOT NULL,
  last_request bigint NOT NULL
);

-- A biblioteca apaga sessões (revogação), tokens consumidos, segundo fator removido e contadores.
CREATE OR REPLACE FUNCTION apply_app_grants() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t text;
  insert_only text[] := ARRAY['audit_log', 'security_event', 'pmoc_ficha_export', 'stored_file',
    'document_signature', 'document_follow_up_note', 'visit_schedule_change', 'standard_text', 'visit_receipt'];
  -- Únicas tabelas em que a aplicação pode excluir (03 §5.4, EL-1; auth_* conforme AF-04).
  deletable text[] := ARRAY['idempotency_key', 'equipment_tag_counter', 'rate_limit_counter', 'auth_user',
    'auth_session', 'auth_account', 'auth_verification', 'auth_two_factor', 'auth_rate_limit'];
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
