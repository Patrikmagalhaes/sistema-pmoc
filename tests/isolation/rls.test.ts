import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { Tx } from "../../src/server/db";
import {
  admCtx,
  appDatabase,
  clientCtx,
  ensureSeed,
  failureText,
  SEED,
  technicianCtx,
} from "../integration/helpers";

/** 05 §4.2 item 4: tabelas que o portal lê e que precisam de RLS. */
const EXPECTED_RLS_TABLES = [
  "client",
  "site",
  "contract",
  "equipment",
  "pmoc",
  "pmoc_ficha_export",
  "occurrence",
  "visit_occurrence",
  "visit_schedule_change",
  "visit_report",
  "document_signature",
  "photo",
  "pmoc_version",
  "visit",
  "visit_report_version",
  "stored_file",
  "visit_receipt",
  "notification",
  "app_user",
];

const db = appDatabase();
const owner = postgres(inject("dbOwnerUrl"), { max: 1 });

async function rlsTables(): Promise<string[]> {
  const rows = await owner`SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity ORDER BY tablename`;
  return rows.map((r) => r.tablename as string);
}

async function ids(tx: Tx, table: string): Promise<string[]> {
  // `SELECT` sem filtro algum: simula o bug de uma consulta que esqueceu o WHERE (05 §4.2).
  const rows = await tx.execute(sql.raw(`SELECT id::text AS id FROM ${table}`));
  return (rows as unknown as { id: string }[]).map((r) => r.id);
}

beforeAll(() => ensureSeed(db));
afterAll(async () => {
  await db.close();
  await owner.end();
});

describe("RLS – cobertura", () => {
  it("todas as tabelas da 05 §4.2 têm RLS ligada", async () => {
    const enabled = await rlsTables();
    for (const t of EXPECTED_RLS_TABLES) expect(enabled, t).toContain(t);
  });

  it("nenhuma tabela auth_* tem RLS (AF-04)", async () => {
    expect((await rlsTables()).filter((t) => t.startsWith("auth_"))).toEqual([]);
  });
});

describe("(b) leitura sem contexto volta vazia (falha fechada)", () => {
  it("em todas as tabelas com RLS", async () => {
    const raw = postgres(inject("dbAppUrl"), { max: 1, onnotice: () => {} });
    try {
      for (const t of await rlsTables()) {
        const [row] = await raw.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
        expect(row?.n, t).toBe(0);
      }
    } finally {
      await raw.end();
    }
  });

  it("contexto com perfil desconhecido também não vê nada", async () => {
    await db.withTransaction(admCtx(), async (tx) => {
      await tx.execute(sql`SELECT set_config('app.actor_role', 'OUTRO', true)`);
      expect(await ids(tx, "client")).toEqual([]);
    });
  });
});

describe("(c) CLIENTE A não vê linha de B em nenhuma tabela com RLS", () => {
  it("o conjunto de linhas de A e o de B nunca se cruzam, e A vê o que é seu", async () => {
    const tables = await rlsTables();
    const seen: Record<string, { A: string[]; B: string[]; ADM: string[] }> = {};
    for (const t of tables) {
      seen[t] = {
        A: await db.withTransaction(clientCtx("A"), (tx) => ids(tx, t)),
        B: await db.withTransaction(clientCtx("B"), (tx) => ids(tx, t)),
        ADM: await db.withTransaction(admCtx(), (tx) => ids(tx, t)),
      };
    }
    for (const t of tables) {
      const { A, B, ADM } = seen[t] as { A: string[]; B: string[]; ADM: string[] };
      expect(
        A.filter((id) => B.includes(id)),
        `${t}: linhas visíveis aos dois clientes`,
      ).toEqual([]);
      // O que o cliente vê é sempre um subconjunto do que o ADM vê.
      for (const id of [...A, ...B]) expect(ADM, t).toContain(id);
    }
    // Sem este mínimo o teste passaria "no vazio" se a RLS bloqueasse tudo.
    for (const t of [
      "client",
      "site",
      "contract",
      "equipment",
      "pmoc",
      "visit",
      "stored_file",
      "app_user",
    ]) {
      const { A, B } = seen[t] as { A: string[]; B: string[] };
      expect(A.length, `${t}: A deve ver o que é seu`).toBeGreaterThan(0);
      expect(B.length, `${t}: B deve ver o que é seu`).toBeGreaterThan(0);
    }
  });

  it("identifica exatamente as linhas de A", async () => {
    const own = await db.withTransaction(clientCtx("A"), async (tx) => ({
      client: await ids(tx, "client"),
      site: await ids(tx, "site"),
      visit: await ids(tx, "visit"),
      users: await ids(tx, "app_user"),
    }));
    expect(own.client).toEqual([SEED.clientAId]);
    expect(own.site).toEqual([SEED.siteAId]);
    expect(own.visit).toEqual([SEED.visitAId]);
    expect(own.users).toEqual([SEED.clientAUserId]);
  });

  it("arquivo sem cliente (logo) nunca aparece para CLIENTE; o ADM o vê", async () => {
    const forClient = await db.withTransaction(clientCtx("A"), (tx) => ids(tx, "stored_file"));
    expect(forClient).not.toContain(SEED.logoFileId);
    const forAdm = await db.withTransaction(admCtx(), (tx) => ids(tx, "stored_file"));
    expect(forAdm).toContain(SEED.logoFileId);
  });

  it("A não consegue gravar dados de B (WITH CHECK)", async () => {
    const text = await failureText(
      db.withTransaction(clientCtx("A"), (tx) =>
        tx.execute(sql`INSERT INTO site (client_id, code, name, address_street, address_number,
          address_city, address_state, address_zip)
          VALUES (${SEED.clientBId}, 'LXX1', 'Invasor', 'Rua', '1', 'SP', 'SP', '01001000')`),
      ),
    );
    expect(text).toMatch(/row-level security/i);
  });

  it("A não consegue alterar linha de B (UPDATE afeta 0 linhas)", async () => {
    const changed = await db.withTransaction(clientCtx("A"), async (tx) => {
      const r = await tx.execute(
        sql`UPDATE client SET trade_name = 'hack' WHERE id = ${SEED.clientBId} RETURNING id`,
      );
      return r.length;
    });
    expect(changed).toBe(0);
  });
});

describe("ADM, TECNICO e SISTEMA enxergam tudo (controle na camada 1)", () => {
  it("TECNICO lê os dois clientes", async () => {
    const list = await db.withTransaction(technicianCtx(), (tx) => ids(tx, "client"));
    expect(list).toEqual(expect.arrayContaining([SEED.clientAId, SEED.clientBId]));
  });
});

describe("notification: só o destinatário (05 §4.2)", () => {
  it("cada usuário vê apenas as próprias, inclusive o ADM", async () => {
    await db.withTransaction(admCtx(), async (tx) => {
      for (const uid of [SEED.clientAUserId, SEED.clientBUserId, SEED.admUserId]) {
        await tx.execute(sql`INSERT INTO notification (recipient_user_id, event_type, title, body)
          VALUES (${uid}, 'VISITA_AGENDADA', 'Teste', 'Corpo')`);
      }
    });
    const count = (ctx: ReturnType<typeof clientCtx>) =>
      db.withTransaction(ctx, async (tx) => (await ids(tx, "notification")).length);
    expect(await count(clientCtx("A"))).toBeGreaterThanOrEqual(1);
    const a = await db.withTransaction(clientCtx("A"), async (tx) => {
      const r = await tx.execute(
        sql`SELECT DISTINCT recipient_user_id::text AS r FROM notification`,
      );
      return (r as unknown as { r: string }[]).map((x) => x.r);
    });
    expect(a).toEqual([SEED.clientAUserId]);
    const adm = await db.withTransaction(admCtx(), async (tx) => {
      const r = await tx.execute(
        sql`SELECT DISTINCT recipient_user_id::text AS r FROM notification`,
      );
      return (r as unknown as { r: string }[]).map((x) => x.r);
    });
    expect(adm).toEqual([SEED.admUserId]);
  });
});
