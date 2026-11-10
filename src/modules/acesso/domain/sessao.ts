/**
 * Regras de sessão e de acesso do perfil (06 SEG-05, SEG-10; RN-141, RN-194; AF-08).
 * Puras: o serviço lê sessão e `app_user` e chama `avaliarSessao`.
 */

export type Perfil = "ADM" | "TECNICO" | "CLIENTE";

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

/**
 * SEG-10 (AF-08). A biblioteca mantém a sessão por 30 dias renováveis (o caso do PWA do técnico); para
 * ADM e CLIENTE a checagem extra fica aqui, porque a biblioteca não aceita duração por perfil (S-04).
 */
export const LIMITES_SESSAO = {
  /** Duração renovável da biblioteca (`session.expiresIn`). */
  renovavelMs: 30 * DIA_MS,
  /** Intervalo de renovação (`session.updateAge`): é a precisão da medida de "sem uso". */
  renovacaoMs: 5 * 60 * 1000,
  web: { semUsoMs: 12 * HORA_MS, absolutoMs: 7 * DIA_MS },
} as const;

/** Perfis com o limite web (12 h sem uso, 7 dias no máximo). O TECNICO usa o PWA (30 dias, ARQ-06). */
const PERFIS_WEB: readonly Perfil[] = ["ADM", "CLIENTE"];

export interface SessaoAvaliada {
  perfil: Perfil;
  situacao: "ATIVO" | "INATIVO";
  /** `auth_session.created_at`. */
  criadaEm: Date;
  /** `auth_session.updated_at` (renovada a cada `renovacaoMs` de uso). */
  ultimoUso: Date;
  /** `auth_user.two_factor_enabled`. */
  segundoFatorAtivo: boolean;
  agora: Date;
}

export type ResultadoSessao =
  | { ok: true; somenteConfigurarSegundoFator: boolean }
  | { ok: false; motivo: "INATIVO" | "SEM_USO" | "LIMITE_ABSOLUTO" };

export function avaliarSessao(s: SessaoAvaliada): ResultadoSessao {
  if (s.situacao !== "ATIVO") return { ok: false, motivo: "INATIVO" };
  if (PERFIS_WEB.includes(s.perfil)) {
    const { semUsoMs, absolutoMs } = LIMITES_SESSAO.web;
    if (s.agora.getTime() - s.criadaEm.getTime() >= absolutoMs) {
      return { ok: false, motivo: "LIMITE_ABSOLUTO" };
    }
    if (s.agora.getTime() - s.ultimoUso.getTime() >= semUsoMs) {
      return { ok: false, motivo: "SEM_USO" };
    }
  }
  // RN-194: ADM sem segundo fator só acessa a tela de configurá-lo (TL-004).
  return { ok: true, somenteConfigurarSegundoFator: s.perfil === "ADM" && !s.segundoFatorAtivo };
}
