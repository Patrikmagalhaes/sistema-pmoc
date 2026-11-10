-- Executado uma vez pelo superusuário (ou pelo papel administrativo do Supabase), de forma idempotente.
-- Cria os papéis (03 E18; 05 §4.2) e as extensões (03 §5.1). Senhas: definidas por db/migrate.ts a partir do ambiente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pmoc_owner') THEN
    CREATE ROLE pmoc_owner LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    -- Papel da aplicação: sem BYPASSRLS e sem ser dono das tabelas.
    CREATE ROLE app_rw LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup_ro') THEN
    -- pg_dump pela conexão direta (06 DSP-10): só leitura, ignora RLS.
    CREATE ROLE backup_ro LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB BYPASSRLS;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  EXECUTE format('GRANT CREATE, CONNECT ON DATABASE %I TO pmoc_owner', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_rw, backup_ro', current_database());
END $$;
GRANT ALL ON SCHEMA public TO pmoc_owner;
GRANT USAGE ON SCHEMA public TO app_rw, backup_ro;
