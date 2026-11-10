-- 03 §2.11 (suporte) e 06 §3.3.3 / OBS-10. `audit_seal` não existe: é "Depois" (AF-20).

CREATE TABLE notification (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  recipient_user_id  uuid NOT NULL,
  event_type         text NOT NULL CHECK (event_type IN ('VISITA_AGENDADA','VISITA_REMARCADA','VISITA_CANCELADA','TECNICO_TROCADO','PMOC_AGUARDANDO_ASSINATURA','RELATORIO_AGUARDANDO_ASSINATURA','RELATORIO_ASSINADO','OCORRENCIAS_PENDENTES')),
  title              text NOT NULL CHECK (btrim(title) <> ''),
  body               text NOT NULL CHECK (btrim(body) <> ''),
  entity_type        text,
  entity_id          uuid,
  payload            jsonb,
  dedupe_key         text,
  status             text NOT NULL DEFAULT 'NAO_LIDA' CHECK (status IN ('NAO_LIDA','LIDA')),
  read_at            timestamptz,
  CHECK (status <> 'LIDA' OR read_at IS NOT NULL)
);
CREATE INDEX notification_recipient_idx ON notification (recipient_user_id, status, created_at DESC);
CREATE UNIQUE INDEX notification_dedupe_uq ON notification (recipient_user_id, event_type, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE idempotency_key (
  key             uuid PRIMARY KEY,
  user_id         uuid NOT NULL,
  operation       text NOT NULL CHECK (btrim(operation) <> ''),
  request_sha256  char(64) NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  response_status smallint NOT NULL,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL
);

CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_role    text,
  source        text NOT NULL CHECK (source IN ('WEB_ADM','PORTAL_CLIENTE','PWA_TECNICO','SISTEMA')),
  action        text NOT NULL CHECK (action IN ('INSERT','UPDATE','SOFT_DELETE','RESTORE','DELETE')),
  table_name    text NOT NULL,
  record_id     text NOT NULL,
  changed_fields text[],
  old_values    jsonb,
  new_values    jsonb,
  reason        text,
  request_id    uuid,
  ip_address    inet
);
CREATE INDEX audit_log_record_idx ON audit_log (table_name, record_id, occurred_at);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, occurred_at);
CREATE INDEX audit_log_occurred_idx ON audit_log (occurred_at);

CREATE TABLE device (
  id                  uuid PRIMARY KEY,  -- gerado no aparelho (03 §2.11)
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id  uuid,
  row_version         integer NOT NULL DEFAULT 1,
  user_id             uuid NOT NULL,
  label               text,
  app_version         text NOT NULL CHECK (btrim(app_version) <> ''),
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_sync_at        timestamptz,
  pending_operations  integer NOT NULL DEFAULT 0 CHECK (pending_operations >= 0),
  oldest_pending_at   timestamptz
);
CREATE INDEX device_user_idx ON device (user_id);
CREATE INDEX device_oldest_pending_idx ON device (oldest_pending_at) WHERE oldest_pending_at IS NOT NULL;

CREATE TABLE sync_review_item (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id   uuid,
  row_version          integer NOT NULL DEFAULT 1,
  visit_id             uuid NOT NULL REFERENCES visit (id),
  user_id              uuid NOT NULL,
  device_id            uuid REFERENCES device (id),
  idempotency_key      uuid NOT NULL UNIQUE,
  operation            text NOT NULL CHECK (btrim(operation) <> ''),
  payload              jsonb NOT NULL,
  base_row_version     integer,
  reason               text NOT NULL CHECK (reason IN ('AGENDA_ALTERADA_PELO_ADM','VISITA_JA_REGISTRADA','VISITA_REATRIBUIDA','EQUIPAMENTO_INATIVADO','OCORRENCIA_FORA_DO_PLANO')),
  applied              boolean NOT NULL,
  status               text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','RESOLVIDO')),
  resolved_at          timestamptz,
  resolved_by_user_id  uuid,
  resolution_note      text,
  CHECK (status <> 'RESOLVIDO' OR (resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL))
);
CREATE INDEX sync_review_item_open_idx ON sync_review_item (status, created_at) WHERE status = 'ABERTO';

CREATE TABLE standard_text (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  code               text NOT NULL CHECK (code IN ('ACEITE_ASSINATURA','RECOMENDACOES_PMOC','TERMO_COMPROVANTE')),
  version            integer NOT NULL CHECK (version >= 1),
  body               text NOT NULL CHECK (btrim(body) <> ''),
  UNIQUE (code, version)
);

CREATE TABLE data_subject_request (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  requester_name     text NOT NULL CHECK (btrim(requester_name) <> ''),
  requester_email    citext NOT NULL CHECK (btrim(requester_email::text) <> ''),
  user_id            uuid,
  request_type       text NOT NULL CHECK (request_type IN ('CONFIRMACAO_ACESSO','CORRECAO','ANONIMIZACAO_ELIMINACAO','INFORMACAO_COMPARTILHAMENTO','PORTABILIDADE')),
  received_on        date NOT NULL,
  due_on             date NOT NULL,
  status             text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','CONCLUIDO','RECUSADO')),
  answered_on        date,
  response_summary   text,
  CHECK (status = 'ABERTO' OR (answered_on IS NOT NULL AND btrim(coalesce(response_summary, '')) <> ''))
);
CREATE INDEX data_subject_request_status_due_idx ON data_subject_request (status, due_on);

CREATE TABLE rate_limit_counter (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL
);

CREATE TABLE security_event (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type  text NOT NULL CHECK (event_type IN ('LOGIN_OK','LOGIN_FALHA','CONTA_BLOQUEADA','SENHA_ALTERADA','SENHA_REDEFINIDA','MFA_ATIVADO','MFA_REMOVIDO','SESSAO_REVOGADA','DOWNLOAD_ARQUIVO','ACESSO_NEGADO','EXPORT_TITULAR','CERTIFICADO_USADO','CERTIFICADO_ENVIADO')),
  user_id     uuid,
  email_hash  char(64) CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  ip_address  inet,
  user_agent  text,
  entity_type text,
  entity_id   uuid,
  request_id  uuid
);
CREATE INDEX security_event_user_idx ON security_event (user_id, occurred_at);
CREATE INDEX security_event_type_idx ON security_event (event_type, occurred_at);

-- 06 OBS-10. [A VALIDAR] valores de status e tipo de id: o doc lista só os nomes das colunas.
CREATE TABLE job_run (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        text NOT NULL CHECK (btrim(job_name) <> ''),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL CHECK (status IN ('EM_EXECUCAO','SUCESSO','FALHA')),
  attempt         integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  error_code      text,
  duration_ms     integer,
  items_processed integer
);
CREATE INDEX job_run_name_started_idx ON job_run (job_name, started_at DESC);
