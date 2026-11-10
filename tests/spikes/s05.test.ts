/**
 * Spike S-05 (docs/05 §10.4; ADR-05): RLS com contexto set_config(..., true) e desempenho na escala
 * da DEC-34 emendada (AF-12): ~200 clientes, ~2.000 equipamentos, um cliente grande com 200
 * equipamentos × 12 meses (RNF-02). Meta: listas do portal < 2 s (RNF-16; 06 DES-02).
 *
 * Roda no Postgres local (embutido ou container). O teste no pooler do Supabase em modo transação
 * fica pendente até existir o projeto (sem projeto em 10/11/2026).
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildContext, type RequestContext } from "../../src/server/context";
import type { Database } from "../../src/server/db";
import { appDatabase, ensureSeed, SEED, sysCtx } from "../integration/helpers";

const CLIENTS = 200;
const BIG_EQUIPMENTS = 200;
const SMALL_EQUIPMENTS = 9; // 199 × 9 + 200 ≈ 2.000 equipamentos
const ACTIVITIES = 3;
const MONTHS = 12;
const RUNS = 20;
const P95_LIMIT_MS = 2000;

const REQ = "00000000-0000-4000-8000-0000000005e5";
const uuid = (n: number, prefix: string) =>
  `${prefix}000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const bigClientId = uuid(1, "5c");
const smallClientId = uuid(2, "5c");

/** CNPJ numérico válido a partir de um número base (dados fictícios). */
function cnpj(n: number): string {
  const base = `9${n.toString().padStart(7, "0")}0001`.split("").map(Number);
  const dv = (digits: number[]) => {
    const w =
      digits.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = digits.reduce((s, d, i) => s + d * (w[i] as number), 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

const clientCtx = (clientId: string): RequestContext =>
  buildContext({
    userId: SEED.clientAUserId,
    role: "CLIENTE",
    clientId,
    requestId: REQ,
    source: "PORTAL_CLIENTE",
  });
const admCtx = () =>
  buildContext({ userId: SEED.admUserId, role: "ADM", requestId: REQ, source: "WEB_ADM" });

let db: Database;
let bigPmocId = "";
let bigVisitId = "";

async function load() {
  await ensureSeed(db);
  await db.withTransaction(sysCtx(), async (tx) => {
    const rows = Array.from({ length: CLIENTS }, (_, i) => {
      const n = i + 1;
      return sql`(${uuid(n, "5c")}::uuid, ${`Cliente Fictício ${n}`}, ${cnpj(n)})`;
    });
    await tx.execute(sql`INSERT INTO client (id, legal_name, cnpj, address_street, address_number,
        address_city, address_state, address_zip)
      SELECT v.id, v.name, v.cnpj, 'Rua Fictícia', '1', 'São Paulo', 'SP', '01001000'
      FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(id, name, cnpj)`);

    // Um local, um contrato e um PMOC por cliente.
    await tx.execute(sql`INSERT INTO site (client_id, code, name, address_street, address_number,
        address_city, address_state, address_zip)
      SELECT id, 'S' || right(id::text, 4), 'Local ' || legal_name,
             'Rua Local', '1', 'São Paulo', 'SP', '01001000'
      FROM client WHERE id::text LIKE '5c%'`);
    await tx.execute(sql`INSERT INTO contract (site_id, start_date, end_date, art_number, status)
      SELECT s.id, '2026-01-01', '2026-12-31', 'ART-S05', 'VIGENTE'
      FROM site s WHERE s.client_id::text LIKE '5c%'`);
    await tx.execute(sql`INSERT INTO pmoc (contract_id)
      SELECT c.id FROM contract c JOIN site s ON s.id = c.site_id WHERE s.client_id::text LIKE '5c%'`);
    await tx.execute(sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title, periodicity, nature, display_order)
      SELECT p.id, ${SEED.equipmentTypeId}, 'Atividade fictícia ' || a, 'MM', 'VERIFICACAO', a
      FROM pmoc p JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id,
           generate_series(1, ${ACTIVITIES}::int) a
      WHERE s.client_id::text LIKE '5c%'`);

    // Equipamentos: 200 no cliente grande, 9 nos demais.
    await tx.execute(sql`INSERT INTO equipment (site_id, equipment_type_id, equipment_group_id,
        location_description, tag_sequence, tag)
      SELECT s.id, ${SEED.equipmentTypeId}, ${SEED.equipmentGroupId}, 'Sala ' || n, n,
             s.code || '-SPL-' || lpad(n::text, 3, '0')
      FROM site s,
           generate_series(1, CASE WHEN s.client_id = ${bigClientId}::uuid
                                   THEN ${BIG_EQUIPMENTS}::int ELSE ${SMALL_EQUIPMENTS}::int END) n
      WHERE s.client_id::text LIKE '5c%'`);
    await tx.execute(sql`INSERT INTO equipment_tag_counter (site_id, equipment_type_id, last_sequence)
      SELECT site_id, equipment_type_id, max(tag_sequence) FROM equipment e
      JOIN site s ON s.id = e.site_id WHERE s.client_id::text LIKE '5c%'
      GROUP BY site_id, equipment_type_id`);

    // Cronograma: equipamento × atividade × mês (RNF-02).
    await tx.execute(sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index,
        reference_month, due_date, status)
      SELECT pa.pmoc_id, pa.id, e.id, m,
             (DATE '2026-01-01' + (m - 1) * INTERVAL '1 month')::date,
             (DATE '2026-01-01' + m * INTERVAL '1 month' - INTERVAL '1 day')::date,
             'PREVISTA'
      FROM pmoc_activity pa
      JOIN pmoc p ON p.id = pa.pmoc_id
      JOIN contract c ON c.id = p.contract_id
      JOIN equipment e ON e.site_id = c.site_id,
      generate_series(1, ${MONTHS}::int) m
      WHERE pa.title LIKE 'Atividade fictícia%'`);

    // Uma visita por PMOC e mês, com as ocorrências do mês.
    await tx.execute(sql`INSERT INTO visit (pmoc_id, site_id, client_id, reference_month_index, reference_month, origin)
      SELECT p.id, s.id, s.client_id, m, (DATE '2026-01-01' + (m - 1) * INTERVAL '1 month')::date, 'AUTOMATICA'
      FROM pmoc p JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id,
           generate_series(1, ${MONTHS}::int) m
      WHERE s.client_id::text LIKE '5c%'`);
    await tx.execute(sql`INSERT INTO visit_occurrence (visit_id, occurrence_id)
      SELECT v.id, o.id FROM occurrence o
      JOIN visit v ON v.pmoc_id = o.pmoc_id AND v.reference_month_index = o.month_index
      WHERE v.client_id::text LIKE '5c%'`);
  });
  await db.withTransaction(sysCtx(), (tx) => tx.execute(sql`ANALYZE`));

  const [big] = (await db.withTransaction(admCtx(), (tx) =>
    tx.execute(sql`SELECT p.id AS pmoc_id, v.id AS visit_id FROM pmoc p
      JOIN contract c ON c.id = p.contract_id JOIN site s ON s.id = c.site_id
      JOIN visit v ON v.pmoc_id = p.id AND v.reference_month_index = 6
      WHERE s.client_id = ${bigClientId}`),
  )) as unknown as { pmoc_id: string; visit_id: string }[];
  bigPmocId = big?.pmoc_id ?? "";
  bigVisitId = big?.visit_id ?? "";
}

/** Consultas representativas das listas do portal (04 TL-3xx); as telas reais vêm na Etapa 9. */
const portalQueries = () => ({
  equipamentos: sql`SELECT e.id, e.tag, e.location_description, e.status FROM equipment e
    WHERE e.deleted_at IS NULL ORDER BY e.tag LIMIT 50`,
  visitas: sql`SELECT v.id, v.reference_month, v.status FROM visit v
    WHERE v.deleted_at IS NULL ORDER BY v.reference_month DESC, v.id LIMIT 50`,
  cronograma: sql`SELECT o.equipment_id, o.pmoc_activity_id, o.month_index, o.status FROM occurrence o
    WHERE o.pmoc_id = ${bigPmocId}`,
  ocorrenciasDaVisita: sql`SELECT o.id, o.equipment_id, o.status FROM visit_occurrence vo
    JOIN occurrence o ON o.id = vo.occurrence_id
    WHERE vo.visit_id = ${bigVisitId} AND vo.removed_at IS NULL`,
});

async function measure(ctx: RequestContext, q: ReturnType<typeof sql>) {
  const times: number[] = [];
  let rows = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const r = await db.withTransaction(ctx, (tx) => tx.execute(q));
    times.push(performance.now() - t0);
    rows = r.length;
  }
  times.sort((a, b) => a - b);
  return { p95: times[Math.ceil(RUNS * 0.95) - 1] as number, rows };
}

beforeAll(async () => {
  db = appDatabase(3);
  const t0 = performance.now();
  await load();
  console.log(`[S-05] carga em ${Math.round((performance.now() - t0) / 1000)} s`);
});
afterAll(async () => {
  await db.close();
});

describe("S-05 – RLS e desempenho na escala da DEC-34", () => {
  it("escala carregada (RNF-02)", async () => {
    const [c] = (await db.withTransaction(admCtx(), (tx) =>
      tx.execute(sql`SELECT
        (SELECT count(*) FROM client)::int AS clients,
        (SELECT count(*) FROM equipment)::int AS equipments,
        (SELECT count(*) FROM occurrence)::int AS occurrences,
        (SELECT count(*) FROM visit)::int AS visits`),
    )) as unknown as Record<string, number>[];
    console.log("[S-05] volume:", c);
    expect(c?.clients).toBeGreaterThanOrEqual(CLIENTS);
    expect(c?.equipments).toBeGreaterThanOrEqual(1990);
  });

  it("listas do cliente grande: p95 < 2 s (RNF-16) e só linhas próprias", async () => {
    const qs = portalQueries();
    const expected = {
      equipamentos: 50,
      visitas: MONTHS,
      cronograma: BIG_EQUIPMENTS * ACTIVITIES * MONTHS,
      ocorrenciasDaVisita: BIG_EQUIPMENTS * ACTIVITIES,
    };
    for (const [name, q] of Object.entries(qs)) {
      const cli = await measure(clientCtx(bigClientId), q);
      const adm = await measure(admCtx(), q);
      console.log(
        `[S-05] ${name}: CLIENTE p95=${cli.p95.toFixed(1)} ms (${cli.rows} linhas) | ADM p95=${adm.p95.toFixed(1)} ms (${adm.rows} linhas)`,
      );
      expect(cli.p95).toBeLessThan(P95_LIMIT_MS);
      expect(cli.rows).toBe(expected[name as keyof typeof expected]);
    }
  });

  it("outro cliente não vê nada do cliente grande, mesmo filtrando pelo id", async () => {
    const qs = portalQueries();
    for (const q of [qs.cronograma, qs.ocorrenciasDaVisita]) {
      const r = await db.withTransaction(clientCtx(smallClientId), (tx) => tx.execute(q));
      expect(r.length).toBe(0);
    }
  });

  it("plano da consulta mais pesada (cronograma) como CLIENTE", async () => {
    const plan = (await db.withTransaction(clientCtx(bigClientId), (tx) =>
      tx.execute(sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT o.equipment_id, o.month_index, o.status
        FROM occurrence o WHERE o.pmoc_id = ${bigPmocId}`),
    )) as unknown as { "QUERY PLAN": string }[];
    console.log(`[S-05] EXPLAIN cronograma:\n${plan.map((r) => r["QUERY PLAN"]).join("\n")}`);
    expect(plan.length).toBeGreaterThan(0);
  });

  it("contexto não vaza entre transações na mesma conexão (pooler em modo transação)", async () => {
    const one = appDatabase(1);
    try {
      const tasks = Array.from({ length: 40 }, (_, i) => {
        const who = i % 2 === 0 ? bigClientId : smallClientId;
        return one.withTransaction(clientCtx(who), async (tx) => {
          const r = (await tx.execute(sql`SELECT DISTINCT client_id FROM visit`)) as unknown as {
            client_id: string;
          }[];
          return { who, seen: r.map((x) => x.client_id) };
        });
      });
      for (const { who, seen } of await Promise.all(tasks)) expect(seen).toEqual([who]);
      // Depois das transações, a conexão reutilizada não carrega contexto: sem ator, nada visível.
      const after = (await one.withTransaction(
        { ...clientCtx(bigClientId), role: "" as never },
        (tx) => tx.execute(sql`SELECT count(*)::int n FROM visit`),
      )) as unknown as { n: number }[];
      expect(after[0]?.n).toBe(0);
    } finally {
      await one.close();
    }
  });
});
