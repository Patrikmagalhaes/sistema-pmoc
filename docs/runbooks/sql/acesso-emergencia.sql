-- SEG-18: acesso de emergência quando NENHUM ADM consegue entrar. Ver docs/runbooks/acesso-emergencia.md.
-- Executar com o usuário dono (pmoc_owner), numa sessão, DEPOIS de definir os três parâmetros:
--   SELECT set_config('emergencia.email', 'pessoa@empresa.com.br', false),
--          set_config('emergencia.acao', 'SEGUNDO_FATOR', false),   -- ou 'REATIVAR'
--          set_config('emergencia.motivo', 'SEG-18: <o que houve> – operador <nome>, dono <nome>', false);
-- Tudo roda numa transação: qualquer conferência que falhar desfaz tudo.
BEGIN;
DO $$
DECLARE
  v_email  text := lower(trim(current_setting('emergencia.email', true)));
  v_acao   text := current_setting('emergencia.acao', true);
  v_motivo text := trim(current_setting('emergencia.motivo', true));
  v_req    uuid := gen_random_uuid();
  v_user   app_user%ROWTYPE;
  v_2fa    boolean;
BEGIN
  IF coalesce(v_email, '') = '' OR coalesce(v_motivo, '') = '' THEN
    RAISE EXCEPTION 'defina emergencia.email e emergencia.motivo antes de executar';
  END IF;
  IF v_acao IS NULL OR v_acao NOT IN ('SEGUNDO_FATOR', 'REATIVAR') THEN
    RAISE EXCEPTION 'emergencia.acao deve ser SEGUNDO_FATOR ou REATIVAR';
  END IF;

  -- Contexto de auditoria (03 §5.3): ator vazio, canal SISTEMA, motivo obrigatório.
  PERFORM set_config('app.actor_user_id', '', true),
          set_config('app.actor_role', 'SISTEMA', true),
          set_config('app.source', 'SISTEMA', true),
          set_config('app.client_id', '', true),
          set_config('app.request_id', v_req::text, true),
          set_config('app.ip_address', '', true),
          set_config('app.reason', v_motivo, true);

  SELECT * INTO v_user FROM app_user WHERE email = v_email AND role = 'ADM';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nenhum ADM com este e-mail';
  END IF;
  SELECT coalesce(two_factor_enabled, false) INTO v_2fa FROM auth_user WHERE id = v_user.auth_user_id;

  IF v_acao = 'SEGUNDO_FATOR' THEN
    IF v_user.status <> 'ATIVO' THEN
      RAISE EXCEPTION 'o ADM está INATIVO: execute primeiro com emergencia.acao = REATIVAR';
    END IF;
    IF NOT v_2fa THEN
      RAISE EXCEPTION 'o ADM não tem segundo fator ativo: nada a redefinir (ele configura no próximo login)';
    END IF;
    -- Mesma linha que a redefinição pela TL-107 grava (auth_* não tem o trigger genérico, AF-04).
    INSERT INTO audit_log (actor_user_id, actor_role, source, action, table_name, record_id,
                           changed_fields, old_values, new_values, reason, request_id)
    VALUES (NULL, 'SISTEMA', 'SISTEMA', 'UPDATE', 'auth_user', v_user.auth_user_id,
            ARRAY['two_factor_enabled'], '{"two_factor_enabled": true}', '{"two_factor_enabled": false}',
            v_motivo, v_req);
    DELETE FROM auth_two_factor WHERE user_id = v_user.auth_user_id;
    UPDATE auth_user SET two_factor_enabled = false, updated_at = now() WHERE id = v_user.auth_user_id;
    DELETE FROM auth_session WHERE user_id = v_user.auth_user_id;
    INSERT INTO security_event (event_type, user_id, request_id)
    VALUES ('MFA_REMOVIDO', v_user.id, v_req), ('SESSAO_REVOGADA', v_user.id, v_req);
  ELSE
    IF v_user.status = 'ATIVO' THEN
      RAISE EXCEPTION 'o ADM já está ATIVO';
    END IF;
    -- app_user tem o trigger de auditoria: o motivo vai junto (app.reason).
    UPDATE app_user SET status = 'ATIVO', inactivated_at = NULL WHERE id = v_user.id;
    UPDATE auth_user SET banned = false, ban_reason = NULL, ban_expires = NULL, updated_at = now()
    WHERE id = v_user.auth_user_id;
  END IF;

  RAISE NOTICE 'concluído (request_id %)', v_req;
END $$;
COMMIT;
