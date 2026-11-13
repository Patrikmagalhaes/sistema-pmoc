/**
 * Regras puras do cronograma (RF-11; doc 02 §2). Datas de negócio em `YYYY-MM-DD` (sem fuso).
 * `buildSchedule` é a função única de 03 §5.5: a pré-visualização do rascunho (DM-05) e a emissão
 * (RN-009 passo 4) usam a mesma.
 */
import type { Periodicidade } from "@/modules/biblioteca";

/** RN-020: intervalo `k` em meses. */
export const INTERVALO_MESES: Record<Periodicidade, number> = {
  MM: 1,
  MB: 2,
  MT: 3,
  MS: 6,
  MA: 12,
};

export interface MesDoContrato {
  /** 1..N (RN-021: o mês 1 é o mês de calendário do início). */
  indice: number;
  /** 1º dia do mês (03 `occurrence.reference_month`). */
  referencia: string;
  /** RN-028: último dia do mês (03 `occurrence.due_date`). */
  vencimento: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** RN-021 e RN-028: os `meses` do contrato (RN-022, `contract.month_count`) a partir do início. */
export function mesesDoCronograma(inicio: string, meses: number): MesDoContrato[] {
  const [ano, mes] = inicio.split("-").map(Number) as [number, number];
  return Array.from({ length: meses }, (_, i) => ({
    indice: i + 1,
    referencia: iso(new Date(Date.UTC(ano, mes - 1 + i, 1))),
    vencimento: iso(new Date(Date.UTC(ano, mes + i, 0))),
  }));
}

/** RN-023 e RN-024: meses `m` (1 ≤ m ≤ N) com `(m − 1) mod k = 0`. Com `k ≥ N`, só o mês 1. */
export function mesesPrevistos(periodicidade: Periodicidade, meses: number): number[] {
  const k = INTERVALO_MESES[periodicidade];
  const r: number[] = [];
  for (let m = 1; m <= meses; m += k) r.push(m);
  return r;
}

export interface AtividadeDoPlano {
  id: string;
  tipoId: string;
  periodicidade: Periodicidade;
}

export interface EquipamentoDoCronograma {
  id: string;
  tipoId: string;
}

/** Célula `PREVISTA` (DM-04: só os meses previstos viram linha em `occurrence`). */
export interface OcorrenciaPrevista extends MesDoContrato {
  atividadeId: string;
  equipamentoId: string;
}

/**
 * RN-023 e RN-026: cada atividade do plano vale para todos os equipamentos do tipo dela. Recebe só o
 * que entra no cronograma (atividades não removidas e equipamentos `ATIVO`); a seleção é de quem chama.
 */
export function buildSchedule(
  contrato: { inicio: string; meses: number },
  plano: readonly AtividadeDoPlano[],
  equipamentos: readonly EquipamentoDoCronograma[],
): OcorrenciaPrevista[] {
  const meses = mesesDoCronograma(contrato.inicio, contrato.meses);
  const r: OcorrenciaPrevista[] = [];
  for (const a of plano) {
    const previstos = mesesPrevistos(a.periodicidade, contrato.meses);
    for (const e of equipamentos) {
      if (e.tipoId !== a.tipoId) continue;
      for (const m of previstos) {
        r.push({ atividadeId: a.id, equipamentoId: e.id, ...(meses[m - 1] as MesDoContrato) });
      }
    }
  }
  return r;
}
