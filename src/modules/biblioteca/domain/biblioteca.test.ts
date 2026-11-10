import { describe, expect, it } from "vitest";
import {
  deixariaSemGrupoAtivo,
  FORMATO_SIGLA,
  normalizarSigla,
  ordenarAtividades,
  podeExcluir,
  unidadeDaAtividade,
} from "./biblioteca";

describe("sigla da TAG (RN-040; E-03.1)", () => {
  it("normaliza para maiúsculas e aceita 2 a 5 letras", () => {
    expect(normalizarSigla(" spl ")).toBe("SPL");
    for (const s of ["SP", "SPL", "SPLIT"]) expect(FORMATO_SIGLA.test(s)).toBe(true);
    for (const s of ["S", "SPLITS", "SP1", "S-P", ""]) expect(FORMATO_SIGLA.test(s)).toBe(false);
  });
});

describe("unidade da atividade (RN-042; CA-08.1)", () => {
  it("MEDICAO sem unidade é recusada", () => {
    expect(unidadeDaAtividade("MEDICAO", "  ")).toMatchObject({
      ok: false,
      problema: { campo: "unidade" },
    });
    expect(unidadeDaAtividade("MEDICAO", null).ok).toBe(false);
  });
  it("MEDICAO guarda a unidade sem espaços; acima de 20 caracteres é recusada", () => {
    expect(unidadeDaAtividade("MEDICAO", " psi ")).toEqual({ ok: true, unidade: "psi" });
    expect(unidadeDaAtividade("MEDICAO", "x".repeat(21)).ok).toBe(false);
  });
  it("VERIFICACAO nunca tem unidade", () => {
    expect(unidadeDaAtividade("VERIFICACAO", "V")).toEqual({ ok: true, unidade: null });
  });
});

describe("ordem das atividades (RN-051)", () => {
  it("periodicidade MM→MA, depois a ordem de exibição, depois o título", () => {
    const r = ordenarAtividades([
      { periodicidade: "MA", ordem: 1, titulo: "Anual" },
      { periodicidade: "MM", ordem: 2, titulo: "B" },
      { periodicidade: "MT", ordem: 1, titulo: "Tri" },
      { periodicidade: "MM", ordem: 1, titulo: "Z" },
      { periodicidade: "MM", ordem: 2, titulo: "A" },
    ] as const);
    expect(r.map((a) => `${a.periodicidade}${a.ordem}${a.titulo}`)).toEqual([
      "MM1Z",
      "MM2A",
      "MM2B",
      "MT1Tri",
      "MA1Anual",
    ]);
  });
});

describe("excluir ou inativar (EL-4; RN-044)", () => {
  it("com uso só inativa; sem uso pode excluir", () => {
    expect(podeExcluir({ emUso: true })).toBe(false);
    expect(podeExcluir({ emUso: false })).toBe(true);
  });
});

describe("tipo ativo com pelo menos um grupo ativo (RN-040; E-03.2)", () => {
  const grupos = [
    { id: "a", ativo: true },
    { id: "b", ativo: false },
  ];
  it("tirar o último grupo ativo de tipo ativo é bloqueado", () => {
    expect(deixariaSemGrupoAtivo(true, grupos, "a")).toBe(true);
    expect(deixariaSemGrupoAtivo(true, grupos, "b")).toBe(false);
    expect(deixariaSemGrupoAtivo(true, [...grupos, { id: "c", ativo: true }], "a")).toBe(false);
  });
  it("tipo inativo não tem a exigência", () => {
    expect(deixariaSemGrupoAtivo(false, grupos, "a")).toBe(false);
  });
});
