/** Política de senha (06 SEG-01, SEG-02; RN-180; decisão B6). A checagem de senha vazada é do plugin. */

export const SENHA_MIN = 8;
export const SENHA_MAX = 128;

/**
 * Termos que tornam a senha "óbvia" (SEG-02: nome do sistema). [A VALIDAR] nome comercial do sistema:
 * os docs só chamam de "Sistema PMOC".
 */
const TERMOS_OBVIOS = ["pmoc"];

export type ProblemaSenha = "CURTA" | "LONGA" | "OBVIA";

/** Devolve o problema da senha ou `null` se ela atende à política. */
export function validarSenha(senha: string, email: string): ProblemaSenha | null {
  if (senha.length < SENHA_MIN) return "CURTA";
  if (senha.length > SENHA_MAX) return "LONGA";
  const s = senha.toLowerCase();
  const e = email.trim().toLowerCase();
  const local = e.split("@")[0] ?? "";
  if (s === e || (local.length >= 3 && s.includes(local))) return "OBVIA";
  if (TERMOS_OBVIOS.some((t) => s.includes(t))) return "OBVIA";
  return null;
}
