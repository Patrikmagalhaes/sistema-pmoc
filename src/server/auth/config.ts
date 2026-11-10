import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { Database } from "../db";
import { authSchema } from "../db/schema/auth";
import type { EmailSender } from "../email";

/**
 * Better Auth 1.7.10 (05 §3.3; AF-04). Opções conferidas no spike S-04 (05 §10.4).
 * As regras de negócio (usuário inativo, bloqueio, senha óbvia, trilha de acesso) vêm de `ganchos`,
 * implementados pelo módulo `acesso`: este arquivo só liga a biblioteca a eles.
 */

/** Papéis da biblioteca. O ADM administra usuários, mas não tem `set-role` (RN-179; decisão B6). */
const ac = createAccessControl({
  user: ["create", "list", "ban", "get", "update", "delete", "set-password", "set-role"],
  session: ["list", "revoke", "delete"],
} as const);
const roles = {
  ADM: ac.newRole({
    user: ["create", "list", "ban", "get", "update", "set-password"],
    session: ["list", "revoke", "delete"],
  }),
  TECNICO: ac.newRole({ user: [], session: [] }),
  CLIENTE: ac.newRole({ user: [], session: [] }),
};

/** Identifica a requisição para a trilha de acesso (06 §3.3.3). */
export interface Origem {
  ip: string | null;
  userAgent: string | null;
}

export interface GanchosAuth {
  /** RN-141: `false` recusa a sessão. Lê `app_user` com contexto SISTEMA (03 §2.1 regra 6). */
  podeAbrirSessao(authUserId: string): Promise<boolean>;
  /** SEG-07: devolve o fim do bloqueio da conta, ou `null`. */
  contaBloqueadaAte(email: string): Promise<Date | null>;
  /** SEG-09: login com senha recusado (e-mail informado). Conta para o bloqueio (SEG-07). */
  registrarFalhaLogin(email: string, origem: Origem): Promise<void>;
  /** SEG-09: login concluído (sessão plena, após o segundo fator quando houver); zera o bloqueio. */
  registrarSessaoAberta(authUserId: string, origem: Origem): Promise<void>;
  /** SEG-09: demais eventos de acesso. */
  registrarEvento(
    authUserId: string,
    tipo:
      | "SENHA_ALTERADA"
      | "SENHA_REDEFINIDA"
      | "MFA_ATIVADO"
      | "MFA_REMOVIDO"
      | "SESSAO_REVOGADA",
    origem: Origem,
  ): Promise<void>;
  /** SEG-02: senha óbvia. Devolve a mensagem de erro ou `null`. */
  problemaSenha(senha: string, email: string): string | null;
}

export interface AuthOptions {
  db: Database;
  secret: string;
  baseURL: string;
  email: EmailSender;
  ganchos: GanchosAuth;
  /** SEG-02 (senha vazada): consulta a API do Have I Been Pwned. Desligado só em teste sem rede. */
  checarSenhaVazada: boolean;
  /** Limitador da biblioteca (SEG-60, SEG-62). Por padrão a biblioteca só o liga em produção. */
  limitarTentativas: boolean;
  /** Cabeçalho de IP confiável (SEG-68) [A VALIDAR na Vercel: `x-vercel-forwarded-for` ou `x-real-ip`]. */
  ipHeaders: string[];
}

const MIN = 60;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Rotas de login com senha e de conclusão do segundo fator. */
const LOGIN_SENHA = "/sign-in/email";
const CONCLUI_SEGUNDO_FATOR = ["/two-factor/verify-totp", "/two-factor/verify-backup-code"];
const REVOGA = [
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
];

const mensagemSenha = (m: string) =>
  APIError.from("BAD_REQUEST", { code: "SENHA_FORA_DA_POLITICA", message: m });

export function createAuth(o: AuthOptions) {
  const origem = (headers?: Headers | null): Origem => {
    let ip: string | null = null;
    for (const h of o.ipHeaders) {
      const v = headers?.get(h)?.split(",")[0]?.trim();
      if (v) {
        ip = v;
        break;
      }
    }
    return { ip, userAgent: headers?.get("user-agent") ?? null };
  };

  return betterAuth({
    baseURL: o.baseURL,
    secret: o.secret,
    database: drizzleAdapter(o.db.authDrizzle, { provider: "pg", schema: authSchema }),
    user: { modelName: "auth_user" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    session: {
      modelName: "auth_session",
      // SEG-10: 30 dias renováveis (PWA). O limite web (12 h sem uso, 7 dias) é do RequestContext.
      expiresIn: 30 * DIA,
      updateAge: 5 * MIN,
    },
    rateLimit: {
      enabled: o.limitarTentativas,
      storage: "database",
      modelName: "auth_rate_limit",
      customRules: {
        [LOGIN_SENHA]: { window: MIN, max: 20 }, // SEG-60: 20 por minuto por IP
        "/request-password-reset": { window: HORA, max: 10 }, // SEG-61: 10 por hora por IP
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: o.ipHeaders },
      // SEG-11: HttpOnly e SameSite=Lax (padrão); `Secure` e prefixo `__Secure-` com baseURL https.
      useSecureCookies: o.baseURL.startsWith("https://"),
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // S-04: sem cadastro público
      minPasswordLength: 8, // SEG-01; RN-180
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * MIN, // SEG-15: recuperação 30 min (o link inicial de 72 h é do módulo acesso)
      revokeSessionsOnPasswordReset: true, // SEG-04
      sendResetPassword: async ({ user, token }) => {
        await o.email.send({
          to: user.email,
          subject: "Redefinir senha",
          text: `Para criar uma nova senha, acesse o link abaixo. Ele vale por 30 minutos e só pode ser usado uma vez.\n\n${o.baseURL}/senha/definir?token=${token}\n\nSe você não pediu, ignore este e-mail.`,
        });
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (s) => ((await o.ganchos.podeAbrirSessao(s.userId)) ? { data: s } : false),
          after: async (s, ctx) => {
            // Com segundo fator, o login por senha abre uma sessão provisória que o plugin apaga em seguida;
            // o LOGIN_OK só vale quando o código é confirmado.
            if (ctx?.path === LOGIN_SENHA) {
              const u = await ctx.context.internalAdapter.findUserById(s.userId);
              if ((u as { twoFactorEnabled?: boolean } | null)?.twoFactorEnabled) return;
            }
            if (ctx?.path === LOGIN_SENHA || CONCLUI_SEGUNDO_FATOR.includes(ctx?.path ?? "")) {
              await o.ganchos.registrarSessaoAberta(s.userId, origem(ctx?.headers));
            }
          },
        },
      },
      account: {
        // Primeira senha (link inicial): a biblioteca cria a conta de credencial em vez de atualizá-la.
        create: {
          after: async (a, ctx) => {
            if (ctx?.path !== "/reset-password" || !(a as { password?: string | null }).password)
              return;
            await o.ganchos.registrarEvento(a.userId, "SENHA_REDEFINIDA", origem(ctx?.headers));
          },
        },
        update: {
          after: async (a, ctx) => {
            if (!(a as { password?: string | null }).password) return;
            const tipo = ctx?.path === "/change-password" ? "SENHA_ALTERADA" : "SENHA_REDEFINIDA";
            await o.ganchos.registrarEvento(a.userId, tipo, origem(ctx?.headers));
          },
        },
      },
      user: {
        update: {
          after: async (u, ctx) => {
            const changed = (u as { twoFactorEnabled?: boolean }).twoFactorEnabled;
            if (ctx?.path?.startsWith("/two-factor/") && changed !== undefined) {
              await o.ganchos.registrarEvento(
                u.id,
                changed ? "MFA_ATIVADO" : "MFA_REMOVIDO",
                origem(ctx?.headers),
              );
            }
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        if (ctx.path === LOGIN_SENHA && typeof body.email === "string") {
          if (await o.ganchos.contaBloqueadaAte(body.email)) {
            throw APIError.from("TOO_MANY_REQUESTS", {
              code: "CONTA_BLOQUEADA",
              message: "Muitas tentativas. Tente novamente em alguns minutos.",
            });
          }
        }
        // SEG-02: senha óbvia (o tamanho é checado pela biblioteca; a senha vazada, pelo plugin).
        const senha = typeof body.newPassword === "string" ? body.newPassword : body.password;
        if (typeof senha !== "string") return;
        let email: string | null = null;
        if (ctx.path === "/admin/create-user" && typeof body.email === "string") email = body.email;
        if (ctx.path === "/change-password")
          email = (await getSessionFromCtx(ctx))?.user.email ?? null;
        if (ctx.path === "/reset-password" && typeof body.token === "string") {
          const v = await ctx.context.internalAdapter.findVerificationValue(
            `reset-password:${body.token}`,
          );
          email = v
            ? ((await ctx.context.internalAdapter.findUserById(v.value))?.email ?? null)
            : null;
        }
        if (ctx.path === "/admin/set-user-password" && typeof body.userId === "string") {
          email = (await ctx.context.internalAdapter.findUserById(body.userId))?.email ?? null;
        }
        if (email) {
          const problema = o.ganchos.problemaSenha(senha, email);
          if (problema) throw mensagemSenha(problema);
        }
        // SEG-04: trocar a senha sempre revoga as outras sessões.
        if (ctx.path === "/change-password")
          return { context: { body: { ...body, revokeOtherSessions: true } } };
      }),
      after: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const returned = ctx.context.returned;
        const falhou = returned instanceof APIError;
        if (ctx.path === LOGIN_SENHA && typeof body.email === "string") {
          // Login recusado antes da senha (conta bloqueada) não conta como nova tentativa.
          const bloqueado = falhou && (returned as APIError).body?.code === "CONTA_BLOQUEADA";
          if (falhou && !bloqueado)
            await o.ganchos.registrarFalhaLogin(body.email, origem(ctx.headers));
        }
        if (REVOGA.includes(ctx.path) && !falhou) {
          const alvo =
            typeof body.userId === "string"
              ? body.userId
              : ((await getSessionFromCtx(ctx))?.user.id ?? null);
          if (alvo) await o.ganchos.registrarEvento(alvo, "SESSAO_REVOGADA", origem(ctx.headers));
        }
      }),
    },
    plugins: [
      admin({ ac, roles, adminRoles: ["ADM"], defaultRole: "CLIENTE" }),
      twoFactor({
        issuer: "PMOC",
        twoFactorTable: "auth_two_factor",
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * MIN }, // SEG-62
      }),
      haveIBeenPwned({
        enabled: o.checarSenhaVazada,
        customPasswordCompromisedMessage:
          "Esta senha aparece em vazamentos conhecidos. Escolha outra.",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
