import "server-only";
import { type AcessoDeps, ganchosAuth } from "@/modules/acesso";
import { getDatabase } from "../db";
import { fileEmailSender } from "../email";
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
    const production = process.env.NODE_ENV === "production";
    if (production) {
      // Envio real (Resend) entra com as notificações; até lá, produção não sobe sem ele.
      throw new Error("Envio de e-mail de produção ainda não configurado (Resend, doc 05 §3.10).");
    }
    const email = fileEmailSender();
    const auth = createAuth({
      db,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_URL,
      email,
      ganchos: ganchosAuth(db),
      checarSenhaVazada: true,
      limitarTentativas: true,
      ipHeaders,
    });
    shared = { auth, deps: { db, auth, email, baseURL: env.APP_URL }, ipHeaders };
  }
  return shared;
}
