import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { admCtx, appDatabase, ensureSeed, failureText, SEED } from "./helpers";

const db = appDatabase();
const owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });

const run = (q: ReturnType<typeof sql>) => db.withTransaction(admCtx(), (tx) => tx.execute(q));
const fails = (q: ReturnType<typeof sql>) => failureText(run(q));

beforeAll(() => ensureSeed(db));
afterAll(async () => {
  await db.close();
  await owner.end();
});

describe("is_valid_cnpj (CA-05.1, DM-13)", () => {
  const valid = async (c: string) => {
    const [r] = await owner`SELECT is_valid_cnpj(${c}) AS ok`;
    return r?.ok as boolean;
  };

  it("aceita CNPJ numérico válido e recusa dígito verificador errado", async () => {
    expect(await valid("11222333000181")).toBe(true);
    expect(await valid("11222333000182")).toBe(false);
  });

  it("recusa CPF (11 dígitos), tamanho errado e caracteres repetidos", async () => {
    expect(await valid("12345678909")).toBe(false);
    expect(await valid("11111111111111")).toBe(false);
    expect(await valid("1122233300018")).toBe(false);
  });

  it("calcula o alfanumérico (valor = ASCII - 48)", async () => {
    // Cálculo independente do algoritmo: 12 primeiros = 12ABC34500AB, DV calculados abaixo.
    const base = "12ABC34500AB";
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, ...w1];
    const val = (ch: string) => ch.charCodeAt(0) - 48;
    const dv = (s: number) => (s % 11 < 2 ? 0 : 11 - (s % 11));
    const d1 = dv([...base].reduce((a, ch, i) => a + val(ch) * (w1[i] as number), 0));
    const d2 = dv([...base, String(d1)].reduce((a, ch, i) => a + val(ch) * (w2[i] as number), 0));
    expect(await valid(`${base}${d1}${d2}`)).toBe(true);
    expect(await valid(`${base}${d1}${(d2 + 1) % 10}`)).toBe(false);
  });

  it("client recusa CNPJ inválido e duplicado entre vivos", async () => {
    const insert = (cnpj: string) =>
      sql`INSERT INTO client (legal_name, cnpj, address_street, address_number, address_city, address_state, address_zip)
        VALUES ('T', ${cnpj}, 'R', '1', 'SP', 'SP', '01001000')`;
    expect(await fails(insert("11222333000182"))).toMatch(/check/i);
    expect(await fails(insert("11222333000181"))).toMatch(/duplicate|unique/i);
  });
});

describe("regras de coluna do doc 03", () => {
  it("endereço: sem número exige address_without_number (CA-05.4)", async () => {
    const q = sql`INSERT INTO client (legal_name, cnpj, address_street, address_city, address_state, address_zip)
      VALUES ('T', '00000000000191', 'R', 'SP', 'SP', '01001000')`;
    expect(await fails(q)).toMatch(/check/i);
  });

  it("periodicity_months (RN-020)", async () => {
    const r = await owner`SELECT periodicity_months('MM') AS mm, periodicity_months('MB') AS mb,
      periodicity_months('MT') AS mt, periodicity_months('MS') AS ms, periodicity_months('MA') AS ma`;
    expect(r[0]).toEqual({ mm: 1, mb: 2, mt: 3, ms: 6, ma: 12 });
  });

  it("contract.month_count é gerado (RN-022, D-03 a)", async () => {
    const r = await run(sql`SELECT month_count FROM contract WHERE id = ${SEED.contractAId}`);
    expect((r[0] as { month_count: number }).month_count).toBe(12);
  });

  it("contratos não cancelados do mesmo local não se sobrepõem (RN-143)", async () => {
    const q = sql`INSERT INTO contract (site_id, start_date, end_date, art_number, status)
      VALUES (${SEED.siteAId}, '2026-06-01', '2027-05-31', 'ART-2', 'A_INICIAR')`;
    expect(await fails(q)).toMatch(/exclusion|conflicting/i);
  });

  it("contrato cancelado exige data e motivo (RN-144) e não conta na sobreposição", async () => {
    const semMotivo = sql`INSERT INTO contract (site_id, start_date, end_date, art_number, status)
      VALUES (${SEED.siteAId}, '2026-06-01', '2027-05-31', 'ART-3', 'CANCELADO')`;
    expect(await fails(semMotivo)).toMatch(/check/i);
    const ok = sql`INSERT INTO contract (site_id, start_date, end_date, art_number, status, cancelled_on, cancellation_reason)
      VALUES (${SEED.siteAId}, '2026-06-01', '2027-05-31', 'ART-4', 'CANCELADO', '2026-07-01', 'Teste')`;
    await expect(run(ok)).resolves.toBeDefined();
  });

  it("equipamento: grupo precisa pertencer ao tipo (FK composta, RN-041)", async () => {
    const [other] = (await run(
      sql`INSERT INTO equipment_type (name, acronym) VALUES ('Outro tipo', 'OTP') RETURNING id::text AS id`,
    )) as unknown as { id: string }[];
    const q = sql`INSERT INTO equipment (site_id, equipment_type_id, equipment_group_id, location_description, tag_sequence, tag)
      VALUES (${SEED.siteAId}, ${other?.id as string}, ${SEED.equipmentGroupId}, 'Sala', 1, 'L001-OTP-001')`;
    expect(await fails(q)).toMatch(/foreign key/i);
  });

  it("TAG e (local, tipo, sequencial) são únicos (RN-046)", async () => {
    const q = sql`INSERT INTO equipment (site_id, equipment_type_id, equipment_group_id, location_description, tag_sequence, tag)
      VALUES (${SEED.siteAId}, ${SEED.equipmentTypeId}, ${SEED.equipmentGroupId}, 'Sala', 2, 'L001-SPL-001')`;
    expect(await fails(q)).toMatch(/duplicate|unique/i);
  });

  it("atividade MEDICAO exige unidade e VERIFICACAO a proíbe (RN-042)", async () => {
    const base = (nature: string, unit: string | null) =>
      sql`INSERT INTO activity_template (equipment_type_id, title, default_periodicity, nature, unit, display_order)
        VALUES (${SEED.equipmentTypeId}, ${`T ${nature} ${unit}`}, 'MM', ${nature}, ${unit}, 9)`;
    expect(await fails(base("MEDICAO", null))).toMatch(/check/i);
    expect(await fails(base("VERIFICACAO", "A"))).toMatch(/check/i);
    await expect(run(base("MEDICAO", "A"))).resolves.toBeDefined();
  });

  it("occurrence_record: NOK exige observação; requires_corrective só com OK (RN-083, RN-193)", async () => {
    const [pa] = (await run(
      sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title, periodicity, nature, display_order)
        VALUES (${SEED.pmocBId}, ${SEED.equipmentTypeId}, 'Atv B', 'MM', 'VERIFICACAO', 1) RETURNING id::text AS id`,
    )) as unknown as { id: string }[];
    const [occ] = (await run(
      sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index, reference_month, due_date, status)
        VALUES (${SEED.pmocBId}, ${pa?.id as string}, ${SEED.equipmentBId}, 1, '2026-01-01', '2026-01-31', 'PREVISTA')
        RETURNING id::text AS id`,
    )) as unknown as { id: string }[];
    const rec = (result: string, observation: string | null, corrective: boolean) =>
      sql`INSERT INTO occurrence_record (occurrence_id, result, activity_nature, requires_corrective, observation,
        executed_on, executed_by_user_id, source, finalized_at, finalized_by_user_id)
        VALUES (${occ?.id as string}, ${result}, 'VERIFICACAO', ${corrective}, ${observation}, '2026-01-10',
        ${SEED.technicianUserId}, 'APP_TECNICO', now(), ${SEED.technicianUserId})`;
    expect(await fails(rec("NOK", null, false))).toMatch(/check/i);
    expect(await fails(rec("NOK", "não feito", true))).toMatch(/check/i);
    expect(await fails(rec("OK", null, true))).toMatch(/check/i);
    await expect(run(rec("OK", "filtro com sujeira", true))).resolves.toBeDefined();
  });

  it("occurrence: PENDENTE exige pending_since; NAO_PREVISTA exige motivo (RF-11)", async () => {
    const [pa] = (await run(
      sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title, periodicity, nature, display_order)
        VALUES (${SEED.pmocAId}, ${SEED.equipmentTypeId}, 'Atv A', 'MM', 'VERIFICACAO', 1) RETURNING id::text AS id`,
    )) as unknown as { id: string }[];
    const q = (status: string) =>
      sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index, reference_month, due_date, status)
        VALUES (${SEED.pmocAId}, ${pa?.id as string}, ${SEED.equipmentAId}, 5, '2026-05-01', '2026-05-31', ${status})`;
    expect(await fails(q("PENDENTE"))).toMatch(/check/i);
    expect(await fails(q("NAO_PREVISTA"))).toMatch(/check/i);
  });

  it("visit: REGISTRADA exige os campos de finalização (RN-086)", async () => {
    const q = sql`INSERT INTO visit (pmoc_id, site_id, client_id, reference_month_index, reference_month, origin, status)
      VALUES (${SEED.pmocAId}, ${SEED.siteAId}, ${SEED.clientAId}, 3, '2026-03-01', 'AVULSA', 'REGISTRADA')`;
    expect(await fails(q)).toMatch(/check/i);
  });

  it("app_user: CLIENTE exige client_id e os outros perfis o proíbem (RN-169)", async () => {
    const q = (role: string, clientId: string | null) =>
      sql`WITH a AS (INSERT INTO auth_user (id, name, email) VALUES (${`a-${role}-${clientId}`}, 'n', ${`${role}-${clientId}@x.test`}) RETURNING id)
        INSERT INTO app_user (name, email, auth_user_id, role, client_id)
        SELECT 'n', ${`${role}-${clientId}@x.test`}, id, ${role}, ${clientId} FROM a`;
    expect(await fails(q("CLIENTE", null))).toMatch(/check/i);
    expect(await fails(q("ADM", SEED.clientAId))).toMatch(/check/i);
  });

  it("e-mail de app_user é único sem diferenciar maiúsculas (CA-02.2)", async () => {
    const q = sql`WITH a AS (INSERT INTO auth_user (id, name, email) VALUES ('dup-auth', 'n', 'dup-auth@x.test') RETURNING id)
      INSERT INTO app_user (name, email, auth_user_id, role) SELECT 'n', 'ADM@EXEMPLO.TEST', id, 'ADM' FROM a`;
    expect(await fails(q)).toMatch(/duplicate|unique/i);
  });
});

describe("estrutura", () => {
  it("toda coluna *_user_id aponta para app_user (exceto audit_log e security_event)", async () => {
    const r = await owner`SELECT c.table_name, c.column_name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND (c.column_name = 'user_id' OR c.column_name LIKE '%\_user\_id')
      AND c.table_name NOT IN ('audit_log', 'security_event')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.contype = 'f' AND k.conrelid = format('public.%I', c.table_name)::regclass
        AND k.conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = k.conrelid AND attname = c.column_name)])`;
    expect(r).toEqual([]);
  });

  it("toda FK tem índice não parcial cobrindo a primeira coluna (03 §5.2)", async () => {
    const r = await owner`SELECT k.conrelid::regclass::text AS tbl, k.conname FROM pg_constraint k
      WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = k.conrelid AND i.indpred IS NULL AND i.indkey[0] = k.conkey[1])`;
    expect(r).toEqual([]);
  });

  it("migrações são idempotentes: rodar de novo não aplica nada", async () => {
    const { runMigrations } = await import("../../db/migrate");
    expect(await runMigrations({ ownerUrl: inject("dbOwnerUrl") })).toEqual([]);
  });

  it("tabelas novas recebem permissões mínimas (apply_app_grants)", async () => {
    const [r] = await owner`SELECT has_table_privilege('app_rw', 'audit_log', 'UPDATE') AS upd,
      has_table_privilege('app_rw', 'audit_log', 'INSERT') AS ins,
      has_table_privilege('app_rw', 'client', 'DELETE') AS del,
      has_table_privilege('app_rw', 'schema_migration', 'SELECT') AS mig,
      has_table_privilege('backup_ro', 'client', 'SELECT') AS bk`;
    expect(r).toEqual({ upd: false, ins: true, del: false, mig: false, bk: true });
  });
});
