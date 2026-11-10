/**
 * CNPJ numérico e alfanumérico (DM-13 [A VALIDAR]; CA-05.1, CA-05.2). Mesmo algoritmo de
 * `is_valid_cnpj` (db/migrations/0001): valor do caractere = código ASCII − 48; pesos 5…2/9…2 e 6…2/9…2;
 * DV = 0 se resto < 2, senão 11 − resto; rejeita os 14 caracteres iguais.
 */
export const normalizarCnpj = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function cnpjValido(c: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  const valor = (i: number) => c.charCodeAt(i) - 48;
  const dv = (pesos: number[]) => {
    const s = pesos.reduce((acc, p, i) => acc + valor(i) * p, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d1 = dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.slice(12) === `${d1}${d2}`;
}
