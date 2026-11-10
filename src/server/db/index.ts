import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../env";
import { createWithTransaction, type Tx } from "./with-transaction";

export type { Tx };

export interface Database {
  withTransaction: ReturnType<typeof createWithTransaction>;
  /**
   * Conexão sem contexto, **só** para o adaptador do Better Auth nas tabelas `auth_*` (exceção da AF-04:
   * sem auditoria e sem RLS). Qualquer outra tabela passa por `withTransaction`.
   */
  authDrizzle: PostgresJsDatabase;
  close(): Promise<void>;
}

/**
 * Cliente do banco. `prepare: false` é exigido pelo pooler em modo transação (05 §3.0).
 * Em testes, é chamado com a URL do papel `app_rw` do container.
 */
export function createDatabase(url: string, options: { max?: number } = {}): Database {
  const client = postgres(url, { prepare: false, max: options.max ?? 10, onnotice: () => {} });
  const db: PostgresJsDatabase = drizzle(client);
  return { withTransaction: createWithTransaction(db), authDrizzle: db, close: () => client.end() };
}

let shared: Database | undefined;

/** Instância única da aplicação (MOD-05). Só `repo.ts` e serviços chegam aqui. */
export function getDatabase(): Database {
  shared ??= createDatabase(getEnv().DATABASE_URL);
  return shared;
}

/** MOD-05: todo acesso ao banco (leitura e escrita) passa por aqui. */
export const withTransaction: Database["withTransaction"] = (ctx, fn) =>
  getDatabase().withTransaction(ctx, fn);
