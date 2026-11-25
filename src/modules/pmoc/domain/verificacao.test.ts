import { describe, expect, it } from "vitest";
import { LIMITE_VERIFICACAO_POR_IP, situacaoVerificada } from "./verificacao";

describe("TL-007: situação da versão verificada (INT-14; VP-2)", () => {
  it("versão atual aguardando assinatura é vigente", () => {
    expect(situacaoVerificada("AGUARDANDO_ASSINATURA", true)).toBe("VIGENTE");
  });

  it("versão substituída sem assinatura", () => {
    expect(situacaoVerificada("SUBSTITUIDA", false)).toBe("SUBSTITUIDO");
  });

  it("assinada e atual; assinada e depois trocada por versão mais nova", () => {
    expect(situacaoVerificada("ASSINADO_CLIENTE", true)).toBe("ASSINADO");
    expect(situacaoVerificada("ASSINADO_CLIENTE", false)).toBe("ASSINADO_SUBSTITUIDO");
  });

  it("aguardando assinatura mas não atual (estado que o trigger não deixa existir) conta como substituída", () => {
    expect(situacaoVerificada("AGUARDANDO_ASSINATURA", false)).toBe("SUBSTITUIDO");
  });
});

describe("INT-14 / AF-09: limite de consultas", () => {
  it("30 por hora por IP", () => {
    expect(LIMITE_VERIFICACAO_POR_IP).toEqual({ janelaMs: 3_600_000, max: 30 });
  });
});
