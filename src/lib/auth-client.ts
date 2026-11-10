"use client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Cliente do Better Auth no navegador (mesma origem; `/api/auth`). */
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });

/** Status → mensagem (04 FL-01 E-01.1 a E-01.3, E-01.7). Nunca revela se o e-mail existe. */
export function mensagemDeLogin(status: number | undefined, etapa: "senha" | "codigo"): string {
  if (status === 429) return "Muitas tentativas. Tente novamente em alguns minutos.";
  if (status === undefined || status === 0) return "Sem conexão. Tente novamente.";
  if (status >= 500) return "Não foi possível entrar agora. Tente novamente.";
  return etapa === "senha" ? "E-mail ou senha incorretos." : "Código incorreto.";
}
