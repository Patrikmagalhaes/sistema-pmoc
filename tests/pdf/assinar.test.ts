/**
 * Assinatura PAdES do PMOC pelo RT (RF-13, RN-120, RN-121, RN-190; E-08.6). Conferida por um
 * verificador independente (`fixtures/verificar-pades.ts`); o validador oficial do ITI (CA-13.1) é o
 * passo manual do spike S-02.
 */
import { describe, expect, it } from "vitest";
import { montarSnapshot } from "../../src/modules/pmoc";
import { assinarPdfComA1, ErroAssinatura, SUBFILTER_PADES } from "../../src/server/pdf/assinar";
import {
  adicionarCampoDeAssinatura,
  ErroCampoAssinatura,
} from "../../src/server/pdf/campo-assinatura";
import { gerarPdfPmoc } from "../../src/server/pdf/pmoc";
import { gerarPkcs12 } from "../fixtures/certificado";
import { verificarPades } from "../fixtures/verificar-pades";
import { dadosFicticios } from "./dados";
import { abrirPdf, textoDasPaginas } from "./texto";

const QUANDO = new Date("2026-11-18T15:00:00Z");
const SENHA = "s3nh@-de-teste";
const certificado = (validoAte = new Date("2027-12-31T00:00:00Z")) => ({
  pkcs12: gerarPkcs12({
    nome: "RT FICTICIO",
    senha: SENHA,
    validoDe: new Date("2026-01-01T00:00:00Z"),
    validoAte,
  }),
  senha: SENHA,
});
const opcoes = {
  nome: "RT FICTICIO",
  motivo: "Responsável técnico pelo PMOC",
  local: "Florianópolis/SC",
  quando: QUANDO,
};
const pdf = () =>
  gerarPdfPmoc({
    snapshot: montarSnapshot(dadosFicticios(1)),
    versao: 1,
    codigoVerificacao: "ABCD",
    urlVerificacao: "https://pmoc.exemplo.test/verificar/ABCD",
    geradoEm: QUANDO,
    logo: null,
    assinaturaRt: { em: QUANDO },
  });

const codigoDoErro = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErroAssinatura);
  expect(String((e as Error).message)).not.toContain(SENHA); // RN-121
  return (e as ErroAssinatura).codigo;
};

describe("assinatura do RT no PDF do PMOC", () => {
  it("RN-120: PAdES B-B válido, cobrindo o arquivo inteiro, com o PDF original intacto", async () => {
    const original = await pdf();
    const assinado = await assinarPdfComA1(original, certificado(), opcoes);
    expect(verificarPades(assinado)).toMatchObject({
      subFilter: SUBFILTER_PADES,
      temM: true,
      byteRangeCobreTudo: true,
      digestConfere: true,
      assinaturaConfere: true,
      certHashConfere: true,
      temSigningTime: false,
      certificadosNaCadeia: 1,
    });
    expect(verificarPades(assinado).titular).toContain("RT FICTICIO");
    // Update incremental: os bytes do PDF gerado continuam no início do arquivo.
    const n = original.length - 1;
    expect(assinado.subarray(0, n).equals(original.subarray(0, n))).toBe(true);
  });

  it("alterar um byte do conteúdo assinado quebra a verificação", async () => {
    const assinado = await assinarPdfComA1(await pdf(), certificado(), opcoes);
    assinado[200] = (assinado[200] ?? 0) ^ 1;
    expect(verificarPades(assinado).digestConfere).toBe(false);
  });

  it("E-08.6: senha guardada que não abre mais o certificado", async () => {
    const c = { ...certificado(), senha: "outra" };
    expect(await codigoDoErro(assinarPdfComA1(await pdf(), c, opcoes))).toBe("SENHA");
  });

  it("E-08.6: arquivo ilegível", async () => {
    const c = { pkcs12: Buffer.from("não é um pkcs12"), senha: SENHA };
    expect(await codigoDoErro(assinarPdfComA1(await pdf(), c, opcoes))).toBe(
      "CERTIFICADO_INVALIDO",
    );
  });

  it("RN-008: certificado vencido na hora da assinatura é recusado", async () => {
    const c = certificado(new Date("2026-11-18T14:59:59Z"));
    expect(await codigoDoErro(assinarPdfComA1(await pdf(), c, opcoes))).toBe("FORA_DA_VALIDADE");
  });

  it("campo próprio: o PDF assinado abre, com as mesmas páginas, o mesmo texto e o campo /Sig", async () => {
    const original = await pdf();
    const assinado = await assinarPdfComA1(original, certificado(), opcoes);
    expect(await textoDasPaginas(assinado)).toEqual(await textoDasPaginas(original));
    const { doc, fechar } = await abrirPdf(assinado);
    try {
      const { info } = await doc.getMetadata();
      expect(info).toMatchObject({ IsSignaturesPresent: true });
      const anotacoes = await (await doc.getPage(1)).getAnnotations();
      // Widget invisível do campo, além dos links do rodapé.
      expect(anotacoes.filter((x) => x.fieldType === "Sig")).toEqual([
        expect.objectContaining({ subtype: "Widget", fieldName: "Assinatura1" }),
      ]);
    } finally {
      await fechar();
    }
    // Motivo e local com acento vão em UTF-16BE (sem depender do PDFDocEncoding).
    expect(assinado.toString("latin1")).toContain("/SubFilter /ETSI.CAdES.detached");
  });

  it("campo próprio: recusa PDF já assinado (nunca reassina por cima, RN-126)", async () => {
    const assinado = await assinarPdfComA1(await pdf(), certificado(), opcoes);
    expect(() =>
      adicionarCampoDeAssinatura(assinado, {
        ...opcoes,
        subFilter: SUBFILTER_PADES,
        tamanhoAssinatura: 16_384,
        aplicativo: "PMOC",
      }),
    ).toThrow(ErroCampoAssinatura);
  });
});
