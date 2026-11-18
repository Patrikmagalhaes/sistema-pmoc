/**
 * Spike S-02 (docs/05 §10.4): assinatura PAdES com A1 de teste. Parte local: estrutura PAdES B-B,
 * integridade e assinatura conferidas por `verificarPades`. O critério oficial (CA-13.1: validador do ITI
 * reconhece a assinatura) exige um A1 ICP-Brasil e é feito à mão com `s02/assinar.ts`.
 */
import { describe, expect, it } from "vitest";
import { gerarPkcs12 } from "../fixtures/certificado";
import { verificarPades } from "../fixtures/verificar-pades";
import { gerarPmocSintetico } from "./s01/pmoc-sintetico";
import { assinarPades, lerPkcs12, SUBFILTER_PADES } from "./s02/pades";

const SENHA = "senha-de-teste";
const a1 = () =>
  lerPkcs12(
    gerarPkcs12({
      nome: "RT FICTICIO",
      senha: SENHA,
      validoDe: new Date("2026-01-01"),
      validoAte: new Date("2027-12-31"),
    }),
    SENHA,
  );
const opcoes = {
  nome: "RT FICTICIO",
  motivo: "Responsável técnico pelo PMOC",
  local: "Florianópolis/SC",
  quando: new Date("2026-11-12T15:00:00Z"),
};

describe("S-02 – assinatura PAdES do RT", () => {
  it("assina o PDF do @react-pdf/renderer e a assinatura confere", async () => {
    const pdf = await gerarPmocSintetico(1);
    const inicio = performance.now();
    const assinado = await assinarPades(pdf, a1(), opcoes);
    console.log(`S-02 assinatura: ${Math.round(performance.now() - inicio)} ms`);

    const r = verificarPades(assinado);
    expect(r).toMatchObject({
      subFilter: SUBFILTER_PADES,
      temM: true,
      byteRangeCobreTudo: true,
      digestConfere: true,
      assinaturaConfere: true,
      certHashConfere: true,
      temSigningTime: false, // PAdES B-B: a hora fica no /M, não no CMS
      certificadosNaCadeia: 1,
    });
    expect(r.titular).toContain("RT FICTICIO:00000000000");
    // A assinatura é um update incremental: o PDF original continua intacto no início do arquivo.
    expect(assinado.subarray(0, pdf.length - 1).equals(pdf.subarray(0, pdf.length - 1))).toBe(true);
  });

  it("alterar um byte do conteúdo assinado quebra a verificação", async () => {
    const assinado = await assinarPades(await gerarPmocSintetico(1), a1(), opcoes);
    assinado[200] = (assinado[200] ?? 0) ^ 1; // dentro do primeiro trecho do ByteRange
    expect(verificarPades(assinado).digestConfere).toBe(false);
  });

  it("assina o PMOC de 200 equipamentos", async () => {
    const pdf = await gerarPmocSintetico(200);
    const inicio = performance.now();
    const r = verificarPades(await assinarPades(pdf, a1(), opcoes));
    console.log(
      `S-02 assinatura de ${(pdf.length / 1024).toFixed(0)} KB: ${Math.round(performance.now() - inicio)} ms`,
    );
    expect(r.digestConfere && r.assinaturaConfere).toBe(true);
  });
});
