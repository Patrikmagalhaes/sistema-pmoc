import { describe, expect, it } from "vitest";
import { acompanharRecalculo, type VisitaDoPmoc } from "./recalculo";

const visita = (
  id: string,
  indice: number,
  estado: VisitaDoPmoc["estado"],
  ocorrencias: string[],
  data: string | null = null,
): VisitaDoPmoc => ({ id, indice, estado, data, ocorrencias });

const entra = (chave: string, indice: number) => ({
  chave,
  indice,
  referencia: `2026-${String(indice).padStart(2, "0")}-01`,
});

describe("acompanharRecalculo (RN-065, RN-066)", () => {
  it("sem mudança no cronograma → nada muda nas visitas", () => {
    const r = acompanharRecalculo([visita("v7", 7, "A_AGENDAR", ["o1"])], [], []);
    expect(r).toEqual({ retirar: [], incluir: [], novas: [], excluir: [], cancelar: [] });
  });

  it("RN-065: ocorrência que saiu é retirada da visita não iniciada", () => {
    const r = acompanharRecalculo(
      [visita("v7", 7, "A_AGENDAR", ["o1", "o2"]), visita("v8", 8, "AGENDADA", ["o3", "o4"])],
      ["o2", "o3"],
      [],
    );
    expect(r.retirar).toEqual([
      { visitaId: "v7", ocorrenciaId: "o2" },
      { visitaId: "v8", ocorrenciaId: "o3" },
    ]);
    expect(r.excluir).toEqual([]);
    expect(r.cancelar).toEqual([]);
  });

  it("RN-065: ocorrência nova entra na visita não iniciada do mês", () => {
    const r = acompanharRecalculo([visita("v7", 7, "AGENDADA", ["o1"])], [], [entra("n1", 7)]);
    expect(r.incluir).toEqual([{ visitaId: "v7", chave: "n1" }]);
    expect(r.novas).toEqual([]);
  });

  it("RN-065: mês sem visita não iniciada → uma visita A_AGENDAR nova por mês", () => {
    const r = acompanharRecalculo(
      [visita("v7", 7, "EM_ANDAMENTO", ["o1"]), visita("v9", 9, "REGISTRADA", ["o2"])],
      [],
      [entra("n1", 9), entra("n2", 7), entra("n3", 9)],
    );
    expect(r.incluir).toEqual([]);
    expect(r.novas).toEqual([
      { indice: 7, referencia: "2026-07-01", chaves: ["n2"] },
      { indice: 9, referencia: "2026-09-01", chaves: ["n1", "n3"] },
    ]);
  });

  it("RN-065: visita cancelada não recebe ocorrência nova", () => {
    const r = acompanharRecalculo([visita("v7", 7, "CANCELADA", [])], [], [entra("n1", 7)]);
    expect(r.novas.map((n) => n.indice)).toEqual([7]);
  });

  it("RN-065: com duas visitas não iniciadas no mês, a nova ocorrência vai para a criada primeiro", () => {
    const r = acompanharRecalculo(
      [visita("v7a", 7, "AGENDADA", ["o1"]), visita("v7b", 7, "A_AGENDAR", ["o2"])],
      [],
      [entra("n1", 7)],
    );
    expect(r.incluir).toEqual([{ visitaId: "v7a", chave: "n1" }]);
  });

  it("RN-065: A_AGENDAR que fica vazia é excluída; AGENDADA vazia é cancelada com a data", () => {
    const r = acompanharRecalculo(
      [
        visita("v7", 7, "A_AGENDAR", ["o1"]),
        visita("v8", 8, "AGENDADA", ["o2", "o3"], "2026-08-12"),
      ],
      ["o1", "o2", "o3"],
      [],
    );
    expect(r.excluir).toEqual(["v7"]);
    expect(r.cancelar).toEqual([{ visitaId: "v8", data: "2026-08-12" }]);
  });

  it("RN-065: visita que perde e ganha no mesmo recálculo não fica vazia", () => {
    const r = acompanharRecalculo(
      [visita("v7", 7, "AGENDADA", ["o1"], "2026-07-10")],
      ["o1"],
      [entra("n1", 7)],
    );
    expect(r.retirar).toEqual([{ visitaId: "v7", ocorrenciaId: "o1" }]);
    expect(r.incluir).toEqual([{ visitaId: "v7", chave: "n1" }]);
    expect(r.cancelar).toEqual([]);
    expect(r.excluir).toEqual([]);
  });

  it("RN-066: visita EM_ANDAMENTO ou REGISTRADA não perde ocorrência", () => {
    const r = acompanharRecalculo(
      [visita("v7", 7, "EM_ANDAMENTO", ["o1"]), visita("v8", 8, "REGISTRADA", ["o2"])],
      ["o1", "o2"],
      [],
    );
    expect(r).toEqual({ retirar: [], incluir: [], novas: [], excluir: [], cancelar: [] });
  });

  it("visita não iniciada que já estava vazia não é tocada", () => {
    const r = acompanharRecalculo([visita("v7", 7, "A_AGENDAR", [])], ["o9"], []);
    expect(r.excluir).toEqual([]);
  });
});
