import "server-only";
import { z } from "zod";

const schema = z.object({
  /** Papel app_rw (sem BYPASSRLS, não é dono). Em produção: pooler do Supabase em modo transação. */
  DATABASE_URL: z.url(),
  /** Segredo do Better Auth (assina cookies e cifra o segredo TOTP). Mínimo 32 caracteres. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** URL pública do sistema (links dos e-mails; https em produção liga cookies `__Secure-`, SEG-11). */
  APP_URL: z.url(),
  /** SEG-68: cabeçalhos de IP confiáveis, separados por vírgula [A VALIDAR na Vercel]. */
  AUTH_IP_HEADERS: z.string().default("x-real-ip"),
  /** SEG-02 (senha vazada, API externa). Só `false` em teste sem rede; em produção é sempre ligada. */
  AUTH_CHECAR_SENHA_VAZADA: z.enum(["true", "false"]).default("true"),
  /** LG-25: canal do titular (ex.: privacidade@{dominio}) [A VALIDAR: endereço]. */
  PRIVACIDADE_EMAIL: z.email().optional(),
  /** Pasta dos e-mails gravados em desenvolvimento (fora do git). */
  EMAIL_DEV_DIR: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Valida as variáveis na primeira leitura (falha rápido com mensagem clara, sem imprimir valores). */
export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${names}`);
    }
    cached = parsed.data;
  }
  return cached;
}
