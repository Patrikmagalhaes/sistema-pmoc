/**
 * Spike S-01: mede uma geração num processo próprio, para o pico de memória (maxRSS) ser só dela.
 * Uso: node --import tsx tests/spikes/s01/medir.ts <equipamentos> [meses]. Imprime uma linha JSON.
 */
import { createHash } from "node:crypto";
import { gerarPmocSintetico } from "./pmoc-sintetico";
import { contarPaginas, extrairTexto } from "./texto";

const n = Number(process.argv[2]);
const meses = Number(process.argv[3] ?? 12);
const registro: string[] = [];
const ini = performance.now();
const pdf = await gerarPmocSintetico(n, meses, registro);
const ms = Math.round(performance.now() - ini);
const texto = extrairTexto(pdf);
const paginas = contarPaginas(pdf);
const segunda = await gerarPmocSintetico(n, meses);

process.stdout.write(
  `${JSON.stringify({
    equipamentos: n,
    meses,
    ms,
    maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
    mb: +(pdf.length / 1024 / 1024).toFixed(2),
    paginas,
    rodapes: texto.filter((l) => /^Página \d+ de \d+$/.test(l)),
    temTitulo: texto.some((l) => l.includes("PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE")),
    temNullOuUndefined: texto.some((l) => /\b(null|undefined|NaN)\b/.test(l)),
    deterministico:
      createHash("sha256").update(pdf).digest("hex") ===
      createHash("sha256").update(segunda).digest("hex"),
  })}\n`,
);
