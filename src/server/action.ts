import "server-only";
import { headers } from "next/headers";
import { createSafeActionClient } from "next-safe-action";
import { sessaoAtual } from "./auth/sessao";

/**
 * Cliente das Server Actions (05 §3.0, next-safe-action). Erro inesperado vira mensagem genérica:
 * detalhe técnico nunca vai para a tela (04 §1.2 `ERRO`) nem para o log com dado sensível (LG-30).
 */
export const actionClient = createSafeActionClient({
  handleServerError: (e) =>
    e instanceof SemSessao ? SESSAO_EXPIRADA : "Não foi possível concluir. Tente novamente.",
});

/** `serverError` devolvido quando a sessão acabou: a tela leva ao TL-001. */
export const SESSAO_EXPIRADA = "SESSAO_EXPIRADA";

/** Erro de sessão: a tela trata como `SESSAO_EXPIRADA` (04 §1.2). */
export class SemSessao extends Error {}

/**
 * Action de usuário logado com sessão plena (MOD-04): entrega o `RequestContext` e os cabeçalhos da
 * requisição (as chamadas ao Better Auth usam a sessão do próprio usuário). A permissão de cada ação
 * continua no serviço (`can`).
 */
export const sessionAction = actionClient.use(async ({ next }) => {
  const s = await sessaoAtual();
  if (s.estado !== "OK") throw new SemSessao();
  return next({ ctx: { req: s.ctx, headers: await headers() } });
});
