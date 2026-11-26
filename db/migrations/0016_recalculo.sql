-- Etapa 4 – recálculo do cronograma depois da emissão (RN-015, RN-032, RN-065 a RN-068, RN-183,
-- RN-184). Triggers de transição que o recálculo passa a usar (doc 07: entram na etapa do módulo que
-- os usa). Sem mudança de estado, nada a conferir.

-- Doc 02 §7.4: transições da ocorrência. `OK`/`NOK` nunca voltam para `PREVISTA`/`PENDENTE` (RN-149).
CREATE FUNCTION trg_occurrence_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
       (OLD.status = 'PREVISTA' AND NEW.status IN ('PENDENTE', 'OK', 'NOK', 'NAO_PREVISTA')) -- RN-029, RN-086, RN-032
    OR (OLD.status = 'PENDENTE' AND NEW.status IN ('OK', 'NOK', 'NAO_PREVISTA'))         -- RN-086, RN-091
    OR (OLD.status IN ('OK', 'NOK') AND NEW.status IN ('OK', 'NOK'))                      -- RN-090, RN-092
    OR (OLD.status = 'NAO_PREVISTA' AND NEW.status = 'PREVISTA')                          -- RN-184
  ) THEN
    RAISE EXCEPTION 'transição de ocorrência não permitida: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514', CONSTRAINT = 'occurrence_status_transition';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER occurrence_status BEFORE UPDATE OF status ON occurrence
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_occurrence_status();

-- Doc 02 §7.5: transições da visita. `CANCELADA` e `REGISTRADA` não voltam (RN-151).
CREATE FUNCTION trg_visit_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
       (OLD.status = 'A_AGENDAR' AND NEW.status = 'AGENDADA')                     -- RN-069
    OR (OLD.status = 'AGENDADA' AND NEW.status = 'EM_ANDAMENTO')                  -- RN-080
    OR (OLD.status = 'EM_ANDAMENTO' AND NEW.status = 'REGISTRADA')                -- RN-086, RN-090
    OR (OLD.status IN ('A_AGENDAR', 'AGENDADA') AND NEW.status IN ('CANCELADA', 'REGISTRADA')) -- RN-065, RN-070, RN-076, RN-090
  ) THEN
    RAISE EXCEPTION 'transição de visita não permitida: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514', CONSTRAINT = 'visit_status_transition';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER visit_status BEFORE UPDATE OF status ON visit
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_visit_status();

-- 03 §2.8 `visit` [L]: exclusão lógica só de visita `A_AGENDAR` (a esvaziada pelo recálculo, RN-065).
CREATE FUNCTION trg_visit_soft_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'A_AGENDAR' THEN
    RAISE EXCEPTION 'só visita A_AGENDAR pode ser excluída (03 §2.8, RN-065)'
      USING ERRCODE = '23514', CONSTRAINT = 'visit_soft_delete';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER visit_soft_delete BEFORE UPDATE OF deleted_at ON visit
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION trg_visit_soft_delete();
