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

// ---------------------------------------------------------------------------------------------
// Recálculo depois da emissão (RN-015, RN-032, RN-067, RN-068, RN-183, RN-184; 02 §7.4)
// ---------------------------------------------------------------------------------------------

/** Enum `occurrence_status` (03 §4). */
export type EstadoOcorrencia = "NAO_PREVISTA" | "PREVISTA" | "PENDENTE" | "OK" | "NOK";

/** Valores do enum `unscheduled_reason` (03 §4) que o recálculo grava. */
export type MotivoRecalculo =
  | "RECALCULO_PERIODICIDADE"
  | "ATIVIDADE_REMOVIDA_DO_PLANO"
  | "EQUIPAMENTO_INATIVADO";

/** Linha de `occurrence` já gravada, como o recálculo a enxerga. */
export interface OcorrenciaExistente {
  id: string;
  atividadeId: string;
  equipamentoId: string;
  /** `month_index`. */
  indice: number;
  estado: EstadoOcorrencia;
  /** RN-066: a ocorrência está em visita `EM_ANDAMENTO` ou `REGISTRADA`; o recálculo não a toca. */
  emVisitaIniciada: boolean;
}

export interface Recalculo {
  /** Células novas (equipamento incluído, atividade nova ou periodicidade que passou a prever o mês). */
  inserir: OcorrenciaPrevista[];
  /** RN-184: `NAO_PREVISTA` → `PREVISTA` por UPDATE da mesma linha. */
  prever: string[];
  /** `PREVISTA` → `NAO_PREVISTA`, com o motivo de `unscheduled_reason`. */
  desprever: { id: string; motivo: MotivoRecalculo }[];
}

/**
 * Índice do mês do contrato em que cai `dia` (RN-021). Pode ser ≤ 0 (antes do início) ou maior que
 * `contract.month_count` (depois do fim); quem chama decide o que isso significa.
 */
export function indiceDoMes(inicio: string, dia: string): number {
  const [ai, mi] = inicio.split("-").map(Number) as [number, number];
  const [ad, md] = dia.split("-").map(Number) as [number, number];
  return (ad - ai) * 12 + (md - mi) + 1;
}

/**
 * RN-032, RN-067, RN-068 e RN-183: o recálculo só mexe nos meses **posteriores ao mês corrente**.
 * "Incluir o mês corrente no recálculo" está [A VALIDAR] (RN-032, exceção): a decisão fica só aqui.
 */
export function primeiroMesRecalculavel(inicio: string, hoje: string): number {
  return indiceDoMes(inicio, hoje) + 1;
}

/**
 * Compara o cronograma que o plano atual pede com as ocorrências gravadas e devolve o que mudar,
 * só nos meses a partir de `primeiroMesRecalculavel` (RN-015). Recebe o plano sem as atividades
 * removidas e só os equipamentos `ATIVO`, como `buildSchedule`.
 *
 * - `OK`, `NOK` e `PENDENTE` nunca mudam (RN-032, RN-148, RN-149; RN-068, exceção).
 * - Ocorrência em visita iniciada ou registrada não muda (RN-066).
 * - Célula que volta a ser prevista reaproveita a linha `NAO_PREVISTA` (RN-184, decisão B10).
 * - O motivo do Ø sai da causa: atividade fora do plano (RN-183), equipamento fora dos ativos
 *   (RN-068) ou, com os dois presentes, a periodicidade (RN-032).
 */
export function recalcularCronograma(
  contrato: { inicio: string; meses: number },
  plano: readonly AtividadeDoPlano[],
  equipamentos: readonly EquipamentoDoCronograma[],
  existentes: readonly OcorrenciaExistente[],
  hoje: string,
): Recalculo {
  const desde = primeiroMesRecalculavel(contrato.inicio, hoje);
  const chave = (atividadeId: string, equipamentoId: string, indice: number) =>
    `${atividadeId}|${equipamentoId}|${indice}`;

  const pedidas = new Map<string, OcorrenciaPrevista>();
  for (const o of buildSchedule(contrato, plano, equipamentos)) {
    if (o.indice >= desde) pedidas.set(chave(o.atividadeId, o.equipamentoId, o.indice), o);
  }
  const atividades = new Set(plano.map((a) => a.id));
  const ativos = new Set(equipamentos.map((e) => e.id));

  const r: Recalculo = { inserir: [], prever: [], desprever: [] };
  const gravadas = new Set<string>();
  for (const o of existentes) {
    const k = chave(o.atividadeId, o.equipamentoId, o.indice);
    gravadas.add(k);
    if (o.indice < desde || o.emVisitaIniciada) continue;
    const pedida = pedidas.has(k);
    if (o.estado === "NAO_PREVISTA" && pedida) r.prever.push(o.id);
    else if (o.estado === "PREVISTA" && !pedida) {
      const motivo: MotivoRecalculo = !atividades.has(o.atividadeId)
        ? "ATIVIDADE_REMOVIDA_DO_PLANO"
        : !ativos.has(o.equipamentoId)
          ? "EQUIPAMENTO_INATIVADO"
          : "RECALCULO_PERIODICIDADE";
      r.desprever.push({ id: o.id, motivo });
    }
  }
  for (const [k, o] of pedidas) if (!gravadas.has(k)) r.inserir.push(o);
  return r;
}
