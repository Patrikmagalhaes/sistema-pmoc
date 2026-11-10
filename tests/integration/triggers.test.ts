import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { admCtx, appDatabase, ensureSeed, failureText, SEED } from "./helpers";

const db = appDatabase();
const owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });

type Row = Record<string, unknown>;
const rows = async (ctx: ReturnType<typeof admCtx>, q: ReturnType<typeof sql>) =>
  db.withTransaction(ctx, async (tx) => (await tx.execute(q)) as unknown as Row[]);

beforeAll(() => ensureSeed(db));
afterAll(async () => {
  await db.close();
  await owner.end();
});

describe("auditoria (03 §5.3)", () => {
  it("INSERT, UPDATE e SOFT_DELETE geram linhas com ator, canal e valores alterados", async () => {
    const ctx = { ...admCtx(), reason: "teste de auditoria" };
    const [t] = await rows(
      ctx,
      sql`INSERT INTO equipment_type (name, acronym) VALUES ('Fan coil', 'FCL') RETURNING id::text AS id`,
    );
    const id = t?.id as string;
    await rows(ctx, sql`UPDATE equipment_type SET name = 'Fan coil v2' WHERE id = ${id}`);
    await rows(
      ctx,
      sql`UPDATE equipment_type SET deleted_at = now(), deleted_by_user_id = ${ctx.userId} WHERE id = ${id}`,
    );

    const log = await rows(
      ctx,
      sql`SELECT action, actor_user_id::text AS actor, actor_role, source, reason, changed_fields,
        old_values, new_values FROM audit_log WHERE table_name = 'equipment_type' AND record_id = ${id}
        ORDER BY id`,
    );
    expect(log.map((l) => l.action)).toEqual(["INSERT", "UPDATE", "SOFT_DELETE"]);
    expect(log[0]).toMatchObject({
      actor: ctx.userId,
      actor_role: "ADM",
      source: "WEB_ADM",
      reason: ctx.reason,
    });
    expect(log[1]?.changed_fields).toEqual(["name"]);
    expect(log[1]?.old_values).toEqual({ name: "Fan coil" });
    expect(log[1]?.new_values).toEqual({ name: "Fan coil v2" });
    expect(log[2]?.changed_fields).toEqual(
      expect.arrayContaining(["deleted_at", "deleted_by_user_id"]),
    );
  });

  it("UPDATE sem mudança real não gera linha, mas o row_version sobe (lock otimista)", async () => {
    const ctx = admCtx();
    const [t] = await rows(
      ctx,
      sql`INSERT INTO equipment_type (name, acronym) VALUES ('Chiller', 'CHL') RETURNING id::text AS id`,
    );
    const id = t?.id as string;
    await rows(ctx, sql`UPDATE equipment_type SET name = name WHERE id = ${id}`);
    const log = await rows(
      ctx,
      sql`SELECT 1 FROM audit_log WHERE table_name = 'equipment_type' AND record_id = ${id}`,
    );
    expect(log).toHaveLength(1); // só o INSERT
    const [v] = await rows(ctx, sql`SELECT row_version FROM equipment_type WHERE id = ${id}`);
    expect(v?.row_version).toBe(2);
  });

  it("mascara encrypted_pkcs12 e encrypted_password (RN-121)", async () => {
    const ctx = admCtx();
    const [rt] = await rows(ctx, sql`SELECT id::text AS id FROM technical_responsible LIMIT 1`);
    const [c] = await rows(
      ctx,
      sql`INSERT INTO rt_certificate (technical_responsible_id, certificate_type, encrypted_pkcs12,
        encrypted_password, encryption_key_ref, holder_name, serial_number, valid_from, valid_until)
        VALUES (${rt?.id as string}, 'A1', '\\xdeadbeef', '\\xcafebabe', 'k1', 'Rui', '123',
        now(), now() + interval '1 year') RETURNING id::text AS id`,
    );
    const [log] = await rows(
      ctx,
      sql`SELECT new_values FROM audit_log WHERE table_name = 'rt_certificate' AND record_id = ${c?.id as string}`,
    );
    const nv = log?.new_values as Row;
    expect(nv.encrypted_pkcs12).toBe("***");
    expect(nv.encrypted_password).toBe("***");
  });

  it("tabelas fora da auditoria não geram linha (notification, device)", async () => {
    const ctx = admCtx();
    const before = await rows(
      ctx,
      sql`SELECT count(*)::int AS n FROM audit_log WHERE table_name = 'notification'`,
    );
    await rows(
      ctx,
      sql`INSERT INTO notification (recipient_user_id, event_type, title, body)
        VALUES (${SEED.admUserId}, 'VISITA_AGENDADA', 'x', 'y')`,
    );
    const after = await rows(
      ctx,
      sql`SELECT count(*)::int AS n FROM audit_log WHERE table_name = 'notification'`,
    );
    expect(after[0]?.n).toBe(before[0]?.n);
  });
});

describe("exclusão lógica e imutabilidade (03 §5.4)", () => {
  it("DELETE físico é recusado em tabela de negócio, até para o dono (EL-1)", async () => {
    await expect(owner`DELETE FROM client WHERE id = ${SEED.clientAId}`).rejects.toThrow(
      /exclusão física proibida/,
    );
    const text = await failureText(
      db.withTransaction(admCtx(), (tx) =>
        tx.execute(sql`DELETE FROM site WHERE id = ${SEED.siteAId}`),
      ),
    );
    expect(text).toMatch(/exclusão física proibida|permission denied/);
  });

  it("tabelas [I] não aceitam UPDATE (stored_file, document_follow_up_note...)", async () => {
    await expect(
      owner`UPDATE stored_file SET mime_type = 'x/y' WHERE id = ${SEED.fileAId}`,
    ).rejects.toThrow(/imutável/);
    await expect(owner`DELETE FROM stored_file WHERE id = ${SEED.fileAId}`).rejects.toThrow(
      /imutável/,
    );
  });

  it("exceções do EL-1 podem ser excluídas: idempotency_key, rate_limit_counter, equipment_tag_counter", async () => {
    await rows(
      admCtx(),
      sql`INSERT INTO rate_limit_counter (key, window_start, count) VALUES ('t:1', now(), 1)`,
    );
    const deleted = await rows(
      admCtx(),
      sql`DELETE FROM rate_limit_counter WHERE key = 't:1' RETURNING key`,
    );
    expect(deleted).toHaveLength(1);
  });

  it("visit_occurrence: só as colunas de remoção mudam", async () => {
    const ctx = admCtx();
    const [occ] = await rows(
      ctx,
      sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title, periodicity, nature, display_order)
        VALUES (${SEED.pmocAId}, ${SEED.equipmentTypeId}, 'Atividade', 'MM', 'VERIFICACAO', 1) RETURNING id::text AS id`,
    );
    const [o] = await rows(
      ctx,
      sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index, reference_month, due_date, status)
        VALUES (${SEED.pmocAId}, ${occ?.id as string}, ${SEED.equipmentAId}, 1, '2026-01-01', '2026-01-31', 'PREVISTA')
        RETURNING id::text AS id`,
    );
    const [vo] = await rows(
      ctx,
      sql`INSERT INTO visit_occurrence (visit_id, occurrence_id) VALUES (${SEED.visitAId}, ${o?.id as string})
        RETURNING id::text AS id`,
    );
    const voId = vo?.id as string;
    const bad = await failureText(
      db.withTransaction(ctx, (tx) =>
        tx.execute(sql`UPDATE visit_occurrence SET visit_id = ${SEED.visitBId} WHERE id = ${voId}`),
      ),
    );
    expect(bad).toMatch(/só removed_at/);
    const ok = await rows(
      ctx,
      sql`UPDATE visit_occurrence SET removed_at = now(), removal_reason = 'VISITA_CANCELADA' WHERE id = ${voId} RETURNING id`,
    );
    expect(ok).toHaveLength(1);
  });
});

describe("client_id desnormalizado (AF-06)", () => {
  it("é preenchido pelo trigger a partir do local, mesmo se o chamador mandar outro", async () => {
    const ctx = admCtx();
    const [v] = await rows(
      ctx,
      sql`INSERT INTO visit (pmoc_id, site_id, client_id, reference_month_index, reference_month, origin)
        VALUES (${SEED.pmocBId}, ${SEED.siteBId}, ${SEED.clientAId}, 2, '2026-02-01', 'AVULSA')
        RETURNING id::text AS id, client_id::text AS client_id`,
    );
    expect(v?.client_id).toBe(SEED.clientBId);
  });

  it("é imutável depois do INSERT", async () => {
    const text = await failureText(
      db.withTransaction(admCtx(), (tx) =>
        tx.execute(sql`UPDATE visit SET client_id = ${SEED.clientBId} WHERE id = ${SEED.visitAId}`),
      ),
    );
    expect(text).toMatch(/client_id é imutável/);
  });
});
