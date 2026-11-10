import postgres from "postgres";
import { afterAll, describe, expect, inject, it } from "vitest";

describe("migrações e papéis (03 E18; 05 §4.2)", () => {
  const owner = postgres(inject("dbOwnerUrl"), { max: 1 });
  afterAll(() => owner.end());

  it("cria todas as tabelas do doc 03", async () => {
    const rows = await owner`SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    expect(rows[0]?.n).toBeGreaterThan(40);
  });

  it("app_rw não é superusuário, não tem BYPASSRLS e não é dono de tabela", async () => {
    const [role] =
      await owner`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_rw'`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const owned = await owner`SELECT count(*)::int AS n FROM pg_tables WHERE tableowner = 'app_rw'`;
    expect(owned[0]?.n).toBe(0);
  });

  it("backup_ro tem BYPASSRLS e o dono é um papel separado", async () => {
    const [b] = await owner`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'backup_ro'`;
    expect(b?.rolbypassrls).toBe(true);
    const [t] = await owner`SELECT tableowner FROM pg_tables WHERE tablename = 'client'`;
    expect(t?.tableowner).toBe("pmoc_owner");
  });
});
