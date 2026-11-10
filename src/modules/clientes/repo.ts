import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `clientes` que fala com o banco. Sempre dentro de `withTransaction`. */

export interface ClienteResumo {
  id: string;
  razaoSocial: string;
}

/** Clientes vivos (EL-5), por razão social. A RLS restringe o CLIENTE ao próprio (05 §4.2). */
export async function listarResumo(tx: Tx): Promise<ClienteResumo[]> {
  const r = await tx.execute(sql`SELECT id, legal_name AS "razaoSocial" FROM client
    WHERE deleted_at IS NULL ORDER BY legal_name, id`);
  return r as unknown as ClienteResumo[];
}
