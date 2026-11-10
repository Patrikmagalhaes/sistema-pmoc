import "server-only";
import { can } from "@/modules/autorizacao";
import type { RequestContext } from "@/server/context";
import type { Database } from "@/server/db";
import * as repo from "./repo";

/**
 * Lista para seleção (TL-106 filtro "Cliente"; TL-107 campo "Cliente"). O cadastro completo de
 * clientes (TL-108, TL-109) entra na Etapa 3.
 */
export async function listarClientesParaSelecao(
  ctx: RequestContext,
  deps: { db: Database },
): Promise<repo.ClienteResumo[]> {
  if (!can(ctx, "cadastro.ler", { clientId: ctx.clientId })) return [];
  return deps.db.withTransaction(ctx, (tx) => repo.listarResumo(tx));
}
