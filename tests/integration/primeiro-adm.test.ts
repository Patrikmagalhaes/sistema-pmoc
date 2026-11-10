/**
 * Primeiro ADM de um banco novo (runbook `docs/runbooks/primeiro-adm.md`; DFT-01; RN-194) e acesso de
 * emergência (SEG-18; `docs/runbooks/sql/acesso-emergencia.sql`). Usa um banco próprio, migrado do
 * zero, porque o banco compartilhado dos testes já tem ADM no seed.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runMigrations } from "../../db/migrate";
import {
  type AcessoDeps,
  criarPrimeiroAdm,
  ganchosAuth,
  linkDeSenhaValido,
} from "../../src/modules/acesso";
import { createAuth } from "../../src/server/auth/config";
import { createDatabase, type Database } from "../../src/server/db";
import { memoryEmailSender } from "../../src/server/email";

const NOME_DB = "pmoc_primeiro_adm";
const trocarDb = (url: string) => {
  const u = new URL(url);
  u.pathname = `/${NOME_DB}`;
  return u.toString();
};

let admin: postgres.Sql;
let db: Database;
let deps: AcessoDeps;
const email = memoryEmailSender();

beforeAll(async () => {
  admin = postgres(inject("dbAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB}`);
  await admin.unsafe(`CREATE DATABASE ${NOME_DB}`);
  await runMigrations({
    adminUrl: trocarDb(inject("dbAdminUrl")),
    ownerUrl: trocarDb(inject("dbOwnerUrl")),
  });
  db = createDatabase(trocarDb(inject("dbAppUrl")), { max: 2 });
  const BASE = "http://localhost:3000";
  const auth = createAuth({
    db,
    secret: "teste-teste-teste-teste-teste-teste-0123",
    baseURL: BASE,
    email,
    ganchos: ganchosAuth(db, email),
    checarSenhaVazada: false,
    limitarTentativas: false,
    ipHeaders: ["x-real-ip"],
  });
  deps = { db, auth, email, baseURL: BASE };
}, 120_000);

afterAll(async () => {
  await db.close();
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB} WITH (FORCE)`);
  await admin.end();
});

describe("primeiro ADM (runbook; DFT-01)", () => {
  it("e-mail que não sai não deixa usuário criado", async () => {
    const falha = {
      ...deps,
      email: {
        async send() {
          throw new Error("sem envio");
        },
      },
    };
    await expect(
      criarPrimeiroAdm({ nome: "Primeira Pessoa", email: "primeira@empresa.test" }, falha),
    ).rejects.toThrow("sem envio");
    const o = postgres(trocarDb(inject("dbOwnerUrl")), { max: 1, onnotice: () => {} });
    try {
      const [n] = await o`SELECT (SELECT count(*) FROM app_user)::int AS app,
        (SELECT count(*) FROM auth_user)::int AS auth`;
      expect(n).toEqual({ app: 0, auth: 0 });
    } finally {
      await o.end();
    }
  });

  it("banco sem ADM: cria o ADM sem senha e envia o link inicial de 72 h", async () => {
    const { id } = await criarPrimeiroAdm(
      { nome: "Primeira Pessoa", email: "Primeira@Empresa.test" },
      deps,
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const m = email.sent.at(-1);
    expect(m?.to).toBe("primeira@empresa.test");
    const token = m?.text.match(/token=([\w-]+)/)?.[1] as string;
    expect(await linkDeSenhaValido(token, deps)).toBe(true);
  });

  it("depois que existe ADM, o script é recusado", async () => {
    await expect(
      criarPrimeiroAdm({ nome: "Outra", email: "outra@empresa.test" }, deps),
    ).rejects.toMatchObject({ codigo: "JA_EXISTE_ADM" });
  });
});

describe("acesso de emergência pelo SQL do runbook (SEG-18)", () => {
  const SCRIPT = readFileSync("docs/runbooks/sql/acesso-emergencia.sql", "utf8");
  const MOTIVO = "SEG-18: perdeu celular e códigos – operador Teste, dono Teste";

  /** Como o operador faz: uma sessão do dono, três parâmetros e o arquivo. */
  async function executar(acao: string, motivo = MOTIVO) {
    const owner = postgres(trocarDb(inject("dbOwnerUrl")), { max: 1, onnotice: () => {} });
    try {
      await owner`SELECT set_config('emergencia.email', 'primeira@empresa.test', false),
        set_config('emergencia.acao', ${acao}, false), set_config('emergencia.motivo', ${motivo}, false)`;
      await owner.unsafe(SCRIPT);
    } finally {
      await owner.end();
    }
  }

  const ler = async () => {
    const o = postgres(trocarDb(inject("dbOwnerUrl")), { max: 1, onnotice: () => {} });
    try {
      const [u] = await o`SELECT u.id, u.status, u.auth_user_id, a.two_factor_enabled, a.banned,
          (SELECT count(*)::int FROM auth_two_factor t WHERE t.user_id = a.id) AS fatores,
          (SELECT count(*)::int FROM auth_session s WHERE s.user_id = a.id) AS sessoes
        FROM app_user u JOIN auth_user a ON a.id = u.auth_user_id WHERE u.email = 'primeira@empresa.test'`;
      return { o, u: u as Record<string, unknown> };
    } catch (e) {
      await o.end();
      throw e;
    }
  };

  it("SEGUNDO_FATOR: apaga TOTP e sessões e grava audit_log e security_event com o motivo", async () => {
    const { o, u } = await ler();
    try {
      // estado de partida: ADM com segundo fator e uma sessão aberta
      await o`UPDATE auth_user SET two_factor_enabled = true WHERE id = ${u.auth_user_id as string}`;
      await o`INSERT INTO auth_two_factor (id, secret, backup_codes, user_id)
        VALUES ('tf1', 'x', 'y', ${u.auth_user_id as string})`;
      await o`INSERT INTO auth_session (id, token, user_id, expires_at, created_at, updated_at)
        VALUES ('s1', 'tok1', ${u.auth_user_id as string}, now() + interval '1 day', now(), now())`;
    } finally {
      await o.end();
    }
    await executar("SEGUNDO_FATOR");
    const depois = await ler();
    try {
      expect(depois.u).toMatchObject({ two_factor_enabled: false, fatores: 0, sessoes: 0 });
      const [log] = await depois.o`SELECT actor_role, source, reason FROM audit_log
        WHERE table_name = 'auth_user' AND record_id = ${u.auth_user_id as string}`;
      expect(log).toEqual({ actor_role: "SISTEMA", source: "SISTEMA", reason: MOTIVO });
      const ev = await depois.o`SELECT event_type FROM security_event
        WHERE user_id = ${u.id as string} ORDER BY event_type`;
      expect(ev.map((e) => e.event_type)).toEqual(["MFA_REMOVIDO", "SESSAO_REVOGADA"]);
    } finally {
      await depois.o.end();
    }
    // sem segundo fator, repetir é recusado e nada muda
    await expect(executar("SEGUNDO_FATOR")).rejects.toThrow(/não tem segundo fator/);
  });

  it("REATIVAR: único ADM inativo volta a ATIVO, sem banimento, com motivo no audit_log", async () => {
    const { o, u } = await ler();
    try {
      await o.begin(async (t) => {
        await t`SELECT set_config('app.source', 'SISTEMA', true)`;
        await t`UPDATE app_user SET status = 'INATIVO', inactivated_at = now() WHERE id = ${u.id as string}`;
        await t`UPDATE auth_user SET banned = true, ban_reason = 'INATIVADO' WHERE id = ${u.auth_user_id as string}`;
      });
    } finally {
      await o.end();
    }
    await expect(executar("SEGUNDO_FATOR")).rejects.toThrow(/INATIVO/);
    await expect(executar("REATIVAR", "  ")).rejects.toThrow(/emergencia.motivo/);
    await executar("REATIVAR");
    const depois = await ler();
    try {
      expect(depois.u).toMatchObject({ status: "ATIVO", banned: false });
      const [log] = await depois.o`SELECT reason, changed_fields FROM audit_log
        WHERE table_name = 'app_user' AND record_id = ${u.id as string} ORDER BY id DESC LIMIT 1`;
      expect(log?.reason).toBe(MOTIVO);
      expect(log?.changed_fields).toContain("status");
    } finally {
      await depois.o.end();
    }
  });
});
