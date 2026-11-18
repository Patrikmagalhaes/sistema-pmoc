import "server-only";

/**
 * Campo de assinatura do PDF (decisão do usuário de 18/11/2026: código próprio, no lugar do
 * `@signpdf/placeholder-plain`, cuja dependência `crypto-js` < 4 reprova o `pnpm audit`; 05 §10.4,
 * resultado do S-02; SEG-84).
 *
 * Acrescenta ao PDF um **update incremental** (ISO 32000-1 §7.5.6) sem tocar nos bytes existentes:
 * - o dicionário de assinatura `/Sig`, com `/ByteRange` e `/Contents` reservados para o
 *   `@signpdf/signpdf` preencher;
 * - o widget invisível (`/Rect [0 0 0 0]`) na página 1;
 * - o `/AcroForm` na raiz, com `/SigFlags 3` (há assinatura; só acrescentar);
 * - a nova tabela xref e o trailer com `/Prev`.
 *
 * Serve ao PDF gerado pelo @react-pdf/renderer (tabela xref clássica, sem object streams, sem
 * formulário). Outro formato é recusado, em vez de produzir um arquivo inválido.
 */

/** Marcador que o `@signpdf/signpdf` procura e troca pelo ByteRange real. */
const MARCA_BYTE_RANGE = "/**********";

export interface DadosDoCampo {
  nome: string;
  motivo: string;
  local: string;
  /** `/M` do dicionário: a hora da assinatura (PAdES B-B). */
  quando: Date;
  subFilter: string;
  /** Bytes reservados para o CMS (o `/Contents` leva o dobro em hexadecimal). */
  tamanhoAssinatura: number;
  aplicativo: string;
}

export class ErroCampoAssinatura extends Error {}

const latin = (b: Buffer) => b.toString("latin1");

/** Texto do PDF em UTF-16BE com BOM, em hexadecimal: aceita acento sem depender do PDFDocEncoding. */
const textoPdf = (s: string) => {
  const b = Buffer.from(s, "utf16le");
  b.swap16();
  return `<FEFF${b.toString("hex").toUpperCase()}>`;
};

/** `D:AAAAMMDDHHmmSSZ` (ISO 32000-1 §7.9.4), em UTC. */
const dataPdf = (d: Date) => `(D:${d.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z)`;

interface Leitura {
  /** Deslocamento de cada objeto (número → posição), da tabela xref. */
  offsets: Map<number, number>;
  tamanho: number;
  raiz: number;
  info: string | null;
  id: string | null;
  inicioXref: number;
}

function lerTrailer(pdf: string): Leitura {
  const sx = pdf.lastIndexOf("startxref");
  const tr = pdf.lastIndexOf("trailer", sx);
  if (sx < 0 || tr < 0) throw new ErroCampoAssinatura("PDF sem trailer.");
  const inicioXref = Number(/startxref\s+(\d+)/.exec(pdf.slice(sx))?.[1]);
  const trailer = pdf.slice(tr, sx);
  const tamanho = Number(/\/Size\s+(\d+)/.exec(trailer)?.[1]);
  const raiz = Number(/\/Root\s+(\d+)\s+0\s+R/.exec(trailer)?.[1]);
  if (!Number.isInteger(inicioXref) || !tamanho || !raiz || /\/Prev\b/.test(trailer)) {
    throw new ErroCampoAssinatura("Trailer do PDF fora do formato esperado.");
  }
  if (!pdf.startsWith("xref", inicioXref)) {
    throw new ErroCampoAssinatura("PDF com xref em stream não é aceito.");
  }
  const offsets = new Map<number, number>();
  const linhas = pdf
    .slice(inicioXref + 4, tr)
    .trim()
    .split(/\r?\n|\r/);
  for (let i = 0; i < linhas.length; ) {
    const [ini, qtd] = (linhas[i] ?? "").trim().split(/\s+/).map(Number) as [number, number];
    i++;
    for (let k = 0; k < qtd; k++, i++) {
      const [pos, , tipo] = (linhas[i] ?? "").trim().split(/\s+/);
      if (tipo === "n") offsets.set(ini + k, Number(pos));
    }
  }
  return {
    offsets,
    tamanho,
    raiz,
    info: /\/Info\s+(\d+\s+\d+\s+R)/.exec(trailer)?.[1] ?? null,
    id: /\/ID\s*(\[[^\]]*\])/.exec(trailer)?.[1] ?? null,
    inicioXref,
  };
}

/** Conteúdo entre o `<<` de abertura e o `>>` de fechamento do dicionário do objeto `n`. */
function dicionario(pdf: string, l: Leitura, n: number): string {
  const pos = l.offsets.get(n);
  if (pos === undefined) throw new ErroCampoAssinatura(`Objeto ${n} fora da tabela xref.`);
  const fim = pdf.indexOf("endobj", pos);
  const corpo = pdf.slice(pos, fim);
  if (!corpo.startsWith(`${n} 0 obj`)) throw new ErroCampoAssinatura(`Objeto ${n} não confere.`);
  const a = corpo.indexOf("<<");
  const b = corpo.lastIndexOf(">>");
  if (a < 0 || b < a || /\bstream\b/.test(corpo)) {
    throw new ErroCampoAssinatura(`Objeto ${n} não é um dicionário simples.`);
  }
  return corpo.slice(a + 2, b);
}

const referencia = (dic: string, chave: string) => {
  const m = new RegExp(`/${chave}\\s+(\\d+)\\s+0\\s+R`).exec(dic);
  return m ? Number(m[1]) : null;
};

/** Primeira página: primeiro filho de `/Kids`, descendo por `/Pages` aninhados. */
function primeiraPagina(pdf: string, l: Leitura, raiz: string): number {
  let n = referencia(raiz, "Pages");
  for (let nivel = 0; n !== null && nivel < 32; nivel++) {
    const d = dicionario(pdf, l, n);
    if (/\/Type\s*\/Page\b(?!s)/.test(d)) return n;
    const kids = /\/Kids\s*\[\s*(\d+)\s+0\s+R/.exec(d);
    n = kids ? Number(kids[1]) : null;
  }
  throw new ErroCampoAssinatura("PDF sem página.");
}

/** Acrescenta o widget ao `/Annots` da página (array direto; referência indireta é recusada). */
function comWidget(pagina: string, widget: number): string {
  const i = pagina.indexOf("/Annots");
  if (i < 0) return `${pagina}\n/Annots [${widget} 0 R]\n`;
  const a = pagina.indexOf("[", i);
  if (a < 0 || /\S/.test(pagina.slice(i + 7, a))) {
    throw new ErroCampoAssinatura("/Annots da página fora do formato esperado.");
  }
  const b = pagina.indexOf("]", a);
  return `${pagina.slice(0, b)} ${widget} 0 R${pagina.slice(b)}`;
}

/** Entradas de xref agrupadas em subseções de números seguidos. */
function tabelaXref(entradas: Map<number, number>): string {
  const nums = [...entradas.keys()].sort((a, b) => a - b);
  const linha = (pos: number) => `${String(pos).padStart(10, "0")} 00000 n \n`;
  let r = "xref\n0 1\n0000000000 65535 f \n";
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && (nums[j + 1] as number) === (nums[j] as number) + 1) j++;
    r += `${nums[i]} ${j - i + 1}\n`;
    for (let k = i; k <= j; k++) r += linha(entradas.get(nums[k] as number) as number);
    i = j + 1;
  }
  return r;
}

/** Devolve o PDF com o campo de assinatura vazio, pronto para o `SignPdf().sign`. */
export function adicionarCampoDeAssinatura(original: Buffer, d: DadosDoCampo): Buffer {
  const pdf = latin(original);
  if (pdf.includes("/ByteRange")) throw new ErroCampoAssinatura("O PDF já tem assinatura.");
  const l = lerTrailer(pdf);
  const raiz = dicionario(pdf, l, l.raiz);
  if (raiz.includes("/AcroForm")) throw new ErroCampoAssinatura("PDF com formulário não é aceito.");
  const pagina = primeiraPagina(pdf, l, raiz);
  const dicPagina = dicionario(pdf, l, pagina);

  const sig = l.tamanho;
  const widget = sig + 1;
  const form = sig + 2;
  const objetos: [number, string][] = [
    [
      sig,
      [
        "<<",
        "/Type /Sig",
        "/Filter /Adobe.PPKLite",
        `/SubFilter /${d.subFilter}`,
        `/ByteRange [0 ${MARCA_BYTE_RANGE} ${MARCA_BYTE_RANGE} ${MARCA_BYTE_RANGE}]`,
        `/Contents <${"0".repeat(d.tamanhoAssinatura * 2)}>`,
        `/Reason ${textoPdf(d.motivo)}`,
        `/M ${dataPdf(d.quando)}`,
        `/Name ${textoPdf(d.nome)}`,
        `/Location ${textoPdf(d.local)}`,
        `/Prop_Build << /Filter << /Name /Adobe.PPKLite >> /App << /Name ${textoPdf(d.aplicativo)} >> >>`,
        ">>",
      ].join("\n"),
    ],
    [
      widget,
      `<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/Rect [0 0 0 0]\n/V ${sig} 0 R\n/T ${textoPdf("Assinatura1")}\n/F 4\n/P ${pagina} 0 R\n>>`,
    ],
    [form, `<<\n/Type /AcroForm\n/SigFlags 3\n/Fields [${widget} 0 R]\n>>`],
    [l.raiz, `<<${raiz}\n/AcroForm ${form} 0 R\n>>`],
    [pagina, `<<${comWidget(dicPagina, widget)}>>`],
  ];

  // O update começa numa linha nova depois do `%%EOF` original.
  let corpo = original[original.length - 1] === 0x0a ? "" : "\n";
  const entradas = new Map<number, number>();
  for (const [n, dic] of objetos) {
    entradas.set(n, original.length + Buffer.byteLength(corpo, "latin1"));
    corpo += `${n} 0 obj\n${dic}\nendobj\n`;
  }
  const inicioXref = original.length + Buffer.byteLength(corpo, "latin1");
  corpo += tabelaXref(entradas);
  corpo += [
    "trailer",
    "<<",
    `/Size ${form + 1}`,
    `/Root ${l.raiz} 0 R`,
    ...(l.info ? [`/Info ${l.info}`] : []),
    ...(l.id ? [`/ID ${l.id}`] : []),
    `/Prev ${l.inicioXref}`,
    ">>",
    "startxref",
    String(inicioXref),
    "%%EOF",
    "",
  ].join("\n");
  return Buffer.concat([original, Buffer.from(corpo, "latin1")]);
}
