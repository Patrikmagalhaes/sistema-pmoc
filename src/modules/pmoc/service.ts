import "server-only";
import type { Tx } from "@/server/db";
import * as repo from "./repo";

/**
 * RN-014: PMOC do contrato → `HISTORICO`. Recebe a transação de quem chama (cancelamento, RN-144;
 * "Confirmar renovação", RN-192), para a mudança do contrato e a do PMOC valerem juntas ou nenhuma.
 * A permissão é conferida por quem chama, antes de abrir a transação (MOD-04).
 */
export function tornarHistoricoNaTransacao(tx: Tx, contratoId: string): Promise<boolean> {
  return repo.tornarHistorico(tx, contratoId);
}
