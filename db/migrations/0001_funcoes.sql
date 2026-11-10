-- Funções puras usadas por CHECKs (03 §4.1, §2.3).

-- RN-020: intervalo k da periodicidade.
CREATE FUNCTION periodicity_months(p text) RETURNS smallint
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE p WHEN 'MM' THEN 1 WHEN 'MB' THEN 2 WHEN 'MT' THEN 3 WHEN 'MS' THEN 6 WHEN 'MA' THEN 12 END::smallint
$$;

-- CA-05.1 / DM-13 [A VALIDAR]: CNPJ numérico e alfanumérico. Valor do caractere = código ASCII - 48;
-- pesos 5,4,3,2,9,8,7,6,5,4,3,2 (1º DV) e 6,5,4,3,2,9,8,7,6,5,4,3,2 (2º DV); DV = 0 se resto < 2, senão 11 - resto.
-- Rejeita os 14 caracteres iguais (regra usual do CNPJ numérico) [A VALIDAR].
CREATE FUNCTION is_valid_cnpj(c text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; i int; d1 int; d2 int;
BEGIN
  IF c IS NULL OR c !~ '^[0-9A-Z]{12}[0-9]{2}$' OR c ~ '^(.)\1{13}$' THEN
    RETURN false;
  END IF;
  s := 0;
  FOR i IN 1..12 LOOP s := s + (ascii(substr(c, i, 1)) - 48) * w1[i]; END LOOP;
  d1 := CASE WHEN s % 11 < 2 THEN 0 ELSE 11 - s % 11 END;
  s := 0;
  FOR i IN 1..12 LOOP s := s + (ascii(substr(c, i, 1)) - 48) * w2[i]; END LOOP;
  s := s + d1 * w2[13];
  d2 := CASE WHEN s % 11 < 2 THEN 0 ELSE 11 - s % 11 END;
  RETURN substr(c, 13, 2) = d1::text || d2::text;
END $$;
