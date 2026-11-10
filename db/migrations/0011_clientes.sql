-- Etapa 3 – clientes e locais (03 §2.3; RF-06). Triggers de regra do módulo (doc 07).

-- DM-19 [A VALIDAR]: código do local por sequência global, 'L' || 3 dígitos (L001, L002… L999, L1000).
-- O `lpad` sozinho cortaria L1000 para L100, por isso o CASE.
CREATE SEQUENCE site_code_seq;

CREATE FUNCTION trg_site_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  -- O código vem sempre do sistema (RF-06.3). Só o seed de desenvolvimento informa um código fixo.
  IF NEW.code IS NULL THEN
    LOOP
      n := nextval('site_code_seq');
      NEW.code := 'L' || CASE WHEN n < 1000 THEN lpad(n::text, 3, '0') ELSE n::text END;
      -- único em toda a tabela, inclusive excluídos (EL-6); pula códigos já usados
      EXIT WHEN NOT EXISTS (SELECT 1 FROM site WHERE code = NEW.code);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER site_code BEFORE INSERT ON site FOR EACH ROW EXECUTE FUNCTION trg_site_code();

-- RN-047 (CA-06.2): o código nunca muda depois de gravado.
CREATE FUNCTION trg_site_code_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'o código do local é imutável (RN-047)'
      USING ERRCODE = '23514', CONSTRAINT = 'site_code_immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER site_code_immutable BEFORE UPDATE OF code ON site
  FOR EACH ROW EXECUTE FUNCTION trg_site_code_immutable();
