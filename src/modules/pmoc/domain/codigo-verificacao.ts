/**
 * Código de verificação dos PDFs (RN-187; 06 INT-14; decisões B7 e D6): aleatório de 128 bits,
 * `pmoc_version.verification_code` `UNIQUE`.
 *
 * Formato `[A VALIDAR]` (os docs fixam só os 128 bits): Base32 de Crockford (sem I, L, O e U, que se
 * confundem com 1 e 0), 26 caracteres. Gravado assim, sem hífen; impresso em grupos de 4 para leitura.
 * A TL-007 aceita o código digitado com hífen, espaço ou minúscula (`normalizarCodigo`).
 */

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TAMANHO_CODIGO = 26;

/** 16 bytes aleatórios → 26 caracteres (128 bits em grupos de 5, o último com 3 bits). */
export function codigoDeBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error("O código de verificação usa 16 bytes (128 bits).");
  let bits = 0;
  let acumulado = 0;
  let r = "";
  for (const b of bytes) {
    acumulado = (acumulado << 8) | b;
    bits += 8;
    while (bits >= 5) {
      r += ALFABETO[(acumulado >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acumulado &= (1 << bits) - 1;
  }
  if (bits > 0) r += ALFABETO[(acumulado << (5 - bits)) & 31];
  return r;
}

/** Para o rodapé do PDF: `ABCD-EFGH-…` (o último grupo com 2). */
export const codigoImpresso = (c: string) => c.match(/.{1,4}/g)?.join("-") ?? c;

/**
 * O que a pessoa digitou → código gravado, ou `null` se não pode ser um código. Aceita hífen, espaço,
 * minúscula e as trocas de Crockford (O→0, I/L→1).
 */
export function normalizarCodigo(digitado: string): string | null {
  const c = digitado.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return c.length === TAMANHO_CODIGO && [...c].every((x) => ALFABETO.includes(x)) ? c : null;
}
