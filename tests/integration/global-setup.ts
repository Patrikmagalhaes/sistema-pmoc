import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    dbAdminUrl: string;
    dbOwnerUrl: string;
    dbAppUrl: string;
    dbBackupUrl: string;
  }
}

type Instance = {
  host: string;
  port: number;
  db: string;
  user: string;
  password: string;
  stop(): Promise<void>;
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Postgres 16 nativo (sem Docker), para máquinas sem container. Mesmo major do doc 03 §0. */
async function startEmbedded(): Promise<Instance> {
  const dir = mkdtempSync(join(tmpdir(), "pmoc-pg-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("pmoc");
  return {
    host: "localhost",
    port,
    db: "pmoc",
    user: "postgres",
    password: "postgres",
    async stop() {
      try {
        await pg.stop();
      } catch {
        // Windows: o diretório temporário pode ficar preso por instantes (EBUSY); o SO o limpa depois.
      }
    },
  };
}

/** Testcontainers (padrão do doc 05 §3.11); cai para o Postgres embutido se não houver Docker. */
async function startInstance(): Promise<Instance> {
  if (process.env.PMOC_TEST_DB !== "embedded") {
    try {
      const c = await new PostgreSqlContainer("postgres:16-alpine").start();
      return {
        host: c.getHost(),
        port: c.getPort(),
        db: c.getDatabase(),
        user: c.getUsername(),
        password: c.getPassword(),
        stop: async () => {
          await c.stop();
        },
      };
    } catch {
      // sem runtime de containers: usa o embutido
    }
  }
  return startEmbedded();
}

/** Sobe um Postgres 16 limpo e aplica as migrações do zero (critério de pronto da Etapa 1). */
export default async function setup(project: TestProject) {
  const pg = await startInstance();
  const url = (user: string, pw: string) =>
    `postgres://${user}:${pw}@${pg.host}:${pg.port}/${pg.db}`;
  const adminUrl = url(pg.user, pg.password);
  const ownerUrl = url("pmoc_owner", "owner_pw");

  await runMigrations({
    adminUrl,
    ownerUrl,
    passwords: { pmoc_owner: "owner_pw", app_rw: "app_pw", backup_ro: "backup_pw" },
  });

  project.provide("dbAdminUrl", adminUrl);
  project.provide("dbOwnerUrl", ownerUrl);
  project.provide("dbAppUrl", url("app_rw", "app_pw"));
  project.provide("dbBackupUrl", url("backup_ro", "backup_pw"));

  return () => pg.stop();
}
