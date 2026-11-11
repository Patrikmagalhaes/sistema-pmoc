/** Decimal digitado em pt-BR (UF-03), usado na capacidade do equipamento (RF-09.3; E-07.3). */
import { describe, expect, it } from "vitest";
import { decimalParaCampo, lerDecimal } from "./numero";

describe("lerDecimal", () => {
  it.each([
    ["12000", 12000],
    ["12.000", 12000],
    ["1.234.567", 1234567],
    ["12.000,50", 12000.5],
    ["1,5", 1.5],
    ["1.5", 1.5],
    [" 9 000 ", 9000],
    ["0", 0],
  ])("%s → %d", (v, n) => {
    expect(lerDecimal(v)).toBe(n);
  });

  it("vazio é nulo", () => {
    expect(lerDecimal("")).toBeNull();
    expect(lerDecimal("  ")).toBeNull();
    expect(lerDecimal(null)).toBeNull();
    expect(lerDecimal(undefined)).toBeNull();
  });

  it.each(["abc", "1,2,3", "12.00,5", "-5", "1e3", "1,234", "1.234,567", ","])(
    "%s é inválido (NaN)",
    (v) => {
      expect(lerDecimal(v)).toBeNaN();
    },
  );

  it("o limite de casas é configurável", () => {
    expect(lerDecimal("1,234", 3)).toBe(1.234);
  });
});

describe("exibição", () => {
  it("no campo de edição, sem milhar e com vírgula", () => {
    expect(decimalParaCampo("12000.50")).toBe("12000,5");
    expect(decimalParaCampo(null)).toBe("");
  });
});
