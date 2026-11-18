/**
 * PDF do PMOC (05 §3.11: snapshot de texto de 1, 30 e 200 equipamentos). RF-12.2, RN-010, RN-013,
 * RN-050, RN-132, RN-187; CA-12.2, CA-12.3, CA-12.4; INT-25; limite do spike S-01 (AF-11).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { montarSnapshot } from "../../src/modules/pmoc";
import { type EntradaPdfPmoc, gerarPdfPmoc } from "../../src/server/pdf/pmoc";
import { dadosFicticios } from "./dados";
import { textoDasPaginas } from "./texto";

const GERADO_EM = new Date("2026-11-18T15:00:00Z");
const CODIGO = "ABCD-EFGH-JKMN-PQRS";

const entrada = (n: number, meses = 12): EntradaPdfPmoc => ({
  snapshot: montarSnapshot(dadosFicticios(n, meses)),
  versao: 1,
  codigoVerificacao: CODIGO,
  urlVerificacao: `https://pmoc.exemplo.test/verificar/${CODIGO}`,
  geradoEm: GERADO_EM,
  logo: null,
  assinaturaRt: { em: GERADO_EM },
});

/** Regras que valem para qualquer PMOC gerado. */
function conferirRnf07(paginas: string[]) {
  const total = paginas.length;
  paginas.forEach((p, i) => {
    expect(p).toContain(`Página ${i + 1} de ${total}`);
    // INT-25 / RN-187: data de geração, TH-revisão, versão e código em toda página.
    expect(p).toContain("PMOC gerado digitalmente em 18/11/2026 · TH12326-R1 · v1");
    expect(p).toContain(`Código de verificação: ${CODIGO}`);
    expect(p).not.toMatch(/\b(null|undefined|NaN)\b/);
  });
  const tudo = paginas.join("\n");
  expect(tudo).not.toMatch(/qualidade do ar interior/i); // RN-013: sem a seção (o Anexo 1 cita o termo)
  expect(tudo).not.toContain("L012-SPL-999"); // inativo
}

/** RF-12.2: a ordem das partes do documento. */
function conferirOrdem(paginas: string[]) {
  const tudo = paginas.join("\n");
  const marcos = [
    "Plano de Manutenção, Operação e Controle do Sistema de Ar",
    "1. DADOS DA INSTALAÇÃO",
    "2. DADOS DO PROPRIETÁRIO",
    "3. DADOS DA EMPRESA EXECUTORA",
    "4. DADOS DO RESPONSÁVEL TÉCNICO",
    "5. LISTAGEM DE EQUIPAMENTOS",
    "6. CRONOGRAMA",
    "RECOMENDAÇÕES PARA FALHA E EMERGÊNCIA",
    "ANEXO 1",
    "Art. 1º",
    "ANEXO 2",
    "FICHA HISTÓRICO",
  ];
  const posicoes = marcos.map((m) => tudo.indexOf(m));
  expect(marcos.filter((_, i) => (posicoes[i] as number) < 0)).toEqual([]);
  expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
}

const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");

describe("PDF do PMOC", () => {
  it("1 equipamento: snapshot de texto e regras RNF-07", async () => {
    const pdf = await gerarPdfPmoc(entrada(1));
    const paginas = await textoDasPaginas(pdf);
    conferirRnf07(paginas);
    conferirOrdem(paginas);
    await expect(paginas.join("\n\f\n")).toMatchFileSnapshot("__snapshots__/pmoc-1.txt");
  });

  it("30 equipamentos: snapshot de texto, RN-050 e determinismo", async () => {
    const e = entrada(30);
    const [pdf, outro] = [await gerarPdfPmoc(e), await gerarPdfPmoc(e)];
    expect(sha(pdf)).toBe(sha(outro)); // RNF-07: mesmo dado → mesmo PDF
    const paginas = await textoDasPaginas(pdf);
    conferirRnf07(paginas);
    conferirOrdem(paginas);
    const tudo = paginas.join("\n");
    expect(tudo).toContain("Splits, tipo Hi-Wall"); // plural (RN-050)
    expect(tudo).not.toMatch(/tipo Tipo/i); // B12
    // Uma ficha por equipamento, em 1 bloco de 12 meses.
    expect(paginas.filter((p) => p.includes("DESCRIÇÃO") && p.includes("Abr/25"))).toHaveLength(30);
    await expect(paginas.join("\n\f\n")).toMatchFileSnapshot("__snapshots__/pmoc-30.txt");
  });

  it("CA-12.4 e CA-12.2: TH-revisão na capa; campo vazio sem rótulo", async () => {
    const paginas = await textoDasPaginas(await gerarPdfPmoc(entrada(1)));
    const capa = paginas[0] as string;
    expect(capa.split("\n")).toContain("TH12326-R1");
    expect(capa).toContain("Vigência de 01/04/2025 até 31/03/2026");
    expect(capa).toContain("Florianópolis, 1 de abril de 2025"); // RN-011
    const dados = paginas.find((p) => p.includes("1. DADOS DA INSTALAÇÃO")) as string;
    const instalacao = dados.slice(
      dados.indexOf("1. DADOS DA INSTALAÇÃO"),
      dados.indexOf("2. DADOS DO PROPRIETÁRIO"),
    );
    expect(instalacao).toContain("Nº: s/n");
    expect(instalacao).not.toContain("Fone"); // local sem telefone
    expect(instalacao).not.toContain("Bairro");
    expect(dados).toContain("Assinado digitalmente por Responsável Técnico Fictício"); // RF-13.2
  });

  it("CA-12.3: contrato de 18 meses → cada ficha cobre os 18 meses (2 blocos)", async () => {
    const paginas = await textoDasPaginas(await gerarPdfPmoc(entrada(1, 18)));
    const fichas = paginas.filter((p) => p.includes("DESCRIÇÃO") && p.includes("L012-SPL-001"));
    expect(fichas).toHaveLength(2);
    expect(fichas[0]).toContain("Abr/25");
    expect(fichas[0]).toContain("Mar/26");
    expect(fichas[1]).toContain("Abr/26");
    expect(fichas[1]).toContain("Set/26");
    expect(fichas[1]).not.toContain("Out/26");
  });

  it("200 equipamentos: dentro do limite do S-01 e snapshot pelo hash do texto", async () => {
    const ini = performance.now();
    const pdf = await gerarPdfPmoc(entrada(200));
    const ms = performance.now() - ini;
    console.log(`PDF do PMOC com 200 equipamentos: ${Math.round(ms)} ms, ${pdf.length} bytes`);
    expect(ms).toBeLessThan(800_000); // AF-11
    const paginas = await textoDasPaginas(pdf);
    conferirRnf07(paginas);
    conferirOrdem(paginas);
    expect(paginas.filter((p) => p.includes("DESCRIÇÃO") && p.includes("Abr/25"))).toHaveLength(
      200,
    );
    // O texto inteiro passaria de 1 MB no repositório: o snapshot guarda o tamanho e o hash.
    const texto = paginas.join("\n\f\n");
    expect(`${paginas.length} páginas · sha256 ${sha(texto)}`).toMatchSnapshot();
  });
});
