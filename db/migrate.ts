import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));

export type MigrateOptions = {
  /** Superusuário/admin: cria papéis e extensões (db/bootstrap.sql). Opcional se já foram criados. */
  adminUrl?: string;
  /** Dono do esquema (pmoc_owner). Nunca usado em runtime. */
  ownerUrl: string;
  /** Senhas dos papéis; só aplicadas quando adminUrl existe. */
  passwords?: Partial<Record<"pmoc_owner" | "app_rw" | "backup_ro", string>>;
  log?: (msg: string) => void;
};

/** Aplica db/bootstrap.sql e depois db/migrations/*.sql, em ordem, cada arquivo numa transação. */
export async function runMigrations(opts: MigrateOptions): Promise<string[]> {
  const log = opts.log ?? (() => {});
  if (opts.adminUrl) {
    const admin = postgres(opts.adminUrl, { max: 1, onnotice: () => {} });
    try {
      await admin.unsafe(readFileSync(join(here, "bootstrap.sql"), "utf8"));
      for (const [role, pw] of Object.entries(opts.passwords ?? {})) {
        const [row] = await admin<{ q: string }[]>`
          SELECT format('ALTER ROLE %I PASSWORD %L', ${role}::text, ${pw as string}::text) AS q`;
        await admin.unsafe((row as { q: string }).q);
      }
    } finally {
      await admin.end();
    }
  }

  const owner = postgres(opts.ownerUrl, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  try {
    await owner`CREATE TABLE IF NOT EXISTS schema_migration (
      filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const done = new Set(
      (await owner`SELECT filename FROM schema_migration`).map((r) => r.filename),
    );
    const files = readdirSync(join(here, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const body = readFileSync(join(here, "migrations", file), "utf8");
      await owner.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO schema_migration (filename) VALUES (${file})`;
      });
      applied.push(file);
      log(`aplicada ${file}`);
    }
    // Reaplica as permissões de app_rw/backup_ro (idempotente; cobre tabelas de migrações futuras).
    await owner`SELECT apply_app_grants()`;
  } finally {
    await owner.end();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ownerUrl = process.env.DATABASE_OWNER_URL;
  if (!ownerUrl) throw new Error("DATABASE_OWNER_URL não definida");
  const applied = await runMigrations({
    ownerUrl,
    adminUrl: process.env.DATABASE_ADMIN_URL,
    passwords: {
      pmoc_owner: process.env.PMOC_OWNER_PASSWORD,
      app_rw: process.env.APP_RW_PASSWORD,
      backup_ro: process.env.BACKUP_RO_PASSWORD,
    },
    log: console.log,
  });
  console.log(applied.length ? `${applied.length} migração(ões) aplicada(s)` : "nada a aplicar");
}
