import "server-only";
import type { ArquivosDeps } from "@/modules/arquivos";
import type { EmpresaDeps } from "@/modules/empresa";
import { chaveDeBase64 } from "./crypto";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { getArmazenamento } from "./storage";

/** Dependências do módulo `arquivos`: o comprovante de envio é assinado com segredo derivado do da aplicação. */
export function arquivosDeps(): ArquivosDeps {
  return {
    db: getDatabase(),
    armazenamento: getArmazenamento(),
    segredo: getEnv().BETTER_AUTH_SECRET,
  };
}

/** Dependências do módulo `empresa`; sem `CERT_ENCRYPTION_KEY`, o envio do certificado recusa. */
export function empresaDeps(): EmpresaDeps {
  const chave = getEnv().CERT_ENCRYPTION_KEY;
  return {
    db: getDatabase(),
    arquivos: arquivosDeps(),
    chaveCertificado: chave ? chaveDeBase64(chave) : null,
  };
}
