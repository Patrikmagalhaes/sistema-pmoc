/** Regras puras da biblioteca de tipos, grupos e atividades (RF-08; FL-03). */

/** Enum `periodicity` (DEC-04), na ordem da seção 6 do PMOC (RN-051). */
export const PERIODICIDADES = ["MM", "MB", "MT", "MS", "MA"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  MM: "Mensal",
  MB: "Bimestral",
  MT: "Trimestral",
  MS: "Semestral",
  MA: "Anual",
};

export const NATUREZAS = ["VERIFICACAO", "MEDICAO"] as const;
export type Natureza = (typeof NATUREZAS)[number];

export const ROTULO_NATUREZA: Record<Natureza, string> = {
  VERIFICACAO: "Verificação",
  MEDICAO: "Medição",
};

/** Formato da sigla da TAG (RN-040; 03 `equipment_type.acronym`) [A VALIDAR: formato]. */
export const FORMATO_SIGLA = /^[A-Z]{2,5}$/;
/** 03 `activity_template.unit`: `varchar(20)`. */
export const UNIDADE_MAX = 20;

/** Sigla digitada → maiúsculas sem espaços (TL-105 "texto maiúsculo"). */
export const normalizarSigla = (s: string) => s.trim().toUpperCase();

export type ProblemaAtividade = { campo: "unidade"; mensagem: string };

/**
 * RN-042: `MEDICAO` exige unidade; `VERIFICACAO` não tem unidade (a unidade digitada é descartada,
 * porque o campo fica desabilitado na tela).
 */
export function unidadeDaAtividade(
  natureza: Natureza,
  unidade: string | null | undefined,
): { ok: true; unidade: string | null } | { ok: false; problema: ProblemaAtividade } {
  if (natureza === "VERIFICACAO") return { ok: true, unidade: null };
  const u = (unidade ?? "").trim();
  if (!u)
    return { ok: false, problema: { campo: "unidade", mensagem: "Informe a unidade da medição." } };
  if (u.length > UNIDADE_MAX)
    return {
      ok: false,
      problema: {
        campo: "unidade",
        mensagem: `A unidade tem no máximo ${UNIDADE_MAX} caracteres.`,
      },
    };
  return { ok: true, unidade: u };
}

/** RN-051: periodicidade (`MM`→`MA`) e, dentro dela, a ordem de exibição; título desempata. */
export function ordenarAtividades<
  T extends { periodicidade: Periodicidade; ordem: number; titulo: string },
>(atividades: readonly T[]): T[] {
  return [...atividades].sort(
    (a, b) =>
      PERIODICIDADES.indexOf(a.periodicidade) - PERIODICIDADES.indexOf(b.periodicidade) ||
      a.ordem - b.ordem ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

/**
 * EL-4 e RN-044: o que a tela oferece para remover. Com uso, só "Inativar"; sem uso, também "Excluir".
 * Uso do tipo: atividade em PMOC ou equipamento. Uso do grupo: equipamento. Uso da atividade: PMOC.
 */
export const podeExcluir = (uso: { emUso: boolean }) => !uso.emUso;

/**
 * RN-040: tipo `ATIVO` tem pelo menos 1 grupo `ATIVO`. Diz se tirar o grupo `grupoId` (inativar ou
 * excluir) deixaria o tipo sem nenhum.
 */
export function deixariaSemGrupoAtivo(
  tipoAtivo: boolean,
  grupos: readonly { id: string; ativo: boolean }[],
  grupoId: string,
): boolean {
  if (!tipoAtivo) return false;
  return !grupos.some((g) => g.ativo && g.id !== grupoId);
}
