import "server-only";
import { createSafeActionClient } from "next-safe-action";

/**
 * Cliente das Server Actions (05 §3.0, next-safe-action). Erro inesperado vira mensagem genérica:
 * detalhe técnico nunca vai para a tela (04 §1.2 `ERRO`) nem para o log com dado sensível (LG-30).
 */
export const actionClient = createSafeActionClient({
  handleServerError: () => "Não foi possível concluir. Tente novamente.",
});
