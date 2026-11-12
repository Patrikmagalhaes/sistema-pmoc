/**
 * Spike S-01 (docs/05 §10.4; AF-11): PDF do PMOC com 200 equipamentos × 12 meses gerado de forma síncrona
 * em < 800 s e < 3,5 GB, com texto conforme RNF-07; 500 como margem de folga. Cada geração roda num
 * processo próprio (`s01/medir.ts`), para o pico de memória ser só dela. Parte local; a medida na Vercel
 * fica pendente até existir o projeto.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Medida = {
  equipamentos: number;
  meses: number;
  ms: number;
  maxRssMb: number;
  mb: number;
  paginas: number;
  rodapes: string[];
  temTitulo: boolean;
  temNullOuUndefined: boolean;
  deterministico: boolean;
};

const LIMITE_MS = 800_000;
const LIMITE_MB = 3.5 * 1024;

function medir(equipamentos: number, meses = 12): Medida {
  const saida = execFileSync(
    process.execPath,
    ["--import", "tsx", "tests/spikes/s01/medir.ts", String(equipamentos), String(meses)],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const m = JSON.parse(saida.trim().split("\n").at(-1) ?? "{}") as Medida;
  console.log(
    `S-01 ${equipamentos} eq × ${meses} meses: ${m.ms} ms, pico ${m.maxRssMb} MB, ${m.paginas} páginas, ${m.mb} MB`,
  );
  return m;
}

function conferirRnf07(m: Medida) {
  expect(m.temTitulo).toBe(true); // acentuação legível nas fontes padrão
  expect(m.temNullOuUndefined).toBe(false);
  expect(m.rodapes).toHaveLength(m.paginas);
  m.rodapes.forEach((r, i) => {
    expect(r).toBe(`Página ${i + 1} de ${m.paginas}`);
  });
  expect(m.deterministico).toBe(true); // mesmo dado → mesmo PDF
}

describe("S-01 – PDF do PMOC síncrono", () => {
  it.each([1, 30])("%i equipamento(s): gera e segue RNF-07", (n) => {
    conferirRnf07(medir(n));
  });

  it("200 equipamentos × 12 meses: < 800 s e < 3,5 GB", () => {
    const m = medir(200);
    conferirRnf07(m);
    expect(m.ms).toBeLessThan(LIMITE_MS);
    expect(m.maxRssMb).toBeLessThan(LIMITE_MB);
  });

  it("200 equipamentos × 24 meses (ficha com 2 blocos, DEC-22): < 800 s e < 3,5 GB", () => {
    const m = medir(200, 24);
    conferirRnf07(m);
    expect(m.ms).toBeLessThan(LIMITE_MS);
    expect(m.maxRssMb).toBeLessThan(LIMITE_MB);
  });

  it("500 equipamentos (folga): < 800 s e < 3,5 GB", () => {
    const m = medir(500);
    conferirRnf07(m);
    expect(m.ms).toBeLessThan(LIMITE_MS);
    expect(m.maxRssMb).toBeLessThan(LIMITE_MB);
  });
});
