-- RLS para o perfil CLIENTE (05 §4.2, ADR-05; AF-04, AF-06). Falha fechada: sem contexto, nada é visível.
-- Tabelas auth_* e demais fora da lista da 05 §4.2 ficam sem RLS (o isolamento delas é da camada de aplicação).
-- backup_ro tem BYPASSRLS; o dono das tabelas (pmoc_owner) não é usado em runtime.

-- true para ADM, TECNICO e SISTEMA (controle na camada 1); CLIENTE só enxerga o próprio client_id;
-- ator vazio ou desconhecido -> false.
CREATE FUNCTION app_visible_client(p_client_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_role   text := nullif(current_setting('app.actor_role', true), '');
  v_client text := nullif(current_setting('app.client_id', true), '');
BEGIN
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role IN ('ADM', 'TECNICO', 'SISTEMA') THEN RETURN true; END IF;
  IF v_role = 'CLIENTE' THEN
    RETURN p_client_id IS NOT NULL AND v_client IS NOT NULL AND p_client_id = v_client::uuid;
  END IF;
  RETURN false;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  -- tabela, expressão que devolve o client_id da linha
  FOR r IN SELECT * FROM (VALUES
    ('client',                 'id'),
    ('site',                   'client_id'),
    ('contract',               '(SELECT s.client_id FROM site s WHERE s.id = contract.site_id)'),
    ('equipment',              '(SELECT s.client_id FROM site s WHERE s.id = equipment.site_id)'),
    ('pmoc',                   '(SELECT s.client_id FROM contract c JOIN site s ON s.id = c.site_id WHERE c.id = pmoc.contract_id)'),
    ('pmoc_ficha_export',      '(SELECT s.client_id FROM pmoc p JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id WHERE p.id = pmoc_ficha_export.pmoc_id)'),
    ('occurrence',             '(SELECT s.client_id FROM pmoc p JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id WHERE p.id = occurrence.pmoc_id)'),
    ('visit_occurrence',       '(SELECT v.client_id FROM visit v WHERE v.id = visit_occurrence.visit_id)'),
    ('visit_schedule_change',  '(SELECT v.client_id FROM visit v WHERE v.id = visit_schedule_change.visit_id)'),
    ('visit_report',           '(SELECT v.client_id FROM visit v WHERE v.id = visit_report.visit_id)'),
    ('photo',                  '(SELECT v.client_id FROM visit v WHERE v.id = photo.visit_id)'),
    ('document_signature',     'client_id'),
    ('pmoc_version',           'client_id'),
    ('visit',                  'client_id'),
    ('visit_report_version',   'client_id'),
    ('stored_file',            'client_id'),
    ('visit_receipt',          'client_id'),
    ('app_user',               'client_id')
  ) AS v(tbl, expr)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY client_scope ON %I USING (app_visible_client(%s)) WITH CHECK (app_visible_client(%s))',
                   r.tbl, r.expr, r.expr);
  END LOOP;
END $$;

-- notification: só o destinatário, para todos os perfis (05 §4.2).
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipient_only ON notification
  USING (recipient_user_id = nullif(current_setting('app.actor_user_id', true), '')::uuid)
  WITH CHECK (
    -- Quem cria notificação para outro usuário é o sistema (job) ou o ADM (emissão, agenda).
    recipient_user_id = nullif(current_setting('app.actor_user_id', true), '')::uuid
    OR nullif(current_setting('app.actor_role', true), '') IN ('ADM', 'SISTEMA'));
