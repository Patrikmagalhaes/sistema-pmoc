-- 03 §2.1 a §2.5. As FKs de created_by/updated_by/deleted_by -> app_user são criadas em 0005 (ciclo com app_user).
-- Convenções (03 Convenções): PK uuid; enum = text + CHECK; texto obrigatório = NOT NULL + CHECK (btrim <> '').

-- AF-04: tabela mínima do Better Auth. As demais tabelas auth_* e as colunas dos plugins
-- entram na migração da Etapa 2, depois do spike S-04. Sem trigger de auditoria e sem RLS.
CREATE TABLE auth_user (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  email          text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  name               text NOT NULL CHECK (btrim(name) <> ''),
  email              citext NOT NULL UNIQUE,
  auth_user_id       text NOT NULL UNIQUE REFERENCES auth_user (id),
  role               text NOT NULL CHECK (role IN ('ADM','TECNICO','CLIENTE')),
  client_id          uuid,
  phone              varchar(11) CHECK (phone ~ '^[0-9]{10,11}$'),
  status             text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  inactivated_at     timestamptz,
  CHECK ((role = 'CLIENTE') = (client_id IS NOT NULL)),
  CHECK (status <> 'INATIVO' OR inactivated_at IS NOT NULL)
);
CREATE INDEX app_user_client_idx ON app_user (client_id) WHERE role = 'CLIENTE';
CREATE INDEX app_user_role_status_idx ON app_user (role, status);

CREATE TABLE client (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  deleted_at              timestamptz,
  deleted_by_user_id      uuid,
  deletion_reason         text,
  legal_name              text NOT NULL CHECK (btrim(legal_name) <> ''),
  trade_name              text,
  cnpj                    char(14) NOT NULL CHECK (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' AND is_valid_cnpj(cnpj)),
  phone_1                 varchar(11) CHECK (phone_1 ~ '^[0-9]{10,11}$'),
  phone_2                 varchar(11) CHECK (phone_2 ~ '^[0-9]{10,11}$'),
  address_street          text NOT NULL CHECK (btrim(address_street) <> ''),
  address_number          varchar(20),
  address_without_number  boolean NOT NULL DEFAULT false,
  address_complement      text,
  address_neighborhood    text,
  address_city            text NOT NULL CHECK (btrim(address_city) <> ''),
  address_state           char(2) NOT NULL CHECK (address_state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  address_zip             char(8) NOT NULL CHECK (address_zip ~ '^[0-9]{8}$'),
  CHECK ((address_without_number AND address_number IS NULL) OR (NOT address_without_number AND address_number IS NOT NULL AND btrim(address_number) <> '')),
  CHECK (phone_2 IS NULL OR (phone_1 IS NOT NULL AND phone_2 <> phone_1))
);
CREATE UNIQUE INDEX client_cnpj_live_uq ON client (cnpj) WHERE deleted_at IS NULL;

ALTER TABLE app_user ADD CONSTRAINT app_user_client_fk FOREIGN KEY (client_id) REFERENCES client (id);

CREATE TABLE site (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  deleted_at              timestamptz,
  deleted_by_user_id      uuid,
  deletion_reason         text,
  client_id               uuid NOT NULL REFERENCES client (id),
  code                    varchar(10) NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name                    text NOT NULL CHECK (btrim(name) <> ''),
  phone                   varchar(11) CHECK (phone ~ '^[0-9]{10,11}$'),
  address_street          text NOT NULL CHECK (btrim(address_street) <> ''),
  address_number          varchar(20),
  address_without_number  boolean NOT NULL DEFAULT false,
  address_complement      text,
  address_neighborhood    text,
  address_city            text NOT NULL CHECK (btrim(address_city) <> ''),
  address_state           char(2) NOT NULL CHECK (address_state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  address_zip             char(8) NOT NULL CHECK (address_zip ~ '^[0-9]{8}$'),
  CHECK ((address_without_number AND address_number IS NULL) OR (NOT address_without_number AND address_number IS NOT NULL AND btrim(address_number) <> ''))
);
CREATE INDEX site_client_live_idx ON site (client_id) WHERE deleted_at IS NULL;

CREATE TABLE contract (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                   timestamptz NOT NULL DEFAULT now(),
  created_by_user_id           uuid,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id           uuid,
  row_version                  integer NOT NULL DEFAULT 1,
  deleted_at                   timestamptz,
  deleted_by_user_id           uuid,
  deletion_reason              text,
  site_id                      uuid NOT NULL REFERENCES site (id),
  start_date                   date NOT NULL,
  end_date                     date NOT NULL,
  month_count                  smallint GENERATED ALWAYS AS (
    ((EXTRACT(YEAR FROM end_date) - EXTRACT(YEAR FROM start_date)) * 12
      + EXTRACT(MONTH FROM end_date) - EXTRACT(MONTH FROM start_date) + 1)::smallint) STORED,
  art_number                   text NOT NULL CHECK (btrim(art_number) <> ''),
  th_code                      varchar(30),
  revision                     varchar(10),
  status                       text NOT NULL CHECK (status IN ('A_INICIAR','VIGENTE','ENCERRADO','CANCELADO')),
  cancelled_on                 date,
  cancellation_reason          text,
  previous_contract_id         uuid REFERENCES contract (id),
  renewal_confirmed_at         timestamptz,
  renewal_confirmed_by_user_id uuid,
  CHECK (end_date > start_date),
  CHECK (status <> 'CANCELADO' OR (cancelled_on IS NOT NULL AND btrim(coalesce(cancellation_reason, '')) <> '')),
  CHECK (cancelled_on IS NULL OR cancelled_on BETWEEN start_date AND end_date),
  CHECK (renewal_confirmed_at IS NULL OR previous_contract_id IS NOT NULL),
  CHECK (renewal_confirmed_at IS NULL OR renewal_confirmed_by_user_id IS NOT NULL),
  -- RN-143: sem sobreposição de contratos não cancelados no mesmo local.
  EXCLUDE USING gist (site_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
    WHERE (status <> 'CANCELADO' AND deleted_at IS NULL)
);
CREATE INDEX contract_status_end_idx ON contract (status, end_date);

-- stored_file é [I] (03 §2.11). Criado aqui porque executor_company e outras o referenciam.
CREATE TABLE stored_file (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  kind               text NOT NULL CHECK (kind IN ('LOGO_EMPRESA','FOTO','PMOC_PDF','PMOC_PDF_ASSINADO_CLIENTE','RELATORIO_PDF','RELATORIO_PDF_ASSINADO_CLIENTE','FICHA_ATUALIZADA_PDF','COMPROVANTE_PDF','COMPROVANTE_ASSINATURA_IMG','PMOC_PDF_UPLOAD_MANUAL')),
  client_id          uuid REFERENCES client (id),
  storage_key        text NOT NULL UNIQUE CHECK (btrim(storage_key) <> ''),
  original_filename  text,
  mime_type          text NOT NULL CHECK (btrim(mime_type) <> ''),
  size_bytes         bigint NOT NULL CHECK (size_bytes > 0),
  sha256             char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE executor_company (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  singleton               boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  legal_name              text NOT NULL CHECK (btrim(legal_name) <> ''),
  cnpj                    char(14) NOT NULL CHECK (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' AND is_valid_cnpj(cnpj)),
  phone                   varchar(11) NOT NULL CHECK (phone ~ '^[0-9]{10,11}$'),
  crea_registration       text NOT NULL CHECK (btrim(crea_registration) <> ''),
  logo_file_id            uuid NOT NULL REFERENCES stored_file (id),
  address_street          text NOT NULL CHECK (btrim(address_street) <> ''),
  address_number          varchar(20),
  address_without_number  boolean NOT NULL DEFAULT false,
  address_complement      text,
  address_neighborhood    text NOT NULL CHECK (btrim(address_neighborhood) <> ''),
  address_city            text NOT NULL CHECK (btrim(address_city) <> ''),
  address_state           char(2) NOT NULL CHECK (address_state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  address_zip             char(8) NOT NULL CHECK (address_zip ~ '^[0-9]{8}$'),
  CHECK ((address_without_number AND address_number IS NULL) OR (NOT address_without_number AND address_number IS NOT NULL AND btrim(address_number) <> ''))
);

CREATE TABLE technical_responsible (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id      uuid,
  row_version             integer NOT NULL DEFAULT 1,
  singleton               boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  full_name               text NOT NULL CHECK (btrim(full_name) <> ''),
  professional_title      text NOT NULL CHECK (btrim(professional_title) <> ''),
  registration_number     text NOT NULL CHECK (btrim(registration_number) <> ''),
  phone                   varchar(11) NOT NULL CHECK (phone ~ '^[0-9]{10,11}$'),
  email                   citext NOT NULL CHECK (btrim(email::text) <> ''),
  address_street          text NOT NULL CHECK (btrim(address_street) <> ''),
  address_number          varchar(20),
  address_without_number  boolean NOT NULL DEFAULT false,
  address_complement      text,
  address_neighborhood    text NOT NULL CHECK (btrim(address_neighborhood) <> ''),
  address_city            text NOT NULL CHECK (btrim(address_city) <> ''),
  address_state           char(2) NOT NULL CHECK (address_state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  address_zip             char(8) NOT NULL CHECK (address_zip ~ '^[0-9]{8}$'),
  CHECK ((address_without_number AND address_number IS NULL) OR (NOT address_without_number AND address_number IS NOT NULL AND btrim(address_number) <> ''))
);

CREATE TABLE rt_certificate (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id       uuid,
  row_version              integer NOT NULL DEFAULT 1,
  deleted_at               timestamptz,
  deleted_by_user_id       uuid,
  deletion_reason          text,
  technical_responsible_id uuid NOT NULL REFERENCES technical_responsible (id),
  certificate_type         text NOT NULL CHECK (certificate_type IN ('A1','A3')),
  encrypted_pkcs12         bytea NOT NULL,
  encrypted_password       bytea NOT NULL,
  encryption_key_ref       text NOT NULL CHECK (btrim(encryption_key_ref) <> ''),
  holder_name              text NOT NULL CHECK (btrim(holder_name) <> ''),
  serial_number            text NOT NULL CHECK (btrim(serial_number) <> ''),
  issuer_name              text,
  valid_from               timestamptz NOT NULL,
  valid_until              timestamptz NOT NULL,
  is_current               boolean NOT NULL DEFAULT false,
  CHECK (valid_until > valid_from)
);
CREATE UNIQUE INDEX rt_certificate_current_uq ON rt_certificate (is_current) WHERE is_current AND deleted_at IS NULL;

-- 03 §2.4
CREATE TABLE equipment_type (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  deleted_at         timestamptz,
  deleted_by_user_id uuid,
  deletion_reason    text,
  name               text NOT NULL CHECK (btrim(name) <> ''),
  plural_name        text,
  acronym            varchar(5) NOT NULL CHECK (acronym ~ '^[A-Z]{2,5}$'),
  status             text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO'))
);
CREATE UNIQUE INDEX equipment_type_acronym_live_uq ON equipment_type (acronym) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX equipment_type_name_live_uq ON equipment_type (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE equipment_group (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  row_version        integer NOT NULL DEFAULT 1,
  deleted_at         timestamptz,
  deleted_by_user_id uuid,
  deletion_reason    text,
  equipment_type_id  uuid NOT NULL REFERENCES equipment_type (id),
  name               text NOT NULL CHECK (btrim(name) <> ''),
  status             text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  UNIQUE (id, equipment_type_id)
);
CREATE UNIQUE INDEX equipment_group_name_live_uq ON equipment_group (equipment_type_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE activity_template (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id  uuid,
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  deleted_by_user_id  uuid,
  deletion_reason     text,
  equipment_type_id   uuid NOT NULL REFERENCES equipment_type (id),
  title               text NOT NULL CHECK (btrim(title) <> ''),
  default_periodicity text NOT NULL CHECK (default_periodicity IN ('MM','MB','MT','MS','MA')),
  nature              text NOT NULL CHECK (nature IN ('VERIFICACAO','MEDICAO')),
  unit                varchar(20),
  requires_photo      boolean NOT NULL DEFAULT false,
  display_order       integer NOT NULL,
  status              text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  CHECK ((nature = 'MEDICAO' AND unit IS NOT NULL AND btrim(unit) <> '') OR (nature = 'VERIFICACAO' AND unit IS NULL))
);
CREATE UNIQUE INDEX activity_template_title_live_uq ON activity_template (equipment_type_id, lower(title)) WHERE deleted_at IS NULL;

-- 03 §2.5
CREATE TABLE equipment (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id   uuid,
  row_version          integer NOT NULL DEFAULT 1,
  deleted_at           timestamptz,
  deleted_by_user_id   uuid,
  deletion_reason      text,
  site_id              uuid NOT NULL REFERENCES site (id),
  equipment_type_id    uuid NOT NULL REFERENCES equipment_type (id),
  equipment_group_id   uuid NOT NULL,
  location_description text NOT NULL CHECK (btrim(location_description) <> ''),
  brand                text,
  model                text,
  serial_number        text,
  capacity             numeric(12,2) CHECK (capacity > 0),
  capacity_unit        varchar(20),
  tag_sequence         smallint NOT NULL CHECK (tag_sequence BETWEEN 1 AND 999),
  tag                  varchar(30) NOT NULL UNIQUE CHECK (btrim(tag) <> ''),
  status               text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  inactivated_at       timestamptz,
  FOREIGN KEY (equipment_group_id, equipment_type_id) REFERENCES equipment_group (id, equipment_type_id),
  UNIQUE (site_id, equipment_type_id, tag_sequence),
  CHECK (capacity IS NULL OR (capacity_unit IS NOT NULL AND btrim(capacity_unit) <> '')),
  CHECK (status <> 'INATIVO' OR inactivated_at IS NOT NULL)
);
CREATE INDEX equipment_site_status_idx ON equipment (site_id, status) WHERE deleted_at IS NULL;

CREATE TABLE equipment_tag_counter (
  site_id           uuid NOT NULL REFERENCES site (id),
  equipment_type_id uuid NOT NULL REFERENCES equipment_type (id),
  last_sequence     smallint NOT NULL CHECK (last_sequence >= 1),
  PRIMARY KEY (site_id, equipment_type_id)
);
