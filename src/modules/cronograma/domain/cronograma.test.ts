import { describe, expect, it } from "vitest";
import {
  type AtividadeDoPlano,
  buildSchedule,
  type EquipamentoDoCronograma,
  indiceDoMes,
  mesesDoCronograma,
  mesesPrevistos,
  type OcorrenciaExistente,
  primeiroMesRecalculavel,
  recalcularCronograma,
} from "./cronograma";

describe("mesesPrevistos (RN-023 a RN-025)", () => {
  it.each([
    ["MM", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ["MB", [1, 3, 5, 7, 9, 11]],
    ["MT", [1, 4, 7, 10]],
    ["MS", [1, 7]],
    ["MA", [1]],
  ] as const)("RN-025: contrato de 12 meses, %s", (p, esperado) => {
    expect(mesesPrevistos(p, 12)).toEqual(esperado);
  });

  it("RN-025 e CA-11.2: contrato de 18 meses, MS em 1, 7, 13 e MA em 1, 13", () => {
    expect(mesesPrevistos("MS", 18)).toEqual([1, 7, 13]);
    expect(mesesPrevistos("MA", 18)).toEqual([1, 13]);
  });

  it("RN-024: k ≥ N só no mês 1 (MA em 11 meses; MS em 6 meses)", () => {
    expect(mesesPrevistos("MA", 11)).toEqual([1]);
    expect(mesesPrevistos("MS", 6)).toEqual([1]);
    expect(mesesPrevistos("MA", 1)).toEqual([1]);
  });

  it("RN-023: o último mês entra quando (N − 1) mod k = 0 (MT em 13 meses)", () => {
    expect(mesesPrevistos("MT", 13)).toEqual([1, 4, 7, 10, 13]);
  });
});

describe("mesesDoCronograma (RN-021, RN-028)", () => {
  it("RN-021: início no meio do mês → mês 1 é o mês de calendário do início", () => {
    const m = mesesDoCronograma("2026-08-14", 12);
    expect(m[0]).toEqual({ indice: 1, referencia: "2026-08-01", vencimento: "2026-08-31" });
    expect(m[11]).toEqual({ indice: 12, referencia: "2027-07-01", vencimento: "2027-07-31" });
  });

  it("RN-028: vencimento no último dia do mês, inclusive fevereiro bissexto e virada de ano", () => {
    const m = mesesDoCronograma("2027-11-30", 4);
    expect(m.map((x) => x.vencimento)).toEqual([
      "2027-11-30",
      "2027-12-31",
      "2028-01-31",
      "2028-02-29",
    ]);
    expect(mesesDoCronograma("2026-02-01", 1)[0]?.vencimento).toBe("2026-02-28");
  });
});

describe("buildSchedule (RN-023, RN-026)", () => {
  const plano = [
    { id: "tensao", tipoId: "split", periodicidade: "MS" as const },
    { id: "filtro", tipoId: "split", periodicidade: "MM" as const },
    { id: "serpentina", tipoId: "vrf", periodicidade: "MA" as const },
  ];
  const equipamentos = [
    { id: "spl-1", tipoId: "split" },
    { id: "spl-2", tipoId: "split" },
    { id: "vrf-1", tipoId: "vrf" },
  ];

  it("CA-11.1: contrato de 14/08/2026 a 30/07/2027, MS prevista em ago/26 (1) e fev/27 (7)", () => {
    const r = buildSchedule(
      { inicio: "2026-08-14", meses: 12 },
      [plano[0] as (typeof plano)[0]],
      [equipamentos[0] as (typeof equipamentos)[0]],
    );
    expect(r).toEqual([
      {
        atividadeId: "tensao",
        equipamentoId: "spl-1",
        indice: 1,
        referencia: "2026-08-01",
        vencimento: "2026-08-31",
      },
      {
        atividadeId: "tensao",
        equipamentoId: "spl-1",
        indice: 7,
        referencia: "2027-02-01",
        vencimento: "2027-02-28",
      },
    ]);
  });

  it("RN-026: a atividade vale para todos os equipamentos do tipo e só para eles", () => {
    const r = buildSchedule({ inicio: "2026-01-01", meses: 12 }, plano, equipamentos);
    // Split: 2 equipamentos × (2 + 12) meses; VRF: 1 × 1.
    expect(r).toHaveLength(2 * 14 + 1);
    expect(r.filter((o) => o.equipamentoId === "vrf-1").map((o) => o.atividadeId)).toEqual([
      "serpentina",
    ]);
    expect(
      new Set(r.filter((o) => o.atividadeId === "filtro").map((o) => o.equipamentoId)),
    ).toEqual(new Set(["spl-1", "spl-2"]));
  });

  it("uma linha por equipamento × atividade × mês (03 UNIQUE de occurrence)", () => {
    const r = buildSchedule({ inicio: "2026-03-10", meses: 18 }, plano, equipamentos);
    const chaves = r.map((o) => `${o.atividadeId}|${o.equipamentoId}|${o.indice}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("sem equipamento do tipo ou sem plano → nenhuma ocorrência", () => {
    expect(buildSchedule({ inicio: "2026-01-01", meses: 12 }, plano, [])).toEqual([]);
    expect(buildSchedule({ inicio: "2026-01-01", meses: 12 }, [], equipamentos)).toEqual([]);
  });
});

describe("indiceDoMes e primeiroMesRecalculavel (RN-021, RN-032)", () => {
  it("RN-021: o mês do contrato conta pelo mês de calendário, não pelo dia", () => {
    expect(indiceDoMes("2026-08-14", "2026-08-01")).toBe(1);
    expect(indiceDoMes("2026-08-14", "2026-08-31")).toBe(1);
    expect(indiceDoMes("2026-08-14", "2027-01-02")).toBe(6);
    expect(indiceDoMes("2026-08-14", "2026-07-31")).toBe(0);
  });

  it("RN-032: o recálculo começa no mês seguinte ao corrente", () => {
    expect(primeiroMesRecalculavel("2026-01-01", "2026-04-15")).toBe(5);
    expect(primeiroMesRecalculavel("2026-01-01", "2025-12-31")).toBe(1);
  });
});

describe("recalcularCronograma (RN-015, RN-032, RN-066 a RN-068, RN-183, RN-184)", () => {
  const contrato = { inicio: "2026-01-01", meses: 12 };
  const hoje = "2026-04-15"; // mês corrente = 4; recalcula a partir do mês 5
  const a1 = { id: "a1", tipoId: "T", periodicidade: "MT" as const }; // 1, 4, 7, 10
  const e1 = { id: "e1", tipoId: "T" };
  const e2 = { id: "e2", tipoId: "T" };

  /** Ocorrências como a emissão gravou (todas `PREVISTA`), com id `atividade|equipamento|mês`. */
  const gravadas = (
    plano: readonly AtividadeDoPlano[],
    equipamentos: readonly EquipamentoDoCronograma[],
  ): OcorrenciaExistente[] =>
    buildSchedule(contrato, plano, equipamentos).map((o) => ({
      id: `${o.atividadeId}|${o.equipamentoId}|${o.indice}`,
      atividadeId: o.atividadeId,
      equipamentoId: o.equipamentoId,
      indice: o.indice,
      estado: "PREVISTA",
      emVisitaIniciada: false,
    }));
  const celulas = (os: readonly { atividadeId: string; equipamentoId: string; indice: number }[]) =>
    os.map((o) => `${o.atividadeId}|${o.equipamentoId}|${o.indice}`);
  const com = (
    os: OcorrenciaExistente[],
    id: string,
    mudar: Partial<OcorrenciaExistente>,
  ): OcorrenciaExistente[] => os.map((o) => (o.id === id ? { ...o, ...mudar } : o));

  it("RN-015: plano e equipamentos iguais → nada muda", () => {
    const r = recalcularCronograma(contrato, [a1], [e1, e2], gravadas([a1], [e1, e2]), hoje);
    expect(r).toEqual({ inserir: [], prever: [], desprever: [] });
  });

  it("RN-032: MT → MB recalcula só depois do mês corrente; meses passados ficam como estão", () => {
    const mb = { ...a1, periodicidade: "MB" as const }; // 1, 3, 5, 7, 9, 11
    const r = recalcularCronograma(contrato, [mb], [e1], gravadas([a1], [e1]), hoje);
    // Mês 3 é passado: não ganha ocorrência. Mês 4 (corrente) continua previsto.
    expect(celulas(r.inserir)).toEqual(["a1|e1|5", "a1|e1|9", "a1|e1|11"]);
    expect(r.desprever).toEqual([{ id: "a1|e1|10", motivo: "RECALCULO_PERIODICIDADE" }]);
    expect(r.prever).toEqual([]);
  });

  it("RN-032 e RN-028: as células novas levam mês de referência e vencimento", () => {
    const mm = { ...a1, periodicidade: "MM" as const };
    const r = recalcularCronograma(contrato, [mm], [e1], gravadas([a1], [e1]), hoje);
    expect(r.inserir[0]).toEqual({
      atividadeId: "a1",
      equipamentoId: "e1",
      indice: 5,
      referencia: "2026-05-01",
      vencimento: "2026-05-31",
    });
  });

  it.each(["OK", "NOK", "PENDENTE"] as const)(
    "RN-032, RN-148: ocorrência %s não muda, mesmo fora da nova periodicidade",
    (estado) => {
      const ms = { ...a1, periodicidade: "MS" as const }; // 1, 7
      const existentes = com(gravadas([a1], [e1]), "a1|e1|10", { estado });
      const r = recalcularCronograma(contrato, [ms], [e1], existentes, hoje);
      expect(r.desprever).toEqual([]);
    },
  );

  it("RN-184: célula que volta a ser prevista reaproveita a linha NAO_PREVISTA", () => {
    const existentes = com(gravadas([a1], [e1]), "a1|e1|10", { estado: "NAO_PREVISTA" });
    const r = recalcularCronograma(contrato, [a1], [e1], existentes, hoje);
    expect(r.prever).toEqual(["a1|e1|10"]);
    expect(r.inserir).toEqual([]);
  });

  it("RN-184: NAO_PREVISTA que continua fora do plano não volta", () => {
    const existentes = com(gravadas([a1], [e1]), "a1|e1|10", { estado: "NAO_PREVISTA" });
    const r = recalcularCronograma(contrato, [], [e1], existentes, hoje);
    expect(r.prever).toEqual([]);
    expect(r.desprever.map((d) => d.id)).toEqual(["a1|e1|7"]);
  });

  it("RN-183: atividade removida → futuras viram Ø com ATIVIDADE_REMOVIDA_DO_PLANO; mês corrente fica", () => {
    const r = recalcularCronograma(contrato, [], [e1, e2], gravadas([a1], [e1, e2]), hoje);
    expect(r.desprever).toEqual([
      { id: "a1|e1|7", motivo: "ATIVIDADE_REMOVIDA_DO_PLANO" },
      { id: "a1|e1|10", motivo: "ATIVIDADE_REMOVIDA_DO_PLANO" },
      { id: "a1|e2|7", motivo: "ATIVIDADE_REMOVIDA_DO_PLANO" },
      { id: "a1|e2|10", motivo: "ATIVIDADE_REMOVIDA_DO_PLANO" },
    ]);
    expect(r.inserir).toEqual([]);
  });

  it("RN-068: equipamento inativado → só as futuras dele viram Ø com EQUIPAMENTO_INATIVADO", () => {
    const r = recalcularCronograma(contrato, [a1], [e1], gravadas([a1], [e1, e2]), hoje);
    expect(r.desprever).toEqual([
      { id: "a1|e2|7", motivo: "EQUIPAMENTO_INATIVADO" },
      { id: "a1|e2|10", motivo: "EQUIPAMENTO_INATIVADO" },
    ]);
  });

  it("RN-068, exceção: PENDENTE do equipamento inativado continua até o ADM resolver", () => {
    const existentes = com(gravadas([a1], [e1, e2]), "a1|e2|1", { estado: "PENDENTE" });
    const r = recalcularCronograma(contrato, [a1], [e1], existentes, hoje);
    expect(r.desprever.map((d) => d.id)).not.toContain("a1|e2|1");
  });

  it("RN-067: equipamento incluído → ocorrências a partir do mês seguinte ao corrente", () => {
    const e3 = { id: "e3", tipoId: "T" };
    const r = recalcularCronograma(contrato, [a1], [e1, e3], gravadas([a1], [e1]), hoje);
    expect(celulas(r.inserir)).toEqual(["a1|e3|7", "a1|e3|10"]);
    expect(r.desprever).toEqual([]);
  });

  it("RN-026: equipamento de outro tipo não recebe a atividade", () => {
    const outro = { id: "e9", tipoId: "OUTRO" };
    const r = recalcularCronograma(contrato, [a1], [e1, outro], gravadas([a1], [e1]), hoje);
    expect(r.inserir).toEqual([]);
  });

  it("RN-066: ocorrência em visita iniciada ou registrada não muda", () => {
    const existentes = com(gravadas([a1], [e1]), "a1|e1|7", { emVisitaIniciada: true });
    const r = recalcularCronograma(contrato, [], [e1], existentes, hoje);
    expect(r.desprever.map((d) => d.id)).toEqual(["a1|e1|10"]);
  });

  it("contrato que ainda não começou → recalcula desde o mês 1", () => {
    const r = recalcularCronograma(contrato, [], [e1], gravadas([a1], [e1]), "2025-12-20");
    expect(r.desprever.map((d) => d.id)).toEqual(["a1|e1|1", "a1|e1|4", "a1|e1|7", "a1|e1|10"]);
  });

  it("contrato no último mês ou depois do fim → nada a recalcular", () => {
    for (const dia of ["2026-12-10", "2027-03-01"]) {
      const r = recalcularCronograma(contrato, [], [e1], gravadas([a1], [e1]), dia);
      expect(r).toEqual({ inserir: [], prever: [], desprever: [] });
    }
  });
});
