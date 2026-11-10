-- Etapa 3 – biblioteca (03 §2.4; RF-08). Trigger de regra do módulo (doc 07: entram na etapa que os usa).

-- 03 `equipment_type.acronym`: imutável depois que existir equipamento do tipo (inferido de RN-046; E-03.4).
-- Conta equipamentos excluídos e inativos também: a TAG gravada nunca muda.
CREATE FUNCTION trg_equipment_type_acronym_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.acronym IS DISTINCT FROM OLD.acronym
     AND EXISTS (SELECT 1 FROM equipment e WHERE e.equipment_type_id = OLD.id) THEN
    RAISE EXCEPTION 'a sigla compõe as TAGs e não pode mudar (tipo com equipamento)'
      USING ERRCODE = '23514', CONSTRAINT = 'equipment_type_acronym_locked';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER equipment_type_acronym_locked BEFORE UPDATE OF acronym ON equipment_type
  FOR EACH ROW EXECUTE FUNCTION trg_equipment_type_acronym_locked();
