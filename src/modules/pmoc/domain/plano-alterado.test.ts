import { describe, expect, it } from "vitest";
import { planoAlteradoDesdeAVersao, planoComparavel } from "./plano-alterado";

const plano = [
  { id: "a1", tipoId: "t1", periodicidade: "MT", removida: false },
  { id: "a2", tipoId: "t1", periodicidade: "MM", removida: false },
  { id: "a3", tipoId: "t2", periodicidade: "MS", removida: false },
];
const ativos = [
  { id: "e1", tipoId: "t1" },
  { id: "e2", tipoId: "t1" },
];
const retrato = { atividades: ["a1:MT", "a2:MM"], equipamentos: ["e1", "e2"] };

describe("planoComparavel (FL-09 passo 4)", () => {
  it("deixa de fora as removidas e as dos tipos sem equipamento ativo, como o retrato", () => {
    const p = planoComparavel(
      [...plano, { id: "a4", tipoId: "t1", periodicidade: "MA", removida: true }],
      ativos,
    );
    expect(p).toEqual(retrato);
  });
});

describe("planoAlteradoDesdeAVersao (D-07 a; RN-015)", () => {
  it("igual ao retrato, em qualquer ordem: sem faixa", () => {
    expect(
      planoAlteradoDesdeAVersao(retrato, {
        atividades: ["a2:MM", "a1:MT"],
        equipamentos: ["e2", "e1"],
      }),
    ).toBe(false);
  });

  it.each([
    ["periodicidade mudou", { atividades: ["a1:MS", "a2:MM"], equipamentos: ["e1", "e2"] }],
    ["atividade saiu", { atividades: ["a1:MT"], equipamentos: ["e1", "e2"] }],
    ["atividade entrou", { atividades: ["a1:MT", "a2:MM", "a5:MA"], equipamentos: ["e1", "e2"] }],
    ["equipamento inativado", { atividades: ["a1:MT", "a2:MM"], equipamentos: ["e1"] }],
    ["equipamento incluído", { atividades: ["a1:MT", "a2:MM"], equipamentos: ["e1", "e2", "e3"] }],
  ])("%s: mostra a faixa", (_, atual) => {
    expect(planoAlteradoDesdeAVersao(retrato, atual)).toBe(true);
  });

  it("voltar ao que estava no PDF apaga a faixa", () => {
    const mudou = planoComparavel(
      plano.map((a) => (a.id === "a1" ? { ...a, periodicidade: "MS" } : a)),
      ativos,
    );
    expect(planoAlteradoDesdeAVersao(retrato, mudou)).toBe(true);
    expect(planoAlteradoDesdeAVersao(retrato, planoComparavel(plano, ativos))).toBe(false);
  });
});
