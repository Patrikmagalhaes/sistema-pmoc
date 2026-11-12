/**
 * Spike S-02, passo manual (CA-13.1): assina um PMOC sintético com um A1 real para conferir no validador
 * oficial do ITI. A senha vem de variável de ambiente, nunca da linha de comando (fica no histórico).
 *
 *   $env:S02_SENHA = "..."; node --import tsx tests/spikes/s02/assinar.ts <arquivo.pfx> <saida.pdf>
 *
 * Não grave o .pfx nem o PDF assinado no repositório.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gerarPmocSintetico } from "../s01/pmoc-sintetico";
import { assinarPades, lerPkcs12 } from "./pades";
import { verificarPades } from "./verificar";

const [pfx, saida] = process.argv.slice(2);
const senha = process.env.S02_SENHA;
if (!pfx || !saida || !senha) {
  console.error(
    "Uso: S02_SENHA=... node --import tsx tests/spikes/s02/assinar.ts <arquivo.pfx> <saida.pdf>",
  );
  process.exit(1);
}
const a1 = lerPkcs12(readFileSync(pfx), senha);
const titular = a1.cadeia[0]?.subject.getField("CN")?.value as string | undefined;
const assinado = await assinarPades(await gerarPmocSintetico(1), a1, {
  nome: titular ?? "RT",
  motivo: "Spike S-02 – teste de assinatura",
  local: "Brasil",
  quando: new Date(),
});
writeFileSync(saida, assinado);
const r = verificarPades(assinado);
console.log(`Gravado ${saida}; cadeia com ${r.certificadosNaCadeia} certificado(s).`);
console.log(
  `Verificação local: digest ${r.digestConfere ? "ok" : "FALHOU"}, assinatura ${r.assinaturaConfere ? "ok" : "FALHOU"}.`,
);
console.log(
  "Agora envie o PDF ao validador do ITI (https://validar.iti.gov.br) e anote o resultado.",
);
