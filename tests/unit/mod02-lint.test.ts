import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

// MOD-02: um módulo só importa outro pelo index.ts.
const dir = "tests/tmp-mod02";

function lint(name: string, source: string) {
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${name}.ts`;
  writeFileSync(file, source);
  return spawnSync(
    process.execPath,
    ["node_modules/@biomejs/biome/bin/biome", "lint", "--only=style/noRestrictedImports", file],
    { encoding: "utf8" },
  );
}

describe("MOD-02 – regra de lint de imports entre módulos", () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("recusa importar arquivo interno de outro módulo", () => {
    const r = lint("bad", 'import { x } from "@/modules/b/domain/x";\nexport const y = x;\n');
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("MOD-02");
  });

  it("aceita importar pelo index.ts do outro módulo", () => {
    const r = lint("good", 'import { x } from "@/modules/b";\nexport const y = x;\n');
    expect(r.status).toBe(0);
  });
});
