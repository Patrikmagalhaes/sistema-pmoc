import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentoPmoc, type EntradaPdfPmoc } from "./documento";

export type { EntradaPdfPmoc, LogoDoPdf } from "./documento";

/**
 * Gera o PDF do PMOC, sem assinatura (a do RT vem depois, RN-009 passos 1 e 2). Síncrono, dentro da
 * requisição (RN-188; spike S-01).
 */
export function gerarPdfPmoc(e: EntradaPdfPmoc): Promise<Buffer> {
  return renderToBuffer(<DocumentoPmoc e={e} />);
}
