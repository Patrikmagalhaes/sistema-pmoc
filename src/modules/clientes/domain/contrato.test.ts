import { describe, expect, it } from "vitest";
import {
  dataValida,
  diaSeguinte,
  estadoPorDatas,
  hojeEmSaoPaulo,
  mesesDoContrato,
  podeCancelar,
  podeRenovar,
} from "./contrato";

describe("estado derivado das datas (RN-142)", () => {
  it("antes do início A_INICIAR; entre início e fim VIGENTE (inclusive); depois ENCERRADO", () => {
    expect(estadoPorDatas("2027-01-01", "2027-12-31", "2026-12-31")).toBe("A_INICIAR");
    expect(estadoPorDatas("2027-01-01", "2027-12-31", "2027-01-01")).toBe("VIGENTE");
    expect(estadoPorDatas("2027-01-01", "2027-12-31", "2027-12-31")).toBe("VIGENTE");
    expect(estadoPorDatas("2027-01-01", "2027-12-31", "2028-01-01")).toBe("ENCERRADO");
  });
  it("hoje vem do fuso America/Sao_Paulo, não do UTC", () => {
    // 02:00 UTC de 1º/jan ainda é 31/dez em São Paulo (UTC−3)
    expect(hojeEmSaoPaulo(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12-31");
    expect(hojeEmSaoPaulo(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
});

describe("número de meses (RN-022)", () => {
  it("conta o mês de início e o de fim, mesmo parciais", () => {
    expect(mesesDoContrato("2027-01-01", "2027-12-31")).toBe(12);
    expect(mesesDoContrato("2027-01-15", "2028-07-14")).toBe(19);
    expect(mesesDoContrato("2027-03-31", "2027-04-01")).toBe(2);
  });
});

describe("datas", () => {
  it("rejeita data inexistente; dia seguinte vira mês e ano", () => {
    expect(dataValida("2027-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("31/12/2027")).toBe(false);
    expect(diaSeguinte("2027-12-31")).toBe("2028-01-01");
    expect(diaSeguinte("2028-02-28")).toBe("2028-02-29");
  });
});

describe("ações por estado (RN-144; RF-15; decisão R2 2.6)", () => {
  it("cancela só A_INICIAR e VIGENTE", () => {
    expect(podeCancelar("A_INICIAR")).toBe(true);
    expect(podeCancelar("VIGENTE")).toBe(true);
    expect(podeCancelar("ENCERRADO")).toBe(false);
    expect(podeCancelar("CANCELADO")).toBe(false);
  });
  it("renova VIGENTE ou ENCERRADO sem contrato posterior", () => {
    expect(podeRenovar("VIGENTE", false)).toBe(true);
    expect(podeRenovar("ENCERRADO", false)).toBe(true);
    expect(podeRenovar("VIGENTE", true)).toBe(false);
    expect(podeRenovar("A_INICIAR", false)).toBe(false);
    expect(podeRenovar("CANCELADO", false)).toBe(false);
  });
});
