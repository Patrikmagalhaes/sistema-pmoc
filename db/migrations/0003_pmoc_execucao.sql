-- 03 §2.6 a §2.10 e visit_receipt (§2.11). Sem triggers de regra de negócio (ficam na etapa do módulo, doc 07).

-- 03 §2.6
CREATE TABLE pmoc (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id    uuid,
  row_version           integer NOT NULL DEFAULT 1,
  deleted_at            timestamptz,
  deleted_by_user_id    uuid,
  deletion_reason       text,
  contract_id           uuid NOT NULL UNIQUE REFERENCES contract (id),
  status                text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','EMITIDO','ASSINADO_CLIENTE','HISTORICO')),
  current_version_number integer,
  first_issued_at       timestamptz,
  historic_since        timestamptz,
  copied_from_pmoc_id   uuid REFERENCES pmoc (id),
  CHECK (status = 'RASCUNHO' OR current_version_number IS NOT NULL),
  CHECK (status <> 'HISTORICO' OR historic_since IS NOT NULL)
);
CREATE INDEX pmoc_status_idx ON pmoc (status);

CREATE TABLE pmoc_activity (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id  uuid,
  row_version         integer NOT NULL DEFAULT 1,
  pmoc_id             uuid NOT NULL REFERENCES pmoc (id),
  equipment_type_id   uuid NOT NULL REFERENCES equipment_type (id),
  activity_template_id uuid REFERENCES activity_template (id),
  title               text NOT NULL CHECK (btrim(title) <> ''),
  periodicity         text NOT NULL CHECK (periodicity IN ('MM','MB','MT','MS','MA')),
  nature              text NOT NULL CHECK (nature IN ('VERIFICACAO','MEDICAO')),
  unit                varchar(20),
  requires_photo      boolean NOT NULL DEFAULT false,
  display_order       integer NOT NULL,
  removed_at          timestamptz,
  removed_by_user_id  uuid,
  CHECK ((nature = 'MEDICAO' AND unit IS NOT NULL AND btrim(unit) <> '') OR (nature = 'VERIFICACAO' AND unit IS NULL))
);
CREATE UNIQUE INDEX pmoc_activity_template_uq ON pmoc_activity (pmoc_id, activity_template_id)
  WHERE activity_template_id IS NOT NULL AND removed_at IS NULL;
CREATE INDEX pmoc_activity_pmoc_type_idx ON pmoc_activity (pmoc_id, equipment_type_id);

CREATE TABLE pmoc_version (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by_user_id         uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id         uuid,
  row_version                integer NOT NULL DEFAULT 1,
  pmoc_id                    uuid NOT NULL REFERENCES pmoc (id),
  client_id                  uuid NOT NULL REFERENCES client (id),
  version_number             integer NOT NULL,
  status                     text NOT NULL CHECK (status IN ('AGUARDANDO_ASSINATURA','ASSINADO_CLIENTE','SUBSTITUIDA')),
  is_current                 boolean NOT NULL,
  issue_reason               text,
  snapshot                   jsonb NOT NULL,
  snapshot_schema_version    smallint NOT NULL,
  pdf_file_id                uuid NOT NULL REFERENCES stored_file (id),
  pdf_sha256                 char(64) NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  rt_signature_method        text NOT NULL CHECK (rt_signature_method IN ('AUTOMATICA_A1','UPLOAD_MANUAL')),
  rt_certificate_id          uuid REFERENCES rt_certificate (id),
  rt_signed_at               timestamptz NOT NULL,
  client_signed_pdf_file_id  uuid REFERENCES stored_file (id),
  client_signed_pdf_sha256   char(64) CHECK (client_signed_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  issued_at                  timestamptz NOT NULL,
  issued_by_user_id          uuid NOT NULL,
  renderer_version           text NOT NULL CHECK (btrim(renderer_version) <> ''),
  verification_code          text NOT NULL UNIQUE CHECK (btrim(verification_code) <> ''),
  superseded_at              timestamptz,
  UNIQUE (pmoc_id, version_number),
  CHECK (rt_signature_method <> 'AUTOMATICA_A1' OR rt_certificate_id IS NOT NULL),
  CHECK (status <> 'ASSINADO_CLIENTE' OR client_signed_pdf_file_id IS NOT NULL),
  CHECK (is_current OR superseded_at IS NOT NULL)
);
CREATE UNIQUE INDEX pmoc_version_current_uq ON pmoc_version (pmoc_id) WHERE is_current;

CREATE TABLE pmoc_ficha_export (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  pmoc_id            uuid NOT NULL REFERENCES pmoc (id),
  data_as_of         timestamptz NOT NULL,
  file_id            uuid NOT NULL REFERENCES stored_file (id),
  renderer_version   text NOT NULL CHECK (btrim(renderer_version) <> '')
);

-- 03 §2.7
CREATE TABLE occurrence (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  pmoc_id            uuid NOT NULL REFERENCES pmoc (id),
  pmoc_activity_id   uuid NOT NULL REFERENCES pmoc_activity (id),
  equipment_id       uuid NOT NULL REFERENCES equipment (id),
  month_index        smallint NOT NULL CHECK (month_index >= 1),
  reference_month    date NOT NULL CHECK (EXTRACT(DAY FROM reference_month) = 1),
  due_date           date NOT NULL,
  status             text NOT NULL CHECK (status IN ('NAO_PREVISTA','PREVISTA','PENDENTE','OK','NOK')),
  pending_since      date,
  unscheduled_reason text CHECK (unscheduled_reason IN ('RECALCULO_PERIODICIDADE','ATIVIDADE_REMOVIDA_DO_PLANO','EQUIPAMENTO_INATIVADO','CONTRATO_CANCELADO','PENDENCIA_CANCELADA')),
  unscheduled_at     timestamptz,
  UNIQUE (pmoc_activity_id, equipment_id, month_index),
  CHECK (due_date = (reference_month + INTERVAL '1 month' - INTERVAL '1 day')::date),
  CHECK (status <> 'PENDENTE' OR pending_since IS NOT NULL),
  CHECK ((status = 'NAO_PREVISTA') = (unscheduled_reason IS NOT NULL)),
  CHECK ((status = 'NAO_PREVISTA') = (unscheduled_at IS NOT NULL))
);
CREATE INDEX occurrence_pmoc_equipment_month_idx ON occurrence (pmoc_id, equipment_id, month_index);
CREATE INDEX occurrence_prevista_due_idx ON occurrence (due_date) WHERE status = 'PREVISTA';
CREATE INDEX occurrence_pendente_idx ON occurrence (pmoc_id) WHERE status = 'PENDENTE';

-- 03 §2.8 (visit antes de occurrence_record, que a referencia)
CREATE TABLE visit (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  deleted_at              timestamptz,
  deleted_by_user_id      uuid,
  deletion_reason         text,
  pmoc_id                 uuid NOT NULL REFERENCES pmoc (id),
  site_id                 uuid NOT NULL REFERENCES site (id),
  client_id               uuid NOT NULL REFERENCES client (id),
  reference_month_index   smallint NOT NULL CHECK (reference_month_index >= 1),
  reference_month         date NOT NULL CHECK (EXTRACT(DAY FROM reference_month) = 1),
  status                  text NOT NULL DEFAULT 'A_AGENDAR' CHECK (status IN ('A_AGENDAR','AGENDADA','EM_ANDAMENTO','REGISTRADA','CANCELADA')),
  origin                  text NOT NULL CHECK (origin IN ('AUTOMATICA','RECALCULO','DIVISAO','AVULSA')),
  split_from_visit_id     uuid REFERENCES visit (id),
  scheduled_date          date,
  scheduled_time          time,
  technician_user_id      uuid,
  started_at              timestamptz,
  started_by_user_id      uuid,
  device_started_at       timestamptz,
  finished_at             timestamptz,
  finalized_by_user_id    uuid,
  finalization_channel    text CHECK (finalization_channel IN ('APP_TECNICO','PAINEL_ADM')),
  executed_by_user_id     uuid,
  execution_date          date,
  cancelled_at            timestamptz,
  cancelled_by_user_id    uuid,
  cancellation_reason     text,
  CHECK (origin <> 'DIVISAO' OR split_from_visit_id IS NOT NULL),
  CHECK (status NOT IN ('AGENDADA','EM_ANDAMENTO') OR (scheduled_date IS NOT NULL AND technician_user_id IS NOT NULL)),
  CHECK (status <> 'REGISTRADA' OR (finished_at IS NOT NULL AND finalized_by_user_id IS NOT NULL
    AND finalization_channel IS NOT NULL AND executed_by_user_id IS NOT NULL AND execution_date IS NOT NULL)),
  CHECK (status <> 'CANCELADA' OR cancelled_at IS NOT NULL)
);
CREATE INDEX visit_technician_date_idx ON visit (technician_user_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX visit_site_date_idx ON visit (site_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX visit_status_date_idx ON visit (status, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX visit_pmoc_month_idx ON visit (pmoc_id, reference_month_index);

CREATE TABLE occurrence_record (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  occurrence_id           uuid NOT NULL UNIQUE REFERENCES occurrence (id),
  visit_id                uuid REFERENCES visit (id),
  result                  text CHECK (result IN ('OK','NOK')),
  activity_nature         text NOT NULL CHECK (activity_nature IN ('VERIFICACAO','MEDICAO')),
  measured_value          numeric(14,4),
  measurement_unit        varchar(20),
  requires_corrective     boolean NOT NULL DEFAULT false,
  observation             text,
  executed_on             date,
  executed_by_user_id     uuid,
  source                  text NOT NULL CHECK (source IN ('APP_TECNICO','PAINEL_ADM','RESOLUCAO_PENDENCIA')),
  finalized_at            timestamptz,
  finalized_by_user_id    uuid,
  device_updated_at       timestamptz,
  CHECK (finalized_at IS NULL OR (result IS NOT NULL AND executed_on IS NOT NULL)),
  CHECK (finalized_at IS NULL OR result <> 'NOK' OR btrim(coalesce(observation, '')) <> ''),
  CHECK (finalized_at IS NULL OR NOT requires_corrective OR btrim(coalesce(observation, '')) <> ''),
  CHECK (NOT requires_corrective OR result = 'OK'),
  CHECK (finalized_at IS NULL OR NOT (activity_nature = 'MEDICAO' AND result = 'OK') OR measured_value IS NOT NULL),
  CHECK (activity_nature = 'MEDICAO' OR measured_value IS NULL),
  CHECK (finalized_at IS NULL OR finalized_by_user_id IS NOT NULL),
  CHECK (finalized_at IS NULL OR source = 'RESOLUCAO_PENDENCIA' OR executed_by_user_id IS NOT NULL)
);
CREATE INDEX occurrence_record_visit_idx ON occurrence_record (visit_id);

CREATE TABLE visit_occurrence (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  visit_id           uuid NOT NULL REFERENCES visit (id),
  occurrence_id      uuid NOT NULL REFERENCES occurrence (id),
  removed_at         timestamptz,
  removed_by_user_id uuid,
  removal_reason     text CHECK (removal_reason IN ('VISITA_CANCELADA','DIVISAO','MOVIDA_PARA_OUTRA_VISITA','RECALCULO')),
  CHECK (removed_at IS NULL OR removal_reason IS NOT NULL)
);
CREATE UNIQUE INDEX visit_occurrence_active_uq ON visit_occurrence (occurrence_id) WHERE removed_at IS NULL;
CREATE INDEX visit_occurrence_visit_active_idx ON visit_occurrence (visit_id) WHERE removed_at IS NULL;

CREATE TABLE visit_schedule_change (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  visit_id           uuid NOT NULL REFERENCES visit (id),
  change_group_id    uuid NOT NULL,
  field              text NOT NULL CHECK (field IN ('DATA','HORARIO','TECNICO','ESTADO')),
  old_value          text,
  new_value          text,
  reason             text
);
CREATE INDEX visit_schedule_change_visit_idx ON visit_schedule_change (visit_id, created_at);

CREATE TABLE visit_equipment_note (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  visit_id           uuid NOT NULL REFERENCES visit (id),
  equipment_id       uuid NOT NULL REFERENCES equipment (id),
  observation        text NOT NULL CHECK (btrim(observation) <> ''),
  device_updated_at  timestamptz,
  UNIQUE (visit_id, equipment_id)
);

CREATE TABLE photo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  deleted_at         timestamptz,
  deleted_by_user_id uuid,
  deletion_reason    text,
  visit_id           uuid NOT NULL REFERENCES visit (id),
  equipment_id       uuid NOT NULL REFERENCES equipment (id),
  occurrence_id      uuid REFERENCES occurrence (id),
  file_id            uuid NOT NULL UNIQUE REFERENCES stored_file (id),
  captured_at        timestamptz,
  caption            text
);
CREATE INDEX photo_visit_equipment_idx ON photo (visit_id, equipment_id) WHERE deleted_at IS NULL;

-- 03 §2.9
CREATE TABLE visit_report (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by_user_id     uuid,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id     uuid,
  row_version            integer NOT NULL DEFAULT 1,
  visit_id               uuid NOT NULL UNIQUE REFERENCES visit (id),
  status                 text NOT NULL CHECK (status IN ('RASCUNHO','AGUARDANDO_ASSINATURA','ASSINADO_CLIENTE')),
  current_version_number integer NOT NULL DEFAULT 1
);

CREATE TABLE visit_report_version (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by_user_id         uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id         uuid,
  row_version                integer NOT NULL DEFAULT 1,
  visit_report_id            uuid NOT NULL REFERENCES visit_report (id),
  client_id                  uuid NOT NULL REFERENCES client (id),
  version_number             integer NOT NULL,
  status                     text NOT NULL CHECK (status IN ('RASCUNHO','AGUARDANDO_ASSINATURA','ASSINADO_CLIENTE')),
  is_current                 boolean NOT NULL,
  ai_generation_status       text NOT NULL DEFAULT 'NAO_SOLICITADA' CHECK (ai_generation_status IN ('NAO_SOLICITADA','GERADA','FALHOU')),
  ai_model                   text,
  ai_prompt_version          text,
  ai_generated_text          text,
  ai_generated_at            timestamptz,
  ai_error_message           text,
  ai_generation_count        smallint NOT NULL DEFAULT 0,
  final_text                 text,
  author_user_id             uuid NOT NULL,
  data_snapshot              jsonb,
  pdf_file_id                uuid REFERENCES stored_file (id),
  pdf_sha256                 char(64) CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  renderer_version           text,
  verification_code          text UNIQUE,
  sent_at                    timestamptz,
  sent_by_user_id            uuid,
  withdrawn_at               timestamptz,
  withdrawn_by_user_id       uuid,
  client_signed_pdf_file_id  uuid REFERENCES stored_file (id),
  client_signed_pdf_sha256   char(64) CHECK (client_signed_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  superseded_at              timestamptz,
  UNIQUE (visit_report_id, version_number),
  CHECK (ai_generation_status <> 'GERADA' OR (ai_model IS NOT NULL AND ai_prompt_version IS NOT NULL
    AND ai_generated_text IS NOT NULL AND ai_generated_at IS NOT NULL)),
  CHECK (ai_generation_status <> 'FALHOU' OR ai_error_message IS NOT NULL),
  CHECK (status = 'RASCUNHO' OR (final_text IS NOT NULL AND data_snapshot IS NOT NULL AND pdf_file_id IS NOT NULL
    AND pdf_sha256 IS NOT NULL AND renderer_version IS NOT NULL AND verification_code IS NOT NULL AND sent_at IS NOT NULL)),
  CHECK (status <> 'ASSINADO_CLIENTE' OR client_signed_pdf_file_id IS NOT NULL),
  CHECK (is_current OR superseded_at IS NOT NULL)
);
CREATE UNIQUE INDEX visit_report_version_current_uq ON visit_report_version (visit_report_id) WHERE is_current;
CREATE INDEX visit_report_version_sent_idx ON visit_report_version (sent_at) WHERE status = 'AGUARDANDO_ASSINATURA' AND is_current;

-- 03 §2.10
CREATE TABLE document_signature (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid,
  document_type            text NOT NULL CHECK (document_type IN ('PMOC_VERSAO','RELATORIO_VERSAO')),
  pmoc_version_id          uuid REFERENCES pmoc_version (id),
  visit_report_version_id  uuid REFERENCES visit_report_version (id),
  signer_user_id           uuid NOT NULL,
  client_id                uuid NOT NULL REFERENCES client (id),
  signer_name              text NOT NULL CHECK (btrim(signer_name) <> ''),
  signer_email             citext NOT NULL CHECK (btrim(signer_email::text) <> ''),
  signed_at                timestamptz NOT NULL,
  signer_timezone          text NOT NULL DEFAULT 'America/Sao_Paulo',
  ip_address               inet NOT NULL,
  user_agent               text,
  document_sha256          char(64) NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
  acceptance_text          text NOT NULL CHECK (btrim(acceptance_text) <> ''),
  acceptance_text_version  text NOT NULL CHECK (btrim(acceptance_text_version) <> ''),
  CHECK ((document_type = 'PMOC_VERSAO') = (pmoc_version_id IS NOT NULL)),
  CHECK ((document_type = 'RELATORIO_VERSAO') = (visit_report_version_id IS NOT NULL))
);
CREATE UNIQUE INDEX document_signature_pmoc_uq ON document_signature (pmoc_version_id) WHERE pmoc_version_id IS NOT NULL;
CREATE UNIQUE INDEX document_signature_report_uq ON document_signature (visit_report_version_id) WHERE visit_report_version_id IS NOT NULL;

CREATE TABLE document_follow_up_note (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid,
  document_type            text NOT NULL CHECK (document_type IN ('PMOC_VERSAO','RELATORIO_VERSAO')),
  pmoc_version_id          uuid REFERENCES pmoc_version (id),
  visit_report_version_id  uuid REFERENCES visit_report_version (id),
  note                     text NOT NULL CHECK (btrim(note) <> ''),
  CHECK ((document_type = 'PMOC_VERSAO') = (pmoc_version_id IS NOT NULL)),
  CHECK ((document_type = 'RELATORIO_VERSAO') = (visit_report_version_id IS NOT NULL))
);

-- 03 §2.11 (AF-10)
CREATE TABLE visit_receipt (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by_user_id        uuid,
  visit_id                  uuid NOT NULL UNIQUE REFERENCES visit (id),
  client_id                 uuid NOT NULL REFERENCES client (id),
  signer_name               text NOT NULL CHECK (btrim(signer_name) <> ''),
  signature_image_file_id   uuid NOT NULL REFERENCES stored_file (id),
  content_snapshot          jsonb NOT NULL,
  content_sha256            char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  acceptance_text_version   integer NOT NULL,
  device_signed_at          timestamptz NOT NULL,
  pdf_file_id               uuid NOT NULL REFERENCES stored_file (id)
);
