/**
 * RN-065 e RN-066: como as visitas acompanham o recálculo do cronograma depois da emissão. Regra pura:
 * recebe as visitas do PMOC e as ocorrências que saíram e entraram, e devolve o que mudar nas visitas.
 */

/** Enum `visit_status` (03 §4). */
export type EstadoVisita = "A_AGENDAR" | "AGENDADA" | "EM_ANDAMENTO" | "REGISTRADA" | "CANCELADA";

/** Visita viva do PMOC, na ordem de criação (`created_at`, `id`). */
export interface VisitaDoPmoc {
  id: string;
  /** `reference_month_index`. */
  indice: number;
  estado: EstadoVisita;
  /** `scheduled_date` (`YYYY-MM-DD`), para o aviso de cancelamento (E-07.7). */
  data: string | null;
  /** Ocorrências com vínculo ativo (`visit_occurrence.removed_at IS NULL`). */
  ocorrencias: readonly string[];
}

/** Ocorrência que passou a ser prevista. `chave` é o id dela ou, na prévia, uma chave provisória. */
export interface OcorrenciaQueEntra {
  chave: string;
  indice: number;
  /** `reference_month` do mês (1º dia), para a visita nova. */
  referencia: string;
}

export interface AcompanhamentoDasVisitas {
  /** Vínculos encerrados com `removal_reason = 'RECALCULO'`. */
  retirar: { visitaId: string; ocorrenciaId: string }[];
  /** Ocorrências que entram numa visita não iniciada do mês. */
  incluir: { visitaId: string; chave: string }[];
  /** Visitas `A_AGENDAR` novas (`origin = 'RECALCULO'`), uma por mês sem visita não iniciada. */
  novas: { indice: number; referencia: string; chaves: string[] }[];
  /** `A_AGENDAR` que ficou sem ocorrências: exclusão lógica (03 `visit` [L]). */
  excluir: string[];
  /** `AGENDADA` que ficou sem ocorrências: `CANCELADA`, com notificação (RN-102). */
  cancelar: { visitaId: string; data: string | null }[];
}

/** RN-065 e RN-066: o recálculo só toca visitas que ainda não começaram. */
export const naoIniciada = (v: Pick<VisitaDoPmoc, "estado">) =>
  v.estado === "A_AGENDAR" || v.estado === "AGENDADA";

/**
 * RN-065: retira das visitas não iniciadas as ocorrências que saíram, põe as que entraram na visita
 * não iniciada do mês (ou numa visita `A_AGENDAR` nova) e trata as visitas que ficaram vazias.
 *
 * Com mais de uma visita não iniciada no mês (divisão, avulsa), a ocorrência vai para a criada
 * primeiro: o doc não escolhe; a escolha fica só em `visitaDoMes`. Visita que já estava vazia antes
 * do recálculo não é tocada: só esvazia quem perdeu ocorrência agora.
 */
export function acompanharRecalculo(
  visitas: readonly VisitaDoPmoc[],
  sairam: readonly string[],
  entraram: readonly OcorrenciaQueEntra[],
): AcompanhamentoDasVisitas {
  const r: AcompanhamentoDasVisitas = {
    retirar: [],
    incluir: [],
    novas: [],
    excluir: [],
    cancelar: [],
  };
  const sai = new Set(sairam);
  const restantes = new Map<string, number>();
  const perderam = new Set<string>();
  const abertas = visitas.filter(naoIniciada);

  for (const v of abertas) {
    let n = 0;
    for (const o of v.ocorrencias) {
      if (sai.has(o)) {
        r.retirar.push({ visitaId: v.id, ocorrenciaId: o });
        perderam.add(v.id);
      } else n++;
    }
    restantes.set(v.id, n);
  }

  const novas = new Map<number, AcompanhamentoDasVisitas["novas"][number]>();
  for (const o of entraram) {
    const v = visitaDoMes(abertas, o.indice);
    if (v) {
      r.incluir.push({ visitaId: v.id, chave: o.chave });
      restantes.set(v.id, (restantes.get(v.id) ?? 0) + 1);
      continue;
    }
    const nova = novas.get(o.indice) ?? { indice: o.indice, referencia: o.referencia, chaves: [] };
    nova.chaves.push(o.chave);
    novas.set(o.indice, nova);
  }
  r.novas = [...novas.values()].sort((a, b) => a.indice - b.indice);

  for (const v of abertas) {
    if (!perderam.has(v.id) || (restantes.get(v.id) ?? 0) > 0) continue;
    if (v.estado === "A_AGENDAR") r.excluir.push(v.id);
    else r.cancelar.push({ visitaId: v.id, data: v.data });
  }
  return r;
}

/** Visita não iniciada que recebe a ocorrência nova do mês: a primeira criada (ver acima). */
function visitaDoMes(abertas: readonly VisitaDoPmoc[], indice: number): VisitaDoPmoc | undefined {
  return abertas.find((v) => v.indice === indice);
}
