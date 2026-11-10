import "server-only";
import { type AcessoDeps, ganchosAuth } from "@/modules/acesso";
import { getDatabase } from "../db";
import { fileEmailSender, unconfiguredEmailSender } from "../email";
import { getEnv } from "../env";
import { type Auth, createAuth } from "./config";

export type { Auth } from "./config";

let shared: { auth: Auth; deps: AcessoDeps; ipHeaders: string[] } | undefined;

/** Instância única do Better Auth e as dependências do módulo `acesso`. */
export function getAuth() {
  if (!shared) {
    const env = getEnv();
    const db = getDatabase();
    const ipHeaders = env.AUTH_IP_HEADERS.split(",").map((h) => h.trim().toLowerCase());
    // Envio real (Resend, 05 §3.10) entra com as notificações; até lá, produção recusa o envio.
    const production = process.env.NODE_ENV === "production";
    const email = production ? unconfiguredEmailSender() : fileEmailSender(env.EMAIL_DEV_DIR);
    const auth = createAuth({
      db,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_URL,
      email,
      ganchos: ganchosAuth(db, email),
      checarSenhaVazada: production || env.AUTH_CHECAR_SENHA_VAZADA === "true",
      limitarTentativas: true,
      ipHeaders,
    });
    shared = { auth, deps: { db, auth, email, baseURL: env.APP_URL }, ipHeaders };
  }
  return shared;
}
