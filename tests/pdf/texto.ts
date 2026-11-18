/**
 * Extrator de texto para o snapshot dos PDFs (05 §3.11): `pdfjs-dist` (decisão do usuário de
 * 18/11/2026). Devolve o texto de cada página, uma linha por fim de linha do PDF.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Dados das fontes padrão (Helvetica…) do pdf.js. No Node ele lê do disco: caminho do sistema de
 * arquivos com `/`, não URL `file://` (que falha com "Unable to load font data").
 */
const FONTES = `${join(
  dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
  "standard_fonts",
).replaceAll("\\", "/")}/`;

/** Abre o PDF no pdf.js; `fechar` libera o documento. */
export async function abrirPdf(pdf: Buffer) {
  const tarefa = getDocument({
    data: new Uint8Array(pdf),
    disableFontFace: true,
    standardFontDataUrl: FONTES,
    verbosity: 0,
  });
  return { doc: await tarefa.promise, fechar: () => tarefa.destroy() };
}

export async function textoDasPaginas(pdf: Buffer): Promise<string[]> {
  const { doc, fechar } = await abrirPdf(pdf);
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent();
    let t = "";
    for (const item of conteudo.items) {
      if (!("str" in item)) continue;
      t += item.str;
      if (item.hasEOL) t += "\n";
    }
    paginas.push(
      t
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l !== "")
        .join("\n"),
    );
  }
  await fechar();
  return paginas;
}
