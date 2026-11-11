/**
 * Ambiente de demonstração local: Postgres 16 embutido (dados persistem em tmp/demo-pg) + migrações +
 * seed de desenvolvimento + os 3 usuários fictícios de `dados.ts` + `next dev` em http://localhost:3000.
 * Uso: `npx tsx --conditions=react-server tests/e2e/demo.ts`. Só para ver o sistema; não é produção.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import EmbeddedPostgres from "embedded-postgres";
import { runMigrations } from "../../db/migrate";
import { SEED, seedDevelopment } from "../../db/seed/data";
import { ganchosAuth } from "../../src/modules/acesso";
import { createAuth } from "../../src/server/auth/config";
import { systemContext } from "../../src/server/context";
import { createDatabase } from "../../src/server/db";
import { memoryEmailSender } from "../../src/server/email";
import { E2E } from "./dados";

const PORTA_PG = 54329;
const PORTA_WEB = 3000;
const base = `http://localhost:${PORTA_WEB}`;
const dir = join(process.cwd(), "tmp", "demo-pg");
const primeiraVez = !existsSync(join(dir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: PORTA_PG,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
if (primeiraVez) await pg.initialise();
await pg.start();

const url = (u: string, p: string) => `postgres://${u}:${p}@localhost:${PORTA_PG}/pmoc`;
const appUrl = url("app_rw", "app_pw");

if (primeiraVez) {
  await pg.createDatabase("pmoc");
  await runMigrations({
    adminUrl: url("postgres", "postgres"),
    ownerUrl: url("pmoc_owner", "owner_pw"),
    passwords: { pmoc_owner: "owner_pw", app_rw: "app_pw", backup_ro: "backup_pw" },
  });
  const db = createDatabase(appUrl, { max: 2 });
  await seedDevelopment(db);
  const auth = createAuth({
    db,
    secret: E2E.secret,
    baseURL: base,
    email: memoryEmailSender(),
    ganchos: ganchosAuth(db, memoryEmailSender()),
    checarSenhaVazada: false,
    limitarTentativas: false,
    ipHeaders: ["x-real-ip"],
  });
  const c = await auth.$context;
  for (const u of E2E.usuarios) {
    const a = await c.internalAdapter.createUser(
      { email: u.email, name: u.nome, emailVerified: true, role: u.perfil },
      { method: "admin" },
    );
    await c.internalAdapter.linkAccount({
      userId: a.id,
      providerId: "credential",
      accountId: a.id,
      password: await c.password.hash(u.senha),
    });
    await db.withTransaction(systemContext(randomUUID()), (tx) =>
      tx.execute(sql`INSERT INTO app_user (name, email, auth_user_id, role, client_id)
        VALUES (${u.nome}, ${u.email}, ${a.id}, ${u.perfil}, ${u.perfil === "CLIENTE" ? SEED.clientAId : null})`),
    );
  }
  await db.close();
}

console.log(`\nPronto: ${base}`);
for (const u of E2E.usuarios) console.log(`  ${u.perfil.padEnd(8)} ${u.email}  senha: ${u.senha}`);

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", String(PORTA_WEB)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: appUrl,
      BETTER_AUTH_SECRET: E2E.secret,
      APP_URL: base,
      AUTH_CHECAR_SENHA_VAZADA: "false",
      EMAIL_DEV_DIR: join(process.cwd(), "tmp", "demo-emails"),
      STORAGE_DEV_DIR: join(process.cwd(), "tmp", "demo-armazenamento"),
      CERT_ENCRYPTION_KEY: E2E.certKey,
    },
  },
);

const parar = async () => {
  next.kill();
  try {
    await pg.stop();
  } catch {
    // Windows: arquivos presos por instantes
  }
  process.exit(0);
};
process.on("SIGINT", parar);
process.on("SIGTERM", parar);
next.on("exit", parar);
