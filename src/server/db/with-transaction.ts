import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { RequestContext } from "../context";

export type Tx = Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];

/**
 * Grava o contexto `app.*` da transação (03 §5.3; 05 §4.2). AF-05: `set_config(..., true)` com parâmetros,
 * nunca texto de `SET LOCAL`. O 3º argumento `true` limita o valor à transação, então ele não vaza para
 * a próxima requisição que reutilizar a conexão do pooler.
 */
export async function applyContext(tx: Tx, ctx: RequestContext): Promise<void> {
  await tx.execute(sql`SELECT
    set_config('app.actor_user_id', ${ctx.userId ?? ""}, true),
    set_config('app.actor_role',    ${ctx.role}, true),
    set_config('app.source',        ${ctx.source}, true),
    set_config('app.client_id',     ${ctx.clientId ?? ""}, true),
    set_config('app.request_id',    ${ctx.requestId}, true),
    set_config('app.ip_address',    ${ctx.ipAddress ?? ""}, true),
    set_config('app.reason',        ${ctx.reason ?? ""}, true)`);
}

export function createWithTransaction(db: PostgresJsDatabase) {
  return function withTransaction<T>(ctx: RequestContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await applyContext(tx, ctx);
      return fn(tx);
    });
  };
}
