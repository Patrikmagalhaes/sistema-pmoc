import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `pmoc` que fala com o banco. Sempre dentro de `withTransaction`. */

/**
 * RN-014: o PMOC vivo do contrato vira `HISTORICO` (de `RASCUNHO`, `EMITIDO` ou `ASSINADO_CLIENTE`;
 * doc 02 §7.3). Já histórico, nada muda. Devolve se mudou.
 */
export async function tornarHistorico(tx: Tx, contratoId: string): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE pmoc SET status = 'HISTORICO', historic_since = now()
    WHERE contract_id = ${contratoId} AND deleted_at IS NULL AND status <> 'HISTORICO'
    RETURNING id`);
  return r.length === 1;
}
