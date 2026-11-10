-- 03 Convenções: FK para usuário = {papel}_user_id, ON DELETE RESTRICT. As colunas foram criadas sem FK
-- por causa do ciclo app_user <-> client. Aqui toda coluna `user_id` / `*_user_id` que ainda não é FK passa
-- a apontar para app_user. `audit_log` e `security_event` ficam sem FK (03 §5.3; 06 §3.3.3).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND (c.column_name = 'user_id' OR c.column_name LIKE '%\_user\_id')
      AND c.table_name NOT IN ('audit_log', 'security_event')
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint k
        WHERE k.contype = 'f'
          AND k.conrelid = format('public.%I', c.table_name)::regclass
          AND k.conkey @> ARRAY[(SELECT attnum FROM pg_attribute
                                  WHERE attrelid = k.conrelid AND attname = c.column_name)]
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES app_user (id)',
      r.table_name, left(r.table_name || '_' || r.column_name || '_fk', 63), r.column_name);
  END LOOP;
END $$;

-- 03 §5.2: "criar índice em toda coluna FK que não esteja coberta por um índice acima".
-- Coberta = existe índice não parcial cuja primeira coluna é a primeira coluna da FK.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT k.conrelid::regclass::text AS tbl, a.attname AS col, k.conrelid, a.attnum
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'f'
      AND k.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = k.conrelid AND i.indpred IS NULL AND i.indkey[0] = k.conkey[1]
      )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      left(replace(r.tbl, '"', '') || '_' || r.col || '_fkidx', 63), r.tbl, r.col);
  END LOOP;
END $$;
