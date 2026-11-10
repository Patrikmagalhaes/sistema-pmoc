-- Spike S-04: DDL derivado de getAuthTables() (better-auth 1.7.10) com nomes auth_* (AF-04).
ALTER TABLE auth_user
  ADD COLUMN image text,
  ADD COLUMN role text,
  ADD COLUMN banned boolean DEFAULT false,
  ADD COLUMN ban_reason text,
  ADD COLUMN ban_expires timestamptz,
  ADD COLUMN two_factor_enabled boolean DEFAULT false;

CREATE TABLE auth_session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  impersonated_by text
);
CREATE TABLE auth_account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  scope text, password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_two_factor (
  id text PRIMARY KEY,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  user_id text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  verified boolean DEFAULT true,
  failed_verification_count integer DEFAULT 0,
  locked_until timestamptz
);
