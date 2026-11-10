import { describe, expect, it } from "vitest";
import { cnpjValido, normalizarCnpj } from "./cnpj";
import { enderecoSchema, telefoneOpcional } from "./endereco";
import { mascararCep, mascararCnpj } from "./formato";

describe("CNPJ (RF-05; DM-13; CA-05.1, CA-05.2)", () => {
  it("aceita numérico e alfanumérico com dígitos corretos", () => {
    expect(cnpjValido("12345678000195")).toBe(true);
    expect(cnpjValido(normalizarCnpj("12.abc.345/01de-35"))).toBe(true); // exemplo alfanumérico
  });
  it("CA-05.1: 13 dígitos é recusado", () => {
    expect(cnpjValido(normalizarCnpj("28.474.019/0001-9"))).toBe(false);
  });
  it("CA-05.2: CPF válido no campo CNPJ é recusado", () => {
    expect(cnpjValido("52998224725")).toBe(false);
  });
  it("dígito errado e caracteres todos iguais são recusados", () => {
    expect(cnpjValido("12345678000196")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });
  it("máscara só na exibição (RF-05.5)", () => {
    expect(mascararCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(mascararCnpj("1234")).toBe("12.34");
    expect(mascararCep("01001000")).toBe("01001-000");
  });
});

describe("endereço (UF-04; CA-05.3, CA-05.4)", () => {
  const base = {
    logradouro: "Rua A",
    numero: "10",
    semNumero: false,
    cidade: "São Paulo",
    uf: "SP",
    cep: "01001-000",
  };
  const s = enderecoSchema({ bairroObrigatorio: false });

  it("grava o CEP sem máscara", () => {
    expect(s.parse(base).cep).toBe("01001000");
  });
  it("CA-05.3: CEP com 7 dígitos é recusado", () => {
    expect(s.safeParse({ ...base, cep: "88.020-30" }).success).toBe(false);
  });
  it("CA-05.4: s/n dispensa e descarta o número; sem número e sem s/n é recusado", () => {
    expect(s.parse({ ...base, numero: "99", semNumero: true }).numero).toBeNull();
    const r = s.safeParse({ ...base, numero: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["numero"]);
  });
  it("bairro obrigatório só quando pedido (empresa e RT)", () => {
    expect(s.safeParse(base).success).toBe(true);
    expect(enderecoSchema({ bairroObrigatorio: true }).safeParse(base).success).toBe(false);
  });
  it("UF fora da lista das 27 é recusada", () => {
    expect(s.safeParse({ ...base, uf: "XX" }).success).toBe(false);
  });
  it("telefone opcional: 10 ou 11 dígitos, gravado sem máscara", () => {
    expect(telefoneOpcional.parse("(11) 3333-4444")).toBe("1133334444");
    expect(telefoneOpcional.parse("")).toBeNull();
    expect(telefoneOpcional.safeParse("12345").success).toBe(false);
  });
});
