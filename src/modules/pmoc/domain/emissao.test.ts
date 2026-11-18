/** RN-007 (a)–(g), RN-008, RN-017; CA-12.1; E-08.3, E-08.4, E-08.5, E-08.9, E-08.10. */
import { describe, expect, it } from "vitest";
import { type RetratoParaEmissao, verificarPreCondicoes } from "./emissao";

const completo: RetratoParaEmissao = {
  empresaCadastrada: true,
  rtCadastrado: true,
  certificado: { tipo: "A1", estado: "VALIDO", dias: 300 },
  art: "ART-1",
  situacaoContrato: "VIGENTE",
  equipamentosAtivos: 3,
  atividadesNoPlano: 5,
};

const codigos = (r: RetratoParaEmissao) => verificarPreCondicoes(r).pendencias.map((p) => p.codigo);

describe("pré-condições da emissão (RN-007)", () => {
  it("tudo completo: sem pendências e sem aviso", () => {
    expect(verificarPreCondicoes(completo)).toEqual({
      pendencias: [],
      certificadoVenceEmDias: null,
    });
  });

  it("CA-12.1 / E-08.3: lista todos os faltantes de uma vez, na ordem da RN-007", () => {
    expect(
      codigos({
        empresaCadastrada: false,
        rtCadastrado: false,
        certificado: null,
        art: " ",
        situacaoContrato: "VIGENTE",
        equipamentosAtivos: 0,
        atividadesNoPlano: 0,
      }),
    ).toEqual(["EMPRESA", "RT", "CERTIFICADO_AUSENTE", "ART", "SEM_EQUIPAMENTO", "PLANO_VAZIO"]);
  });

  it("CA-12.1: contrato sem ART bloqueia e informa o campo", () => {
    expect(verificarPreCondicoes({ ...completo, art: null }).pendencias).toEqual([
      { codigo: "ART", mensagem: "Nº de ART do contrato", destino: "CONTRATO" },
    ]);
  });

  it("RN-008 / E-08.4: certificado vencido bloqueia", () => {
    const c = { tipo: "A1" as const, estado: "VENCIDO" as const, dias: 0 };
    expect(codigos({ ...completo, certificado: c })).toEqual(["CERTIFICADO_VENCIDO"]);
  });

  it("E-08.9: certificado a vencer emite, com aviso dos dias", () => {
    const c = { tipo: "A1" as const, estado: "A_VENCER" as const, dias: 12 };
    expect(verificarPreCondicoes({ ...completo, certificado: c })).toEqual({
      pendencias: [],
      certificadoVenceEmDias: 12,
    });
  });

  it("E-08.10: certificado A3 fica fora da emissão automática, sem aviso de vencimento", () => {
    const c = { tipo: "A3" as const, estado: "A_VENCER" as const, dias: 3 };
    expect(verificarPreCondicoes({ ...completo, certificado: c })).toEqual({
      pendencias: [expect.objectContaining({ codigo: "CERTIFICADO_A3" })],
      certificadoVenceEmDias: null,
    });
  });

  it.each(["ENCERRADO", "CANCELADO"] as const)("RN-017 / E-08.5: contrato %s não emite", (s) => {
    expect(codigos({ ...completo, situacaoContrato: s })).toEqual(["CONTRATO_ENCERRADO"]);
  });

  it.each(["A_INICIAR", "VIGENTE"] as const)("contrato %s emite", (s) => {
    expect(codigos({ ...completo, situacaoContrato: s })).toEqual([]);
  });
});
