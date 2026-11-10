/**
 * Etapa 2 – módulo `acesso` com o Better Auth real (03 §2.1; 06 SEG-02, 04, 07, 09, 10, 15, 17; RN-141,
 * RN-179, RN-194). A biblioteca roda como app_rw. Sem rede: a checagem de senha vazada fica desligada.
 */
import { createHmac, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  type AcessoDeps,
  criarUsuario,
  ErroAcesso,
  ganchosAuth,
  hashEmail,
  inativarUsuario,
  resolverSessao,
} from "../../src/modules/acesso";
import { type Auth, createAuth } from "../../src/server/auth/config";
import type { RequestContext } from "../../src/server/context";
import type { Database } from "../../src/server/db";
import { memoryEmailSender } from "../../src/server/email";
import { appDatabase, ensureSeed, technicianCtx } from "./helpers";

const BASE = "http://localhost:3000";
const IP_HEADERS = ["x-real-ip"];
const CLIENTE_X = "00000000-0000-4000-8000-00000000ac01";

let db: Database;
let owner: postgres.Sql;
let auth: Auth;
let deps: AcessoDeps;
const email = memoryEmailSender();

// ---- cliente HTTP mínimo com cookies ----------------------------------------------------------
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
  headers(): Headers {
    const h = new Headers({ origin: BASE, "x-real-ip": "198.51.100.7", "user-agent": "vitest" });
    if (this.cookies.size)
      h.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    return h;
  }
}
// biome-ignore lint/suspicious/noExplicitAny: corpo JSON arbitrário da biblioteca
type Json = any;

async function call(
  path: string,
  body?: unknown,
  jar = new Jar(),
): Promise<{ status: number; json: Json }> {
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  const res = await auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  jar.absorb(res);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function totp(base32: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = (h[19] as number) & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Primeiro ADM não tem quem o crie: entra direto (como no runbook de bootstrap). */
async function bootstrapAdm(nome: string, mail: string, senha: string) {
  const c = await auth.$context;
  const u = await c.internalAdapter.createUser(
    {
      email: mail,
      name: nome,
      emailVerified: true,
      role: "ADM",
    },
    { method: "admin" },
  );
  await c.internalAdapter.linkAccount({
    userId: u.id,
    providerId: "credential",
    accountId: u.id,
    password: await c.password.hash(senha),
  });
  const { systemContext } = await import("../../src/server/context");
  const id = await db.withTransaction(systemContext(randomUUID()), async (tx) => {
    const r = await tx.execute(sql`INSERT INTO app_user (name, email, auth_user_id, role)
      VALUES (${nome}, ${mail}, ${u.id}, 'ADM') RETURNING id`);
    return (r[0] as { id: string }).id;
  });
  return { authUserId: u.id, id };
}

/** Login completo de ADM com segundo fator (habilita na primeira vez). */
async function loginAdm(mail: string, senha: string, secret?: string) {
  const jar = new Jar();
  const r = await call("/sign-in/email", { email: mail, password: senha }, jar);
  if (r.json?.twoFactorRedirect) {
    expect(
      (await call("/two-factor/verify-totp", { code: totp(secret as string) }, jar)).status,
    ).toBe(200);
    return { jar, secret: secret as string };
  }
  const en = await call("/two-factor/enable", { password: senha }, jar);
  const s = new URL(en.json.totpURI).searchParams.get("secret") as string;
  expect((await call("/two-factor/verify-totp", { code: totp(s) }, jar)).status).toBe(200);
  return { jar, secret: s };
}

const tokenDoEmail = (to: string) => {
  const m = [...email.sent].reverse().find((x) => x.to === to);
  return m?.text.match(/token=([\w-]+)/)?.[1] as string;
};

const eventos = async (tipo: string, userId?: string) =>
  (
    await owner`SELECT count(*)::int AS n FROM security_event
      WHERE event_type = ${tipo} ${userId ? owner`AND user_id = ${userId}` : owner``}`
  )[0]?.n as number;

let adm1Login: { jar: Jar; secret: string };
let admCtx: RequestContext;

beforeAll(async () => {
  db = appDatabase(3);
  owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });
  await ensureSeed(db);
  auth = createAuth({
    db,
    secret: "teste-teste-teste-teste-teste-teste-0123",
    baseURL: BASE,
    email,
    ganchos: ganchosAuth(db),
    checarSenhaVazada: false,
    limitarTentativas: false,
    ipHeaders: IP_HEADERS,
  });
  deps = { db, auth, email, baseURL: BASE };
  // Cliente próprio: os testes de RLS exigem exatamente os usuários do seed nos clientes A e B.
  const { systemContext } = await import("../../src/server/context");
  await db.withTransaction(systemContext(randomUUID()), (tx) =>
    tx.execute(sql`INSERT INTO client (id, legal_name, cnpj, address_street, address_number, address_city,
      address_state, address_zip) VALUES (${CLIENTE_X}, 'Cliente X Ltda', '12345678000195', 'Rua', '1',
      'São Paulo', 'SP', '01001000')`),
  );
  await bootstrapAdm("Ana Um", "ana1@empresa.test", "frase longa de teste um");
  adm1Login = await loginAdm("ana1@empresa.test", "frase longa de teste um");
  const r = await resolverSessao(adm1Login.jar.headers(), deps, { ipHeaders: IP_HEADERS });
  if (r.estado !== "OK") throw new Error(`ADM deveria ter sessão plena: ${r.estado}`);
  admCtx = r.ctx;
});
afterAll(async () => {
  await owner.end();
  await db.close();
});

describe("criar usuário (RF-02; 03 §2.1 regra 5; SEG-15)", () => {
  it("cria auth_user com o perfil, app_user e envia link de 72 h; o link define a senha e o login funciona", async () => {
    const { id } = await criarUsuario(
      admCtx,
      { nome: "Carla X", email: "Carla@ClienteX.test", perfil: "CLIENTE", clientId: CLIENTE_X },
      adm1Login.jar.headers(),
      deps,
    );
    const [row] =
      await owner`SELECT u.role, u.client_id, u.email::text, a.role AS auth_role, a.email AS auth_email
      FROM app_user u JOIN auth_user a ON a.id = u.auth_user_id WHERE u.id = ${id}`;
    expect(row).toMatchObject({
      role: "CLIENTE",
      client_id: CLIENTE_X,
      email: "carla@clientex.test",
      auth_role: "CLIENTE",
      auth_email: "carla@clientex.test", // 03 §2.1 regra 4: os dois e-mails iguais
    });

    const token = tokenDoEmail("carla@clientex.test");
    const [v] =
      await owner`SELECT round(extract(epoch FROM expires_at - created_at) / 60)::int AS ttl FROM auth_verification
      WHERE identifier = ${`reset-password:${token}`}`;
    expect(v?.ttl).toBe(72 * 60);

    expect(
      (await call("/reset-password", { newPassword: "cavalo bateria grampo", token })).status,
    ).toBe(200);
    expect(
      (await call("/reset-password", { newPassword: "outra frase qualquer", token })).status,
    ).toBe(400); // uso único
    const jar = new Jar();
    expect(
      (
        await call(
          "/sign-in/email",
          { email: "carla@clientex.test", password: "cavalo bateria grampo" },
          jar,
        )
      ).status,
    ).toBe(200);
    const s = await resolverSessao(jar.headers(), deps, { ipHeaders: IP_HEADERS });
    expect(s.estado).toBe("OK");
    if (s.estado === "OK") {
      expect(s.ctx).toMatchObject({
        role: "CLIENTE",
        clientId: CLIENTE_X,
        source: "PORTAL_CLIENTE",
        ipAddress: "198.51.100.7",
      });
    }
    expect(await eventos("SENHA_REDEFINIDA", id)).toBe(1);
    const [ok] = await owner`SELECT email_hash, host(ip_address) AS ip FROM security_event
      WHERE event_type = 'LOGIN_OK' AND user_id = ${id}`;
    expect(ok).toMatchObject({ email_hash: hashEmail("carla@clientex.test"), ip: "198.51.100.7" });
  });

  it("e-mail repetido é recusado (CA-02.2)", async () => {
    await expect(
      criarUsuario(
        admCtx,
        { nome: "Dup", email: "carla@clientex.test", perfil: "TECNICO" },
        adm1Login.jar.headers(),
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "EMAIL_EM_USO" });
  });

  it("se o app_user falha, o auth_user criado é apagado (compensação, AF-04)", async () => {
    await expect(
      criarUsuario(
        admCtx,
        { nome: "Sem Cliente", email: "orfao@x.test", perfil: "CLIENTE", clientId: randomUUID() },
        adm1Login.jar.headers(),
        deps,
      ),
    ).rejects.toThrow();
    const [{ n }] =
      (await owner`SELECT count(*)::int AS n FROM auth_user WHERE email = 'orfao@x.test'`) as unknown as [
        { n: number },
      ];
    expect(n).toBe(0);
  });

  it("só o ADM cria usuário (RF-03)", async () => {
    await expect(
      criarUsuario(
        technicianCtx(),
        { nome: "T", email: "t2@x.test", perfil: "TECNICO" },
        new Headers(),
        deps,
      ),
    ).rejects.toBeInstanceOf(ErroAcesso);
  });

  it("senha óbvia é recusada ao definir (SEG-02)", async () => {
    await criarUsuario(
      admCtx,
      { nome: "Tiago", email: "tiago.lima@empresa.test", perfil: "TECNICO" },
      adm1Login.jar.headers(),
      deps,
    );
    const token = tokenDoEmail("tiago.lima@empresa.test");
    const r = await call("/reset-password", { newPassword: "tiago.lima123", token });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("SENHA_FORA_DA_POLITICA");
    expect(
      (await call("/reset-password", { newPassword: "chuva de verão em março", token })).status,
    ).toBe(200);
  });
});

describe("login e sessão (SEG-07, SEG-09, SEG-10, RN-194)", () => {
  it("5 falhas seguidas bloqueiam por 15 min, mesmo com a senha certa depois (SEG-07)", async () => {
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await call("/sign-in/email", {
            email: "tiago.lima@empresa.test",
            password: "errada errada",
          })
        ).status,
      ).toBe(401);
    }
    const r = await call("/sign-in/email", {
      email: "tiago.lima@empresa.test",
      password: "chuva de verão em março",
    });
    expect(r.status).toBe(429);
    const h = hashEmail("tiago.lima@empresa.test");
    const rows =
      await owner`SELECT event_type, count(*)::int AS n FROM security_event WHERE email_hash = ${h} GROUP BY 1`;
    expect(Object.fromEntries(rows.map((x) => [x.event_type, x.n]))).toEqual({
      LOGIN_FALHA: 5,
      CONTA_BLOQUEADA: 1,
    });
  });

  it("e-mail inexistente responde igual ao de senha errada (E-01.1)", async () => {
    const r = await call("/sign-in/email", {
      email: "ninguem@x.test",
      password: "qualquer coisa aqui",
    });
    expect(r.status).toBe(401);
  });

  it("TECNICO: sem limite web; ADM e CLIENTE: 12 h sem uso derruba a sessão", async () => {
    await criarUsuario(
      admCtx,
      { nome: "Rita", email: "rita@empresa.test", perfil: "TECNICO" },
      adm1Login.jar.headers(),
      deps,
    );
    await call("/reset-password", {
      newPassword: "sol de inverno forte",
      token: tokenDoEmail("rita@empresa.test"),
    });
    const tec = new Jar();
    await call(
      "/sign-in/email",
      { email: "rita@empresa.test", password: "sol de inverno forte" },
      tec,
    );
    const dias20 = new Date(Date.now() + 20 * 24 * 3600 * 1000);
    expect((await resolverSessao(tec.headers(), deps, { agora: dias20 })).estado).toBe("OK");

    const cli = new Jar();
    await call(
      "/sign-in/email",
      { email: "carla@clientex.test", password: "cavalo bateria grampo" },
      cli,
    );
    const h13 = new Date(Date.now() + 13 * 3600 * 1000);
    expect((await resolverSessao(cli.headers(), deps, { agora: h13 })).estado).toBe("ANONIMO");
    // a sessão foi apagada: mesmo "agora", não volta
    expect((await resolverSessao(cli.headers(), deps)).estado).toBe("ANONIMO");
  });

  it("ADM sem segundo fator só tem o estado SEGUNDO_FATOR_PENDENTE (RN-194)", async () => {
    await bootstrapAdm("Bruno Dois", "bruno2@empresa.test", "frase longa de teste dois");
    const jar = new Jar();
    await call(
      "/sign-in/email",
      { email: "bruno2@empresa.test", password: "frase longa de teste dois" },
      jar,
    );
    expect((await resolverSessao(jar.headers(), deps)).estado).toBe("SEGUNDO_FATOR_PENDENTE");
    const en = await call("/two-factor/enable", { password: "frase longa de teste dois" }, jar);
    expect(en.json.backupCodes).toHaveLength(10);
    const s = new URL(en.json.totpURI).searchParams.get("secret") as string;
    await call("/two-factor/verify-totp", { code: totp(s) }, jar);
    expect((await resolverSessao(jar.headers(), deps)).estado).toBe("OK");
    const [u] = await owner`SELECT id FROM app_user WHERE email = 'bruno2@empresa.test'`;
    expect(await eventos("MFA_ATIVADO", u?.id)).toBe(1);
  });

  it("trocar a senha revoga as outras sessões e grava SENHA_ALTERADA (SEG-04)", async () => {
    const a = new Jar();
    const b = new Jar();
    await call(
      "/sign-in/email",
      { email: "rita@empresa.test", password: "sol de inverno forte" },
      a,
    );
    await call(
      "/sign-in/email",
      { email: "rita@empresa.test", password: "sol de inverno forte" },
      b,
    );
    const r = await call(
      "/change-password",
      { currentPassword: "sol de inverno forte", newPassword: "lua de verão calma" },
      a,
    );
    expect(r.status).toBe(200);
    expect((await resolverSessao(b.headers(), deps)).estado).toBe("ANONIMO");
    const [u] = await owner`SELECT id FROM app_user WHERE email = 'rita@empresa.test'`;
    expect(await eventos("SENHA_ALTERADA", u?.id)).toBe(1);
  });
});

describe("inativar (RN-141; SEG-17)", () => {
  it("inativar bane e derruba a sessão ativa; o login passa a ser recusado", async () => {
    const tec = new Jar();
    await call(
      "/sign-in/email",
      { email: "rita@empresa.test", password: "lua de verão calma" },
      tec,
    );
    expect((await resolverSessao(tec.headers(), deps)).estado).toBe("OK");
    const [u] =
      (await owner`SELECT id, row_version FROM app_user WHERE email = 'rita@empresa.test'`) as unknown as [
        { id: string; row_version: number },
      ];
    await inativarUsuario(
      admCtx,
      { id: u.id, rowVersion: u.row_version },
      adm1Login.jar.headers(),
      deps,
    );
    expect((await resolverSessao(tec.headers(), deps)).estado).toBe("ANONIMO");
    expect(
      (await call("/sign-in/email", { email: "rita@empresa.test", password: "lua de verão calma" }))
        .status,
    ).toBeGreaterThanOrEqual(400);
    expect(await eventos("SESSAO_REVOGADA", u.id)).toBeGreaterThanOrEqual(1);
  });

  it("row_version antigo é recusado (alterado por outra pessoa)", async () => {
    const [u] =
      (await owner`SELECT id FROM app_user WHERE email = 'tiago.lima@empresa.test'`) as unknown as [
        { id: string },
      ];
    await expect(
      inativarUsuario(admCtx, { id: u.id, rowVersion: 999 }, adm1Login.jar.headers(), deps),
    ).rejects.toMatchObject({ codigo: "ALTERADO_POR_OUTRO" });
  });

  it("não deixa o sistema com menos de 2 ADMs ativos com segundo fator", async () => {
    const [b] =
      (await owner`SELECT id, row_version FROM app_user WHERE email = 'bruno2@empresa.test'`) as unknown as [
        { id: string; row_version: number },
      ];
    await expect(
      inativarUsuario(
        admCtx,
        { id: b.id, rowVersion: b.row_version },
        adm1Login.jar.headers(),
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "MINIMO_DE_ADMS" });
  });
});

describe("pedido de link de recuperação (FL-01; SEG-08, SEG-61)", () => {
  const pedir = (mail: string) =>
    call("/request-password-reset", { email: mail, redirectTo: "/senha/definir" });
  const enviadosPara = (mail: string) => email.sent.filter((m) => m.to === mail).length;

  it("usuário INATIVO recebe a mesma resposta, mas nenhum e-mail", async () => {
    const antes = enviadosPara("rita@empresa.test"); // inativada no bloco anterior
    const r = await pedir("rita@empresa.test");
    expect(r.status).toBe(200);
    expect(enviadosPara("rita@empresa.test")).toBe(antes);
  });

  it("no máximo 3 links por hora por e-mail; o 4º pedido responde igual e não envia", async () => {
    const mail = "carla@clientex.test";
    const antes = enviadosPara(mail);
    for (let i = 0; i < 4; i++) expect((await pedir(mail)).status).toBe(200);
    expect(enviadosPara(mail) - antes).toBe(3);
  });

  it("e-mail inexistente responde igual (não revela cadastro)", async () => {
    expect((await pedir("nao-existe@x.test")).status).toBe(200);
  });
});
