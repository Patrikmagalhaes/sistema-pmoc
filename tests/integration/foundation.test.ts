import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createWithTransaction } from "../../src/server/db/with-transaction";
import { admCtx, appDatabase, ensureSeed } from "./helpers";

/** Critério de pronto da Etapa 1 (docs/07): (a) e (d); (b) e (c) estão em tests/isolation/rls.test.ts. */
describe("(a) escrita sem contexto falha", () => {
  const raw = postgres(inject("dbAppUrl"), { max: 1, onnotice: () => {} });
  afterAll(() => raw.end());

  it("tabela com auditoria e sem RLS: o trigger recusa (app.source vazio)", async () => {
    await expect(
      raw`INSERT INTO equipment_type (name, acronym) VALUES ('Sem contexto', 'SCX')`,
    ).rejects.toThrow(/sem contexto/i);
  });

  it("tabela com RLS: a política recusa", async () => {
    await expect(
      raw`INSERT INTO client (legal_name, cnpj, address_street, address_number, address_city,
        address_state, address_zip)
        VALUES ('X', '11222333000181', 'Rua', '1', 'SP', 'SP', '01001000')`,
    ).rejects.toThrow(/row-level security|sem contexto/i);
  });
});

describe("withTransaction (MOD-05, AF-05)", () => {
  // max: 1 → a mesma conexão é reutilizada, como no pooler em modo transação.
  const db = appDatabase(1);
  beforeAll(() => ensureSeed(db));
  afterAll(() => db.close());

  it("grava o contexto app.* só dentro da transação", async () => {
    const ctx = admCtx();
    const inside = await db.withTransaction(ctx, async (tx) => {
      const r = await tx.execute(sql`SELECT current_setting('app.actor_role') AS role,
        current_setting('app.source') AS source, current_setting('app.actor_user_id') AS uid`);
      return r[0] as { role: string; source: string; uid: string };
    });
    expect(inside).toEqual({ role: "ADM", source: "WEB_ADM", uid: ctx.userId });
  });

  it("não vaza o contexto para a próxima uso da mesma conexão (pooler em modo transação)", async () => {
    const client = postgres(inject("dbAppUrl"), { prepare: false, max: 1, onnotice: () => {} });
    try {
      const withTx = createWithTransaction(drizzle(client));
      await withTx(admCtx(), async (tx) => {
        await tx.execute(sql`SELECT 1`);
      });
      const [after] =
        await client`SELECT coalesce(current_setting('app.actor_role', true), '') AS role`;
      expect(after?.role).toBe("");
    } finally {
      await client.end();
    }
  });

  it("valor malicioso vira dado, nunca SQL (AF-05)", async () => {
    const ctx = { ...admCtx(), reason: "x'; DROP TABLE client; --" };
    const reason = await db.withTransaction(ctx, async (tx) => {
      const r = await tx.execute(sql`SELECT current_setting('app.reason') AS reason`);
      return (r[0] as { reason: string }).reason;
    });
    expect(reason).toBe("x'; DROP TABLE client; --");
    const n = await db.withTransaction(admCtx(), async (tx) => {
      const r = await tx.execute(sql`SELECT count(*)::int AS n FROM client`);
      return (r[0] as { n: number }).n;
    });
    expect(n).toBeGreaterThan(0);
  });

  it("reverte a transação inteira quando a função lança", async () => {
    await expect(
      db.withTransaction(admCtx(), async (tx) => {
        await tx.execute(sql`INSERT INTO equipment_type (name, acronym) VALUES ('Reverte', 'RVT')`);
        throw new Error("falha");
      }),
    ).rejects.toThrow("falha");
    const n = await db.withTransaction(admCtx(), async (tx) => {
      const r = await tx.execute(
        sql`SELECT count(*)::int AS n FROM equipment_type WHERE acronym = 'RVT'`,
      );
      return (r[0] as { n: number }).n;
    });
    expect(n).toBe(0);
  });
});

describe("(d) audit_log é somente de inclusão (RNF-06)", () => {
  const db = appDatabase();
  beforeAll(() => ensureSeed(db));
  afterAll(() => db.close());

  it("app_rw não consegue UPDATE, DELETE nem TRUNCATE", async () => {
    await db.withTransaction(admCtx(), (tx) =>
      tx.execute(sql`INSERT INTO equipment_type (name, acronym) VALUES ('Audit', 'AUD')`),
    );
    for (const stmt of [
      sql`UPDATE audit_log SET reason = 'x'`,
      sql`DELETE FROM audit_log`,
      sql`TRUNCATE audit_log`,
    ]) {
      await expect(db.withTransaction(admCtx(), (tx) => tx.execute(stmt))).rejects.toThrow();
    }
  });

  it("nem o dono consegue: o trigger protege a tabela", async () => {
    const owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });
    try {
      await expect(owner`UPDATE audit_log SET reason = 'x'`).rejects.toThrow(/somente de inclusão/);
      await expect(owner`DELETE FROM audit_log`).rejects.toThrow(/somente de inclusão/);
      await expect(owner`TRUNCATE audit_log`).rejects.toThrow(/somente de inclusão/);
    } finally {
      await owner.end();
    }
  });
});
