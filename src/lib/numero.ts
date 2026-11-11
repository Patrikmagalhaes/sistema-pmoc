/**
 * Número decimal digitado em pt-BR (UF-03): "12.000", "12000", "1,5", "12.000,50" e "1.5".
 * Com vírgula, ela é a decimal e os pontos são de milhar; sem vírgula, pontos em grupos de 3
 * ("12.000") são de milhar e um ponto solto é a decimal. Vazio → `null`; inválido ou com mais de
 * `casas` decimais → `NaN`.
 */
export function lerDecimal(v: string | null | undefined, casas = 2): number | null {
  const s = (v ?? "").replace(/\s/g, "");
  if (s === "") return null;
  let normal: string;
  if (s.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d+$|^\d+,\d+$/.test(s)) return Number.NaN;
    normal = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normal = s.replace(/\./g, "");
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    normal = s;
  } else {
    return Number.NaN;
  }
  const [, decimais = ""] = normal.split(".");
  return decimais.length > casas ? Number.NaN : Number(normal);
}

/** Valor para um campo de edição (sem milhar, vírgula decimal): 12000.5 → "12000,5". */
export const decimalParaCampo = (n: number | string | null | undefined): string =>
  n === null || n === undefined || n === ""
    ? ""
    : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false });
