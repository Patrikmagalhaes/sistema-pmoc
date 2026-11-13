import { describe, expect, it } from "vitest";
import { buildSchedule, mesesDoCronograma, mesesPrevistos } from "./cronograma";

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
