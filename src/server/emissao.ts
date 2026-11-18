import "server-only";
import { VERSAO_APP } from "@/lib/versao-app";
import type { EmissaoDeps } from "@/modules/pmoc";
import { chaveDeBase64 } from "./crypto";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { assinarPdfComA1 } from "./pdf/assinar";
import { gerarPdfPmoc } from "./pdf/pmoc";
import { getArmazenamento } from "./storage";

/**
 * Dependências da emissão do PMOC (RN-009): banco, armazenamento, chave do certificado, gerador e
 * assinador do PDF e o link da TL-007 no rodapé.
 */
export function emissaoDeps(): EmissaoDeps {
  const env = getEnv();
  return {
    db: getDatabase(),
    armazenamento: getArmazenamento(),
    chaveCertificado: env.CERT_ENCRYPTION_KEY ? chaveDeBase64(env.CERT_ENCRYPTION_KEY) : null,
    gerarPdf: gerarPdfPmoc,
    assinarPdf: assinarPdfComA1,
    urlVerificacao: (codigo) => new URL(`/verificar/${codigo}`, env.APP_URL).toString(),
    versaoApp: VERSAO_APP,
  };
}
