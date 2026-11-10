import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { can } from "@/modules/autorizacao";
import type { Auth, GanchosAuth, Origem } from "@/server/auth/config";
import {
  type AuditSource,
  buildContext,
  type RequestContext,
  systemContext,
} from "@/server/context";
import type { Database } from "@/server/db";
import type { EmailSender } from "@/server/email";
import { bloqueadaAte } from "./domain/bloqueio";
import { validarSenha } from "./domain/senha";
import { avaliarSessao, LIMITES_SESSAO, type Perfil } from "./domain/sessao";
import * as repo from "./repo";
import { alterarSituacaoSchema, type CriarUsuarioInput, criarUsuarioSchema } from "./schemas";

/** Erro de regra do módulo; `codigo` é estável para a tela escolher a mensagem (04 E-xx). */
export class ErroAcesso extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "EMAIL_EM_USO"
      | "ALTERADO_POR_OUTRO"
      | "MINIMO_DE_ADMS",
    message: string,
  ) {
    super(message);
  }
}

export interface AcessoDeps {
  db: Database;
  auth: Auth;
  email: EmailSender;
  baseURL: string;
}

/** SHA-256 do e-mail normalizado (06 §3.3.3): conta tentativas sem guardar o e-mail em claro. */
export const hashEmail = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

const sistema = (motivo: string) => systemContext(randomUUID(), motivo);

/** SEG-61: 3 pedidos de link de recuperação por hora por e-mail. */
const LIMITE_LINK_POR_EMAIL = { janelaMs: 60 * 60 * 1000, max: 3 } as const;

/** Janela de leitura das tentativas para o bloqueio (SEG-07) [A VALIDAR: "seguidas" sem prazo no doc]. */
const JANELA_TENTATIVAS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Ganchos do Better Auth (src/server/auth). Rodam com contexto SISTEMA (03 §2.1 regra 6).
// ---------------------------------------------------------------------------------------------

export function ganchosAuth(db: Database): GanchosAuth {
  const evento = (
    tipo: repo.TipoEventoSeguranca,
    userId: string | null,
    emailHash: string | null,
    o: Origem,
  ) =>
    db.withTransaction(sistema("trilha de acesso"), (tx) =>
      repo.inserirEventoSeguranca(tx, {
        tipo,
        userId,
        emailHash,
        ip: o.ip,
        userAgent: o.userAgent,
        requestId: null,
      }),
    );

  return {
    async podeAbrirSessao(authUserId) {
      const u = await db.withTransaction(sistema("abrir sessão"), (tx) =>
        repo.buscarPorAuthId(tx, authUserId),
      );
      return u?.situacao === "ATIVO"; // RN-141; usuário sem app_user também não entra
    },

    async contaBloqueadaAte(email) {
      const desde = new Date(Date.now() - JANELA_TENTATIVAS_MS);
      const t = await db.withTransaction(sistema("bloqueio de login"), (tx) =>
        repo.listarTentativasLogin(tx, hashEmail(email), desde),
      );
      return bloqueadaAte(t, new Date());
    },

    async registrarFalhaLogin(email, o) {
      const h = hashEmail(email);
      await db.withTransaction(sistema("trilha de acesso"), async (tx) => {
        const u = await repo.buscarPorEmail(tx, email.trim().toLowerCase());
        const desde = new Date(Date.now() - JANELA_TENTATIVAS_MS);
        const antes = bloqueadaAte(await repo.listarTentativasLogin(tx, h, desde), new Date());
        const base = {
          userId: u?.id ?? null,
          emailHash: h,
          ip: o.ip,
          userAgent: o.userAgent,
          requestId: null,
        };
        await repo.inserirEventoSeguranca(tx, { ...base, tipo: "LOGIN_FALHA" });
        const depois = bloqueadaAte(await repo.listarTentativasLogin(tx, h, desde), new Date());
        if (!antes && depois)
          await repo.inserirEventoSeguranca(tx, { ...base, tipo: "CONTA_BLOQUEADA" });
      });
    },

    async registrarSessaoAberta(authUserId, o) {
      await db.withTransaction(sistema("trilha de acesso"), async (tx) => {
        const u = await repo.buscarPorAuthId(tx, authUserId);
        await repo.inserirEventoSeguranca(tx, {
          tipo: "LOGIN_OK",
          userId: u?.id ?? null,
          emailHash: u ? hashEmail(u.email) : null,
          ip: o.ip,
          userAgent: o.userAgent,
          requestId: null,
        });
      });
    },

    async registrarEvento(authUserId, tipo, o) {
      const u = await db.withTransaction(sistema("trilha de acesso"), (tx) =>
        repo.buscarPorAuthId(tx, authUserId),
      );
      await evento(tipo, u?.id ?? null, null, o);
    },

    async podeEnviarLinkRecuperacao(authUserId, email) {
      return db.withTransaction(sistema("link de recuperação"), async (tx) => {
        const u = await repo.buscarPorAuthId(tx, authUserId);
        if (u?.situacao !== "ATIVO") return false;
        const { janelaMs, max } = LIMITE_LINK_POR_EMAIL;
        return repo.consumirLimite(tx, `link-senha:${hashEmail(email)}`, janelaMs, max);
      });
    },

    problemaSenha(senha, email) {
      const p = validarSenha(senha, email);
      if (p === "CURTA") return "A senha precisa ter pelo menos 8 caracteres.";
      if (p === "LONGA") return "A senha pode ter no máximo 128 caracteres.";
      if (p === "OBVIA")
        return "Escolha uma senha que não contenha seu e-mail nem o nome do sistema.";
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sessão → RequestContext (MOD-04)
// ---------------------------------------------------------------------------------------------

export type SessaoResolvida =
  | { estado: "ANONIMO" }
  /** RN-194: ADM sem segundo fator; só TL-004. */
  | { estado: "SEGUNDO_FATOR_PENDENTE"; usuario: repo.UsuarioAcesso }
  | { estado: "OK"; ctx: RequestContext; usuario: repo.UsuarioAcesso };

type CanalUsuario = Exclude<AuditSource, "SISTEMA">;

const canalPadrao: Record<Perfil, CanalUsuario> = {
  ADM: "WEB_ADM",
  CLIENTE: "PORTAL_CLIENTE",
  TECNICO: "PWA_TECNICO",
};

/**
 * Lê a sessão do cookie **sem** a renovação automática da biblioteca, aplica `avaliarSessao`
 * (SEG-10, RN-141, RN-194) e só então renova. Sessão recusada é apagada (revogada).
 */
export async function resolverSessao(
  headers: Headers,
  deps: Pick<AcessoDeps, "db" | "auth">,
  opcoes: { ipHeaders?: string[]; canal?: CanalUsuario; agora?: Date } = {},
): Promise<SessaoResolvida> {
  const s = await deps.auth.api.getSession({ headers, query: { disableRefresh: true } });
  if (!s) return { estado: "ANONIMO" };
  const usuario = await deps.db.withTransaction(sistema("ler sessão"), (tx) =>
    repo.buscarPorAuthId(tx, s.user.id),
  );
  const c = await deps.auth.$context;
  if (!usuario) {
    await c.internalAdapter.deleteSession(s.session.token);
    return { estado: "ANONIMO" };
  }
  const agora = opcoes.agora ?? new Date();
  const r = avaliarSessao({
    perfil: usuario.perfil,
    situacao: usuario.situacao,
    criadaEm: new Date(s.session.createdAt),
    ultimoUso: new Date(s.session.updatedAt),
    segundoFatorAtivo: Boolean((s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled),
    agora,
  });
  if (!r.ok) {
    await c.internalAdapter.deleteSession(s.session.token);
    return { estado: "ANONIMO" };
  }
  if (agora.getTime() - new Date(s.session.updatedAt).getTime() >= LIMITES_SESSAO.renovacaoMs) {
    await c.internalAdapter.updateSession(s.session.token, {
      expiresAt: new Date(agora.getTime() + LIMITES_SESSAO.renovavelMs),
      updatedAt: agora,
    });
  }
  if (r.somenteConfigurarSegundoFator) return { estado: "SEGUNDO_FATOR_PENDENTE", usuario };

  let ip: string | null = null;
  for (const h of opcoes.ipHeaders ?? []) {
    const v = headers.get(h)?.split(",")[0]?.trim();
    if (v) {
      ip = v;
      break;
    }
  }
  const ctx = buildContext({
    userId: usuario.id,
    role: usuario.perfil,
    clientId: usuario.clientId,
    requestId: randomUUID(),
    ipAddress: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
    source: opcoes.canal ?? canalPadrao[usuario.perfil],
  });
  return { estado: "OK", ctx, usuario };
}

// ---------------------------------------------------------------------------------------------
// Gestão de usuários pelo ADM (RF-02; TL-106, TL-107)
// ---------------------------------------------------------------------------------------------

const exigir = (ctx: RequestContext) => {
  if (!can(ctx, "usuario.gerenciar", {})) {
    throw new ErroAcesso("SEM_PERMISSAO", "Sem permissão para gerenciar usuários.");
  }
};

/** Link de senha inicial (DFT-01; SEG-15): 72 h, uso único, consumido por `/reset-password`. */
export const VALIDADE_LINK_INICIAL_MS = 72 * 60 * 60 * 1000;

async function enviarLinkSenhaInicial(
  deps: AcessoDeps,
  u: { authUserId: string; email: string; nome: string },
) {
  const token = randomBytes(24).toString("base64url");
  const c = await deps.auth.$context;
  await c.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: u.authUserId,
    expiresAt: new Date(Date.now() + VALIDADE_LINK_INICIAL_MS),
  });
  await deps.email.send({
    to: u.email,
    subject: "Defina sua senha de acesso",
    text: `Olá, ${u.nome}.\n\nSua conta foi criada. Para definir sua senha, acesse o link abaixo. Ele vale por 72 horas e só pode ser usado uma vez.\n\n${deps.baseURL}/senha/definir?token=${token}`,
  });
}

/**
 * Cria o usuário (03 §2.1 regra 5): `auth_user` pela API da biblioteca (com a sessão do ADM em
 * `headers`), depois `app_user` em `withTransaction`; se o segundo passo falhar, apaga o `auth_user`.
 * O perfil vai para o `auth_user` pelo servidor, nunca pela rota (`set-role` negado ao ADM, S-04).
 */
export async function criarUsuario(
  ctx: RequestContext,
  input: CriarUsuarioInput,
  headers: Headers,
  deps: AcessoDeps,
): Promise<{ id: string }> {
  exigir(ctx);
  const v = criarUsuarioSchema.parse(input);
  const existente = await deps.db.withTransaction(ctx, (tx) => repo.buscarPorEmail(tx, v.email));
  if (existente) throw new ErroAcesso("EMAIL_EM_USO", "Já existe um usuário com este e-mail.");

  const criado = await deps.auth.api.createUser({
    headers,
    body: { email: v.email, name: v.nome },
  });
  const authUserId = criado.user.id;
  const c = await deps.auth.$context;
  let id: string;
  try {
    await c.internalAdapter.updateUser(authUserId, { role: v.perfil });
    id = await deps.db.withTransaction(ctx, (tx) =>
      repo.inserirUsuario(tx, {
        authUserId,
        nome: v.nome,
        email: v.email,
        perfil: v.perfil,
        clientId: v.clientId ?? null,
        telefone: v.telefone ?? null,
      }),
    );
  } catch (e) {
    await c.internalAdapter.deleteUser(authUserId); // compensação (AF-04)
    throw e;
  }
  await enviarLinkSenhaInicial(deps, { authUserId, email: v.email, nome: v.nome });
  return { id };
}

/**
 * Inativa (RN-141; CA-01.2): `app_user` → INATIVO, depois banir + revogar todas as sessões.
 * SEG-17: não deixa o sistema com menos de 2 ADMs ativos com segundo fator.
 */
export async function inativarUsuario(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  headers: Headers,
  deps: AcessoDeps,
): Promise<void> {
  exigir(ctx);
  const v = alterarSituacaoSchema.parse(input);
  const alvo = await deps.db.withTransaction(ctx, async (tx) => {
    const u = await repo.buscarPorId(tx, v.id);
    if (!u) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
    if (u.perfil === "ADM" && u.situacao === "ATIVO") {
      const c = await deps.auth.$context;
      const a = await c.internalAdapter.findUserById(u.authUserId);
      const contaEle = (a as { twoFactorEnabled?: boolean } | null)?.twoFactorEnabled ? 1 : 0;
      if ((await repo.contarAdmsAtivosComSegundoFator(tx)) - contaEle < 2) {
        throw new ErroAcesso(
          "MINIMO_DE_ADMS",
          "O sistema precisa de pelo menos 2 administradores ativos com segundo fator.",
        );
      }
    }
    if (!(await repo.alterarSituacao(tx, v.id, "INATIVO", v.rowVersion))) {
      throw new ErroAcesso(
        "ALTERADO_POR_OUTRO",
        "Este usuário foi alterado por outra pessoa. Recarregue.",
      );
    }
    return u;
  });
  // Mesmo se a biblioteca falhar aqui, o INATIVO já impede login e uso da sessão (resolverSessao).
  await deps.auth.api.banUser({
    headers,
    body: { userId: alvo.authUserId, banReason: "INATIVADO" },
  });
  await deps.auth.api.revokeUserSessions({ headers, body: { userId: alvo.authUserId } });
}

// ---------------------------------------------------------------------------------------------
// Definir senha (TL-003; FL-01 passos 3–4). Público: o token é a credencial.
// ---------------------------------------------------------------------------------------------

/** E-01.4: o link existe, não foi usado e não venceu. */
export async function linkDeSenhaValido(
  token: string,
  deps: Pick<AcessoDeps, "auth">,
): Promise<boolean> {
  if (!/^[\w-]{16,128}$/.test(token)) return false;
  const c = await deps.auth.$context;
  const v = await c.internalAdapter.findVerificationValue(`reset-password:${token}`);
  return Boolean(v && new Date(v.expiresAt) > new Date());
}

export type ResultadoDefinirSenha =
  | { ok: true }
  | { ok: false; erro: "LINK_INVALIDO" }
  | { ok: false; erro: "SENHA"; mensagem: string };

const codigoDoErro = (e: unknown): string | undefined =>
  (e as { body?: { code?: string } } | null)?.body?.code;

export async function definirSenha(
  token: string,
  novaSenha: string,
  deps: Pick<AcessoDeps, "auth">,
): Promise<ResultadoDefinirSenha> {
  try {
    await deps.auth.api.resetPassword({ body: { token, newPassword: novaSenha } });
    return { ok: true };
  } catch (e) {
    const codigo = codigoDoErro(e);
    if (codigo === "INVALID_TOKEN" || codigo === "USER_NOT_FOUND")
      return { ok: false, erro: "LINK_INVALIDO" };
    if (codigo === "SENHA_FORA_DA_POLITICA") {
      return { ok: false, erro: "SENHA", mensagem: (e as Error).message };
    }
    if (codigo === "PASSWORD_TOO_SHORT") {
      return { ok: false, erro: "SENHA", mensagem: "A senha precisa ter pelo menos 8 caracteres." };
    }
    if (codigo === "PASSWORD_TOO_LONG") {
      return { ok: false, erro: "SENHA", mensagem: "A senha pode ter no máximo 128 caracteres." };
    }
    if (codigo === "PASSWORD_COMPROMISED") {
      return {
        ok: false,
        erro: "SENHA",
        mensagem: "Esta senha aparece em vazamentos conhecidos. Escolha outra.",
      };
    }
    throw e;
  }
}

/** TL-004 "Segundo fator ativo desde {data}": só o próprio usuário. */
export async function segundoFatorAtivoDesde(
  ctx: RequestContext,
  deps: Pick<AcessoDeps, "db">,
): Promise<Date | null> {
  if (!ctx.userId) return null;
  const userId = ctx.userId;
  return deps.db.withTransaction(ctx, (tx) => repo.ultimoEvento(tx, userId, "MFA_ATIVADO"));
}
