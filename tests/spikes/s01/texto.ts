import { inflateSync } from "node:zlib";

/**
 * Extrator de texto mínimo para o spike: descomprime os streams FlateDecode e junta as strings dos
 * operadores `TJ`/`Tj` (fontes padrão do PDF em WinAnsi ≈ latin1). Uma linha por operador. Não serve
 * para o snapshot de texto da Etapa 4 (05 §3.11), que precisa de um extrator de verdade.
 */
export function extrairTexto(pdf: Buffer): string[] {
  const linhas: string[] = [];
  let pos = 0;
  for (;;) {
    const ini = pdf.indexOf("stream", pos);
    if (ini < 0) break;
    const dados = pdf.indexOf("\n", ini) + 1;
    const fim = pdf.indexOf("endstream", dados);
    pos = fim + 9;
    let conteudo: string;
    try {
      conteudo = inflateSync(pdf.subarray(dados, fim)).toString("latin1");
    } catch {
      continue;
    }
    for (const m of conteudo.matchAll(
      /\[((?:<[0-9a-fA-F]*>|[^\]])*)\]\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g,
    )) {
      const partes = m[1]
        ? [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1] ?? "")
        : [m[2] ?? ""];
      linhas.push(partes.map((h) => Buffer.from(h, "hex").toString("latin1")).join(""));
    }
  }
  return linhas;
}

/** Páginas pelo dicionário `/Type /Page` (o pdfkit não usa object streams). */
export function contarPaginas(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
}
