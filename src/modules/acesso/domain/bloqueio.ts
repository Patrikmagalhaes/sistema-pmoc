/** Bloqueio de conta por tentativas (06 SEG-07, SEG-60; DFT-20; E-01.3). */

export const BLOQUEIO = { tentativas: 5, duracaoMs: 15 * 60 * 1000 } as const;

export interface TentativaLogin {
  /** `LOGIN_OK` zera a contagem; `LOGIN_FALHA` soma. */
  tipo: "LOGIN_OK" | "LOGIN_FALHA";
  em: Date;
}

/**
 * Recebe as tentativas da conta (por `email_hash`) em ordem cronológica e devolve até quando ela está
 * bloqueada, ou `null`. A 5ª falha seguida bloqueia por 15 min; ao fim do bloqueio a contagem recomeça.
 * Tentativas feitas durante o bloqueio são recusadas antes de checar a senha e não contam.
 */
export function bloqueadaAte(tentativas: readonly TentativaLogin[], agora: Date): Date | null {
  let falhas = 0;
  let ate: Date | null = null;
  for (const t of tentativas) {
    if (ate && t.em < ate) continue;
    if (t.tipo === "LOGIN_OK") {
      falhas = 0;
      continue;
    }
    falhas += 1;
    if (falhas >= BLOQUEIO.tentativas) {
      ate = new Date(t.em.getTime() + BLOQUEIO.duracaoMs);
      falhas = 0;
    }
  }
  return ate && ate > agora ? ate : null;
}
