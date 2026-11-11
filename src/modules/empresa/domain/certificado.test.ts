/** RF-04.4; RN-153; E-02.3, E-02.4, E-02.6. Certificados fictícios gerados no teste. */
import { describe, expect, it } from "vitest";
import { gerarPkcs12 } from "../../../../tests/fixtures/certificado";
import {
  diasParaVencer,
  ErroPkcs12,
  estadoDoCertificado,
  extensaoAceita,
  lerPkcs12,
  titularConfere,
} from "./certificado";

const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("estado do certificado (RN-153)", () => {
  const agora = dia("2026-11-11");
  it.each([
    ["2026-11-10", "VENCIDO"],
    ["2026-11-12", "A_VENCER"],
    ["2026-12-10", "A_VENCER"],
    ["2026-12-12", "VALIDO"],
  ])("válido até %s → %s", (ate, estado) => {
    expect(estadoDoCertificado(dia(ate), agora)).toBe(estado);
  });

  it("dias para vencer arredondam para cima e nunca ficam negativos", () => {
    expect(diasParaVencer(dia("2026-11-21"), agora)).toBe(10);
    expect(diasParaVencer(new Date("2026-11-11T13:00:00Z"), agora)).toBe(1);
    expect(diasParaVencer(dia("2026-11-01"), agora)).toBe(0);
  });
});

describe("leitura do PKCS#12 (FL-02 passo 5)", () => {
  const validoDe = dia("2026-01-01");
  const validoAte = dia("2027-01-01");

  it("lê titular (sem o CPF), série, emissor e validade", () => {
    const p12 = gerarPkcs12({ nome: "José da Conceição", senha: "s3nha", validoDe, validoAte });
    const c = lerPkcs12(p12, "s3nha");
    expect(c).toMatchObject({
      titular: "José da Conceição",
      serie: "0A1B2C3D",
      emissor: "AC Teste PMOC",
    });
    expect(c.validoDe.toISOString()).toBe(validoDe.toISOString());
    expect(c.validoAte.toISOString()).toBe(validoAte.toISOString());
  });

  it("E-02.3: senha errada", () => {
    const p12 = gerarPkcs12({ nome: "Rui", senha: "certa", validoDe, validoAte });
    expect(() => lerPkcs12(p12, "errada")).toThrow(new ErroPkcs12("SENHA"));
  });

  it("E-02.4: arquivo que não é PKCS#12, ou sem chave privada", () => {
    expect(() => lerPkcs12(Buffer.from("não sou certificado"), "x")).toThrow(
      new ErroPkcs12("INVALIDO"),
    );
    const semChave = gerarPkcs12({ nome: "Rui", senha: "x", validoDe, validoAte, semChave: true });
    expect(() => lerPkcs12(semChave, "x")).toThrow(new ErroPkcs12("INVALIDO"));
  });

  it("extensões aceitas (SEG-51)", () => {
    expect(extensaoAceita("rt.PFX")).toBe(true);
    expect(extensaoAceita("rt.p12")).toBe(true);
    expect(extensaoAceita("rt.pem")).toBe(false);
  });
});

describe("titular x RT cadastrado (E-02.6)", () => {
  it("ignora acento, caixa e espaços; nome diferente não confere", () => {
    expect(titularConfere("JOSE DA CONCEICAO", " José  da Conceição ")).toBe(true);
    expect(titularConfere("MARIA SILVA", "José da Conceição")).toBe(false);
  });
});
