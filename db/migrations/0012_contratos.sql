-- Etapa 3 – contratos (03 §2.3, §4.2; RF-07). Triggers de regra do módulo (doc 07).

-- RN-014 / A5: PMOC em RASCUNHO também vira HISTORICO (nunca emitido, sem versão). O CHECK da 0003
-- exigia versão em todo estado fora de RASCUNHO; o doc 03 só diz "NULL em RASCUNHO; preenchido a
-- partir da 1ª emissão". Troca pelo CHECK que aceita HISTORICO sem versão.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'pmoc'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%current_version_number IS NOT NULL%';
  EXECUTE format('ALTER TABLE pmoc DROP CONSTRAINT %I', c);
END $$;
ALTER TABLE pmoc ADD CONSTRAINT pmoc_version_when_issued
  CHECK (status IN ('RASCUNHO', 'HISTORICO') OR current_version_number IS NOT NULL);

-- 03 §4.2 e doc 02 §7.2:
-- * `CANCELADO` é final: o contrato cancelado não muda mais (E-06.7).
-- * `ENCERRADO` não pode ser cancelado (RN-144; decisão R2 2.6).
-- * RN-145: datas imutáveis depois da 1ª emissão do PMOC (`first_issued_at`).
CREATE FUNCTION trg_contract_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELADO' THEN
    RAISE EXCEPTION 'contrato cancelado não pode ser alterado'
      USING ERRCODE = '23514', CONSTRAINT = 'contract_cancelled_final';
  END IF;
  IF NEW.status = 'CANCELADO' AND OLD.status NOT IN ('A_INICIAR', 'VIGENTE') THEN
    RAISE EXCEPTION 'só contrato A_INICIAR ou VIGENTE pode ser cancelado'
      USING ERRCODE = '23514', CONSTRAINT = 'contract_cancel_status';
  END IF;
  IF (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date)
     AND EXISTS (SELECT 1 FROM pmoc p WHERE p.contract_id = OLD.id AND p.first_issued_at IS NOT NULL) THEN
    RAISE EXCEPTION 'datas do contrato travadas após a emissão do PMOC (RN-145)'
      USING ERRCODE = '23514', CONSTRAINT = 'contract_dates_locked';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER contract_rules BEFORE UPDATE ON contract
  FOR EACH ROW EXECUTE FUNCTION trg_contract_rules();
