/**
 * Ambiente dos testes E2E: Postgres 16 embutido + migrações + usuários fictícios com senha + `next dev`.
 * Rodado pelo `webServer` do Playwright com `tsx --conditions=react-server` (módulos `server-only`).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import EmbeddedPostgres from "embedded-postgres";
import { runMigrations } from "../../db/migrate";
import { seedDevelopment } from "../../db/seed/data";
import { ganchosAuth } from "../../src/modules/acesso";
import { createAuth } from "../../src/server/auth/config";
import { systemContext } from "../../src/server/context";
import { createDatabase } from "../../src/server/db";
import { memoryEmailSender } from "../../src/server/email";
import { E2E } from "./dados";

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

const pgPort = await freePort();
const pg = new EmbeddedPostgres({
  databaseDir: mkdtempSync(join(tmpdir(), "pmoc-e2e-")),
  user: "postgres",
  password: "postgres",
  port: pgPort,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
await pg.initialise();
await pg.start();
await pg.createDatabase("pmoc");

const url = (u: string, p: string) => `postgres://${u}:${p}@localhost:${pgPort}/pmoc`;
await runMigrations({
  adminUrl: url("postgres", "postgres"),
  ownerUrl: url("pmoc_owner", "owner_pw"),
  passwords: { pmoc_owner: "owner_pw", app_rw: "app_pw", backup_ro: "backup_pw" },
});

const appUrl = url("app_rw", "app_pw");
const db = createDatabase(appUrl, { max: 2 });
await seedDevelopment(db);

// Usuários com senha, criados pela própria biblioteca (scrypt), ligados a app_user.
const auth = createAuth({
  db,
  secret: E2E.secret,
  baseURL: E2E.baseURL,
  email: memoryEmailSender(),
  ganchos: ganchosAuth(db, memoryEmailSender()),
  checarSenhaVazada: false,
  limitarTentativas: false,
  ipHeaders: ["x-real-ip"],
});
const c = await auth.$context;
const { SEED } = await import("../../db/seed/data");
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

rmSync(E2E.emailDir, { recursive: true, force: true });
rmSync(E2E.storageDir, { recursive: true, force: true });
const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", String(E2E.port)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: appUrl,
      BETTER_AUTH_SECRET: E2E.secret,
      APP_URL: E2E.baseURL,
      AUTH_CHECAR_SENHA_VAZADA: "false",
      EMAIL_DEV_DIR: E2E.emailDir,
      STORAGE_DEV_DIR: E2E.storageDir,
      CERT_ENCRYPTION_KEY: E2E.certKey,
    },
  },
);

const stop = async () => {
  next.kill();
  try {
    await pg.stop();
  } catch {
    // Windows: diretório temporário preso por instantes
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", stop);
