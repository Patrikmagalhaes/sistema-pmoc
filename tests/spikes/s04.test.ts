/**
 * Spike S-04 (docs/05 §10.4): Better Auth 1.7.10 sem cadastro público + admin + TOTP do ADM
 * + sessões revogáveis, com tabelas auth_* (AF-04). Roda no Postgres do global-setup, usando o papel app_rw.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDatabase } from "../../src/server/db";
import { ensureSeed, SEED, sysCtx } from "../integration/helpers";
import * as tables from "./s04-schema";

const BASE = "http://localhost:3000";
const H = { "content-type": "application/json", origin: BASE };
const HOUR = 3600;
const DAY = 24 * HOUR;

// RBAC: ADM administra usuários, mas NÃO tem "set-role" (decisão B6; DFT-04).
const ac = createAccessControl({
  user: ["create", "list", "ban", "get", "update", "delete", "set-password", "set-role"],
  session: ["list", "revoke", "delete"],
} as const);
const roles = {
  ADM: ac.newRole({
    user: ["create", "list", "ban", "get", "update", "set-password"],
    session: ["list", "revoke", "delete"],
  }),
  TECNICO: ac.newRole({ user: [], session: [] }),
  CLIENTE: ac.newRole({ user: [], session: [] }),
};
const SESSION_BY_ROLE: Record<string, number> = {
  ADM: 12 * HOUR,
  CLIENTE: 12 * HOUR,
  TECNICO: 30 * DAY,
};

let owner: postgres.Sql;
let appDb: ReturnType<typeof createDatabase>;
const sentResets: { email: string; token: string }[] = [];
const hookCalls: string[] = [];

function makeAuth(url: string) {
  const pg = postgres(url, { prepare: false, max: 2, onnotice: () => {} });
  // Achado: com modelName customizado, as chaves do schema são os nomes das tabelas.
  const schema = {
    auth_user: tables.user,
    auth_session: tables.session,
    auth_account: tables.account,
    auth_verification: tables.verification,
    auth_two_factor: tables.twoFactor,
  };
  const db = drizzle(pg, { schema });
  const auth = betterAuth({
    baseURL: BASE,
    secret: "spike-secret-spike-secret-spike-secret-0123456789",
    database: drizzleAdapter(db, { provider: "pg", schema }),
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      expiresIn: 12 * HOUR,
      updateAge: 60, // desliza a expiração a cada uso (inatividade)
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    rateLimit: { enabled: false },
    advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: 30 * 60,
      sendResetPassword: async ({ user, token }) => {
        sentResets.push({ email: user.email, token });
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (s) => {
            // SEG-10 por perfil + AF-04: recusa INATIVO lendo app_user com contexto SISTEMA.
            const rows = await appDb.withTransaction(sysCtx(), (tx) =>
              tx.execute(sql`SELECT role, status FROM app_user WHERE auth_user_id = ${s.userId}`),
            );
            const row = (rows as unknown as { role: string; status: string }[])[0];
            hookCalls.push(`${s.userId}:${row?.status}`);
            if (!row || row.status !== "ATIVO") return false;
            return {
              data: {
                ...s,
                expiresAt: new Date(Date.now() + (SESSION_BY_ROLE[row.role] ?? 0) * 1000),
              },
            };
          },
        },
      },
    },
    plugins: [
      admin({ ac, roles, adminRoles: ["ADM"], defaultRole: "CLIENTE" }),
      twoFactor({ issuer: "PMOC", twoFactorTable: "auth_two_factor" }),
    ],
  });
  return { auth, pg };
}

class Jar {
  cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0] ?? "";
      const i = kv.indexOf("=");
      const v = kv.slice(i + 1);
      if (v === "" || /max-age=0/i.test(c)) this.cookies.delete(kv.slice(0, i));
      else this.cookies.set(kv.slice(0, i), v);
    }
  }
  get header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function one<T>(rows: readonly T[]): T {
  if (rows.length === 0) throw new Error("esperava ao menos uma linha");
  return rows[0] as T;
}

let lib: ReturnType<typeof makeAuth>;
// biome-ignore lint/suspicious/noExplicitAny: spike, corpo JSON arbitrário
type Json = any;

async function call(path: string, body?: unknown, jar?: Jar) {
  const res = await lib.auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...H, ...(jar?.header ? { cookie: jar.header } : {}), "x-real-ip": "203.0.113.9" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  jar?.absorb(res);
  const text = await res.text();
  let json: Json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // corpo vazio
  }
  return { status: res.status, json };
}

/** Cria usuário direto no banco (bootstrap do 1º ADM, que não tem quem o crie) + app_user. */
async function bootstrapUser(
  id: string,
  email: string,
  role: string,
  password: string,
  status = "ATIVO",
) {
  const c = await lib.auth.$context;
  await owner`INSERT INTO auth_user (id, name, email, email_verified, role, banned)
    VALUES (${id}, ${email}, ${email}, true, ${role}, false)`;
  await owner`INSERT INTO auth_account (id, account_id, provider_id, user_id, password)
    VALUES (${`acc-${id}`}, ${id}, 'credential', ${id}, ${await c.password.hash(password)})`;
  await appDb.withTransaction(sysCtx(), async (tx) => {
    await tx.execute(sql`INSERT INTO app_user (name, email, auth_user_id, role, status, inactivated_at, client_id)
      VALUES (${email}, ${email}, ${id}, ${role}, ${status},
              ${status === "INATIVO" ? sql`now()` : sql`NULL`},
              ${role === "CLIENTE" ? SEED.clientAId : null})`);
  });
}

/** TOTP RFC 6238 (SHA-1, 6 dígitos, 30 s) a partir do segredo base32 do totpURI. */
function totp(base32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = (h[19] as number) & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let admSecret = "";
const admTotp = (jar: Jar) => call("/two-factor/verify-totp", { code: totp(admSecret) }, jar);

beforeAll(async () => {
  owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });
  await owner.unsafe(readFileSync(new URL("./s04.sql", import.meta.url), "utf8"));
  await owner.unsafe(
    "GRANT SELECT, INSERT, UPDATE, DELETE ON auth_session, auth_account, auth_verification, auth_two_factor TO app_rw",
  );
  appDb = createDatabase(inject("dbAppUrl"), { max: 2 });
  await ensureSeed(appDb);
  lib = makeAuth(inject("dbAppUrl")); // a biblioteca roda como app_rw, como em produção
});
afterAll(async () => {
  await lib.pg.end();
  await owner.end();
  await appDb.close();
});

describe("S-04 – Better Auth 1.7.10", () => {
  it("1. nenhuma rota pública cria usuário", async () => {
    const r = await call("/sign-up/email", {
      email: "intruso@x.test",
      password: "senha-forte-123",
      name: "X",
    });
    console.log("[S-04] sign-up:", r.status, r.json);
    expect(r.status).toBeGreaterThanOrEqual(400);
    const { n } = one(
      await owner`SELECT count(*)::int n FROM auth_user WHERE email = 'intruso@x.test'`,
    );
    expect(n).toBe(0);
  });

  it("2. ADM cria usuário; TECNICO não cria; ADM não troca perfil", async () => {
    await bootstrapUser("adm1", "adm1@x.test", "ADM", "senha-adm-12345");
    await bootstrapUser("tec1", "tec1@x.test", "TECNICO", "senha-tec-12345");

    const adm = new Jar();
    expect(
      (await call("/sign-in/email", { email: "adm1@x.test", password: "senha-adm-12345" }, adm))
        .status,
    ).toBe(200);
    const created = await call(
      "/admin/create-user",
      { email: "novo@x.test", name: "Novo", password: "temp-senha-98765" },
      adm,
    );
    console.log("[S-04] create-user:", created.status, created.json?.user?.role ?? created.json);
    expect(created.status).toBe(200);
    expect(created.json.user.role).toBe("CLIENTE"); // defaultRole; a fonte de verdade é app_user.role
    // Perfil atribuído só no servidor (adaptador interno), nunca por rota pública.
    const c = await lib.auth.$context;
    await c.internalAdapter.updateUser(created.json.user.id, { role: "TECNICO" });
    const { role } = one(
      await owner`SELECT role FROM auth_user WHERE id = ${created.json.user.id}`,
    );
    expect(role).toBe("TECNICO");
    // create-user com role no corpo exige "set-role", que o ADM não tem:
    const withRole = await call(
      "/admin/create-user",
      { email: "r@x.test", name: "R", password: "temp-senha-98765", role: "ADM" },
      adm,
    );
    console.log("[S-04] create-user com role no corpo:", withRole.status, withRole.json?.code);
    expect(withRole.status).toBe(403);

    const setRole = await call(
      "/admin/set-role",
      { userId: created.json.user.id, role: "ADM" },
      adm,
    );
    console.log("[S-04] set-role pelo ADM:", setRole.status, setRole.json?.code ?? setRole.json);
    expect(setRole.status).toBeGreaterThanOrEqual(400);

    const tec = new Jar();
    await call("/sign-in/email", { email: "tec1@x.test", password: "senha-tec-12345" }, tec);
    const denied = await call(
      "/admin/create-user",
      { email: "n2@x.test", name: "N2", password: "temp-senha-98765" },
      tec,
    );
    expect(denied.status).toBeGreaterThanOrEqual(400);
  });

  it("3. sessão por perfil (SEG-10) e IP vindo de x-real-ip (SEG-68)", async () => {
    const rows = await owner`SELECT u.role, s.expires_at, s.created_at, s.ip_address
      FROM auth_session s JOIN auth_user u ON u.id = s.user_id`;
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      const secs = Math.round((r.expires_at.getTime() - r.created_at.getTime()) / 1000);
      console.log(`[S-04] sessão ${r.role}: ${secs / 3600} h, ip=${r.ip_address}`);
      expect(Math.abs(secs - (SESSION_BY_ROLE[r.role as string] ?? 0))).toBeLessThan(5);
      expect(r.ip_address).toBe("203.0.113.9");
    }
  });

  it("4. usuário INATIVO não entra (hook lê app_user com contexto SISTEMA)", async () => {
    await bootstrapUser("ina1", "ina1@x.test", "CLIENTE", "senha-ina-12345", "INATIVO");
    const r = await call(
      "/sign-in/email",
      { email: "ina1@x.test", password: "senha-ina-12345" },
      new Jar(),
    );
    console.log("[S-04] INATIVO:", r.status, r.json);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(hookCalls).toContain("ina1:INATIVO");
    const { n } = one(await owner`SELECT count(*)::int n FROM auth_session WHERE user_id = 'ina1'`);
    expect(n).toBe(0);
  });

  it("5. TOTP do ADM: habilitar, 10 códigos, login exige 2º fator, segredo cifrado", async () => {
    const adm = new Jar();
    await call("/sign-in/email", { email: "adm1@x.test", password: "senha-adm-12345" }, adm);
    const en = await call("/two-factor/enable", { password: "senha-adm-12345" }, adm);
    expect(en.status).toBe(200);
    expect(en.json.backupCodes).toHaveLength(10);
    const secret = new URL(en.json.totpURI).searchParams.get("secret") as string;
    const stored = one(await owner`SELECT secret FROM auth_two_factor WHERE user_id = 'adm1'`);
    console.log("[S-04] segredo cifrado no banco:", !stored.secret.includes(secret));
    expect(stored.secret).not.toContain(secret);

    admSecret = secret;
    expect((await admTotp(adm)).status).toBe(200);

    const again = new Jar();
    const login = await call(
      "/sign-in/email",
      { email: "adm1@x.test", password: "senha-adm-12345" },
      again,
    );
    console.log("[S-04] login ADM com 2FA:", login.status, JSON.stringify(login.json));
    expect(login.json.twoFactorRedirect).toBe(true);
    expect((await call("/get-session", undefined, again)).json).toBeNull(); // sem sessão plena
    expect(
      (await call("/two-factor/verify-totp", { code: "000000" }, again)).status,
    ).toBeGreaterThanOrEqual(400);
    expect((await admTotp(again)).status).toBe(200);

    const rec = new Jar();
    await call("/sign-in/email", { email: "adm1@x.test", password: "senha-adm-12345" }, rec);
    const bk = await call("/two-factor/verify-backup-code", { code: en.json.backupCodes[0] }, rec);
    expect(bk.status).toBe(200);
  });

  it("6. revogação e banimento derrubam sessão ativa", async () => {
    await bootstrapUser("cli1", "cli1@x.test", "CLIENTE", "senha-cli-12345");
    const cli = new Jar();
    expect(
      (await call("/sign-in/email", { email: "cli1@x.test", password: "senha-cli-12345" }, cli))
        .status,
    ).toBe(200);
    expect((await call("/get-session", undefined, cli)).json?.user?.id).toBe("cli1");

    const adm = new Jar();
    const l = await call(
      "/sign-in/email",
      { email: "adm1@x.test", password: "senha-adm-12345" },
      adm,
    );
    expect(l.json.twoFactorRedirect).toBe(true);
    expect((await admTotp(adm)).status).toBe(200);

    expect(
      (await call("/admin/ban-user", { userId: "cli1", banReason: "inativado" }, adm)).status,
    ).toBe(200);
    expect((await call("/admin/revoke-user-sessions", { userId: "cli1" }, adm)).status).toBe(200);
    expect((await call("/get-session", undefined, cli)).json).toBeNull();
    const relogin = await call(
      "/sign-in/email",
      { email: "cli1@x.test", password: "senha-cli-12345" },
      new Jar(),
    );
    console.log("[S-04] login de banido:", relogin.status, relogin.json?.code);
    expect(relogin.status).toBeGreaterThanOrEqual(400);
  });

  it("7. link de senha: validade e armazenamento do token (SEG-15)", async () => {
    const r = await call("/request-password-reset", {
      email: "tec1@x.test",
      redirectTo: `${BASE}/senha/definir`,
    });
    expect(r.status).toBe(200);
    const sent = sentResets.at(-1) as { token: string };
    const v = one(
      await owner`SELECT identifier, value, expires_at, created_at
      FROM auth_verification ORDER BY created_at DESC LIMIT 1`,
    );
    const ttl = Math.round((v.expires_at.getTime() - v.created_at.getTime()) / 60000);
    console.log(
      `[S-04] token enviado='${sent.token.slice(0, 6)}…' identifier='${String(v.identifier).slice(0, 18)}…' validade=${ttl} min`,
    );
    expect(ttl).toBe(30);
    expect(
      (await call("/reset-password", { newPassword: "outra-senha-9876", token: sent.token }))
        .status,
    ).toBe(200);
    expect(
      (await call("/reset-password", { newPassword: "mais-outra-9876", token: sent.token })).status,
    ).toBeGreaterThanOrEqual(400); // uso único
  });
});
