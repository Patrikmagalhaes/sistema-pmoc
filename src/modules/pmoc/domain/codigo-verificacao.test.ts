/** RN-187, INT-14: código de verificação de 128 bits. */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  codigoDeBytes,
  codigoImpresso,
  normalizarCodigo,
  TAMANHO_CODIGO,
} from "./codigo-verificacao";

describe("código de verificação", () => {
  it("128 bits → 26 caracteres de Crockford, sem I, L, O, U", () => {
    for (let i = 0; i < 200; i++) {
      const c = codigoDeBytes(randomBytes(16));
      expect(c).toHaveLength(TAMANHO_CODIGO);
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    }
  });

  it("vetores conhecidos: só zeros e só uns", () => {
    expect(codigoDeBytes(new Uint8Array(16))).toBe("0".repeat(26));
    // 125 bits em 25 "Z"; os 3 últimos (111) completados com 00 → 11100 = 28 → "W".
    expect(codigoDeBytes(new Uint8Array(16).fill(255))).toBe(`${"Z".repeat(25)}W`);
  });

  it("bytes diferentes → códigos diferentes", () => {
    const a = new Uint8Array(16);
    const b = new Uint8Array(16);
    b[15] = 1;
    expect(codigoDeBytes(a)).not.toBe(codigoDeBytes(b));
  });

  it("recusa tamanho diferente de 16 bytes", () => {
    expect(() => codigoDeBytes(new Uint8Array(15))).toThrow();
  });

  it("impresso em grupos de 4 e de volta pelo que se digita (TL-007)", () => {
    const c = codigoDeBytes(randomBytes(16));
    const impresso = codigoImpresso(c);
    expect(impresso).toMatch(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
    expect(normalizarCodigo(impresso)).toBe(c);
    expect(normalizarCodigo(` ${impresso.toLowerCase()} `)).toBe(c);
  });

  it("trocas de Crockford e entradas inválidas", () => {
    expect(normalizarCodigo(`O${"1".repeat(24)}L`)).toBe(`0${"1".repeat(25)}`);
    expect(normalizarCodigo("curto")).toBeNull();
    expect(normalizarCodigo(`U${"0".repeat(25)}`)).toBeNull();
  });
});
