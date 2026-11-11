-- Etapa 3 – equipamentos e TAG (03 §2.5; RF-09). Triggers de regra do módulo (doc 07).

-- RN-046 (CA-09.1, CA-09.2): TAG = {código do local}-{sigla do tipo}-{sequencial de 3 dígitos}.
-- O sequencial vem do contador por local + tipo, na mesma transação do INSERT (03 §2.5). A linha do
-- contador serializa inclusões concorrentes do mesmo par, e o número nunca volta: nem com o
-- equipamento inativo ou excluído, nem com a transação desfeita (aí o contador volta junto).
CREATE FUNCTION trg_equipment_tag() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  -- A TAG vem sempre do sistema. Só o seed de desenvolvimento informa uma TAG fixa (com o contador).
  IF NEW.tag IS NULL THEN
    INSERT INTO equipment_tag_counter AS c (site_id, equipment_type_id, last_sequence)
      VALUES (NEW.site_id, NEW.equipment_type_id, 1)
      ON CONFLICT (site_id, equipment_type_id) DO UPDATE SET last_sequence = c.last_sequence + 1
      RETURNING last_sequence INTO n;
    -- E-07.6 [A VALIDAR]: acima de 999 (03 §8, RN-046).
    IF n > 999 THEN
      RAISE EXCEPTION 'limite de TAGs do tipo no local (RN-046)'
        USING ERRCODE = '23514', CONSTRAINT = 'equipment_tag_limit';
    END IF;
    NEW.tag_sequence := n;
    NEW.tag := (SELECT code FROM site WHERE id = NEW.site_id) || '-'
      || (SELECT acronym FROM equipment_type WHERE id = NEW.equipment_type_id) || '-'
      || lpad(n::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER equipment_tag BEFORE INSERT ON equipment FOR EACH ROW EXECUTE FUNCTION trg_equipment_tag();

-- RN-046 e 03 §2.5: local, TAG e sequencial nunca mudam. O tipo também não: a TAG leva a sigla dele
-- e não muda (RN-049) [A VALIDAR] (04 TL-111, notas da Etapa 3).
-- RN-048: equipamento com ocorrência registrada não é excluído, só inativado.
CREATE FUNCTION trg_equipment_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tag IS DISTINCT FROM OLD.tag OR NEW.tag_sequence IS DISTINCT FROM OLD.tag_sequence
     OR NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    RAISE EXCEPTION 'local e TAG do equipamento são imutáveis (RN-046)'
      USING ERRCODE = '23514', CONSTRAINT = 'equipment_tag_immutable';
  END IF;
  IF NEW.equipment_type_id IS DISTINCT FROM OLD.equipment_type_id THEN
    RAISE EXCEPTION 'o tipo do equipamento não muda (RN-049)'
      USING ERRCODE = '23514', CONSTRAINT = 'equipment_type_locked';
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND EXISTS (
       SELECT 1 FROM occurrence o JOIN occurrence_record r ON r.occurrence_id = o.id
        WHERE o.equipment_id = OLD.id) THEN
    RAISE EXCEPTION 'equipamento com registro não é excluído, só inativado (RN-048)'
      USING ERRCODE = '23514', CONSTRAINT = 'equipment_has_records';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER equipment_rules BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION trg_equipment_rules();
