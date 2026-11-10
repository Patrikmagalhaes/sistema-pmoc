import { inject } from "vitest";
import { SEED, seedDevelopment } from "../../db/seed/data";
import { buildContext, systemContext } from "../../src/server/context";
import { createDatabase, type Database } from "../../src/server/db";

export { SEED };

const REQ = "00000000-0000-4000-8000-0000000000aa";

export const admCtx = () =>
  buildContext({ userId: SEED.admUserId, role: "ADM", requestId: REQ, source: "WEB_ADM" });
export const technicianCtx = () =>
  buildContext({
    userId: SEED.technicianUserId,
    role: "TECNICO",
    requestId: REQ,
    source: "PWA_TECNICO",
  });
export const clientCtx = (which: "A" | "B") =>
  buildContext({
    userId: which === "A" ? SEED.clientAUserId : SEED.clientBUserId,
    role: "CLIENTE",
    clientId: which === "A" ? SEED.clientAId : SEED.clientBId,
    requestId: REQ,
    source: "PORTAL_CLIENTE",
  });
export const sysCtx = () => systemContext(REQ);

/** Conexão da aplicação (papel app_rw). `max: 1` força reuso da conexão para testar vazamento de contexto. */
export function appDatabase(max = 3): Database {
  return createDatabase(inject("dbAppUrl"), { max });
}

export async function ensureSeed(db: Database) {
  await seedDevelopment(db);
}

/** Drizzle embrulha o erro do Postgres em `cause`; devolve mensagem + causas para casar com regex. */
export async function failureText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const parts: string[] = [];
    for (let err: unknown = e; err instanceof Error; err = err.cause) parts.push(err.message);
    return parts.join(" | ");
  }
  throw new Error("esperava falha, mas a operação teve sucesso");
}
