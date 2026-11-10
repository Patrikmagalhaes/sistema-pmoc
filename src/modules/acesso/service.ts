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
import {
  type AtualizarUsuarioInput,
  alterarSituacaoSchema,
  atualizarUsuarioSchema,
  type CriarUsuarioInput,
  criarUsuarioSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável para a tela escolher a mensagem (04 E-xx). */
export class ErroAcesso extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "EMAIL_EM_USO"
      | "ALTERADO_POR_OUTRO"
      | "MINIMO_DE_ADMS"
      | "PROPRIO_USUARIO"
      | "NAO_ATIVO"
      | "MOTIVO_OBRIGATORIO"
      | "SEM_SEGUNDO_FATOR"
      | "JA_EXISTE_ADM",
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

/** SEG-19: e-mail de segurança da conta quando a senha ou o segundo fator mudam. */
const AVISO_SEGURANCA: Partial<Record<repo.TipoEventoSeguranca, string>> = {
  SENHA_ALTERADA: "A senha da sua conta foi alterada.",
  SENHA_REDEFINIDA: "A senha da sua conta foi definida ou redefinida.",
  MFA_ATIVADO: "O segundo fator (aplicativo autenticador) da sua conta foi ativado.",
  MFA_REMOVIDO: "O segundo fator (aplicativo autenticador) da sua conta foi removido.",
};

/** O e-mail não pode desfazer a mudança: falha de envio é ignorada. */
async function avisarSeguranca(
  email: EmailSender,
  u: { email: string; nome: string },
  tipo: repo.TipoEventoSeguranca,
) {
  const aviso = AVISO_SEGURANCA[tipo];
  if (!aviso) return;
  await email
    .send({
      to: u.email,
      subject: "Aviso de segurança da sua conta",
      text: `Olá, ${u.nome}.

${aviso}

Se não foi você, fale com o administrador do sistema imediatamente.`,
    })
    .catch(() => {});
}

export function ganchosAuth(db: Database, email: EmailSender): GanchosAuth {
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
      if (u) await avisarSeguranca(email, u, tipo);
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
  | { estado: "OK"; ctx: RequestContext; usuario: repo.UsuarioAcesso; sessaoId: string };

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
  return { estado: "OK", ctx, usuario, sessaoId: s.session.id };
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
): Promise<{ id: string; emailEnviado: boolean }> {
  exigir(ctx);
  const v = criarUsuarioSchema.parse(input);
  const existente = await deps.db.withTransaction(ctx, (tx) => repo.buscarPorEmail(tx, v.email));
  if (existente) throw new ErroAcesso("EMAIL_EM_USO", "Este e-mail já está em uso.");

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
  // E-04.8: o usuário fica criado mesmo se o e-mail falhar; a tela oferece "Reenviar link".
  const emailEnviado = await enviarLinkSenhaInicial(deps, {
    authUserId,
    email: v.email,
    nome: v.nome,
  }).then(
    () => true,
    () => false,
  );
  return { id, emailEnviado };
}

/**
 * Primeiro ADM de um banco novo (runbook `docs/runbooks/primeiro-adm.md`): não há ADM para usar a
 * TL-107, então o operador roda `pnpm adm:primeiro`. Só funciona enquanto não existe nenhum ADM
 * (ativo ou inativo); depois disso, ADM novo só pela TL-107 e recuperação só pela SEG-17/SEG-18.
 * Não recebe senha: envia o mesmo link inicial de 72 h (DFT-01) e, no primeiro login, a TL-004.
 */
export async function criarPrimeiroAdm(
  input: { nome: string; email: string; telefone?: string | null },
  deps: AcessoDeps,
): Promise<{ id: string }> {
  const v = criarUsuarioSchema.parse({ ...input, perfil: "ADM" });
  const ctx = sistema("primeiro ADM (runbook)");
  if (await deps.db.withTransaction(ctx, (tx) => repo.existeAdm(tx))) {
    throw new ErroAcesso(
      "JA_EXISTE_ADM",
      "Já existe administrador. Crie novos pela tela de usuários ou siga o runbook de acesso de emergência.",
    );
  }
  if (await deps.db.withTransaction(ctx, (tx) => repo.buscarPorEmail(tx, v.email))) {
    throw new ErroAcesso("EMAIL_EM_USO", "Este e-mail já está em uso.");
  }
  const c = await deps.auth.$context;
  const a = await c.internalAdapter.createUser(
    { email: v.email, name: v.nome, emailVerified: true, role: "ADM" },
    { method: "admin" },
  );
  try {
    // Aqui o e-mail é obrigatório e vem antes do `app_user`: se não sair, nada fica criado e o
    // operador roda de novo (o `app_user` não tem exclusão física, EL-8).
    await enviarLinkSenhaInicial(deps, { authUserId: a.id, email: v.email, nome: v.nome });
    const id = await deps.db.withTransaction(ctx, (tx) =>
      repo.inserirUsuario(tx, {
        authUserId: a.id,
        nome: v.nome,
        email: v.email,
        perfil: "ADM",
        clientId: null,
        telefone: v.telefone ?? null,
      }),
    );
    return { id };
  } catch (e) {
    await c.internalAdapter.deleteUser(a.id); // compensação (AF-04); um link já enviado deixa de valer
    throw e;
  }
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
  if (v.id === ctx.userId) {
    throw new ErroAcesso("PROPRIO_USUARIO", "Você não pode inativar o próprio usuário."); // E-05.2
  }
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

/** Reativar (RN-141, exceção inferida; FL-05): `INATIVO` → `ATIVO` e retira o banimento. */
export async function reativarUsuario(
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
    if (!(await repo.alterarSituacao(tx, v.id, "ATIVO", v.rowVersion))) {
      throw new ErroAcesso(
        "ALTERADO_POR_OUTRO",
        "Este usuário foi alterado por outra pessoa. Recarregue.",
      );
    }
    return u;
  });
  await deps.auth.api.unbanUser({ headers, body: { userId: alvo.authUserId } });
}

export interface FiltroUsuariosInput {
  perfil?: string | null;
  situacao?: string | null;
  clientId?: string | null;
  busca?: string | null;
  pagina?: number | string | null;
}

/** UL-01: 25 por página (decisão C2). */
export const USUARIOS_POR_PAGINA = 25;

/** TL-106. Filtros inválidos (vindos da URL) são ignorados, nunca quebram a tela. */
export async function listarUsuarios(
  ctx: RequestContext,
  f: FiltroUsuariosInput,
  deps: Pick<AcessoDeps, "db">,
) {
  exigir(ctx);
  const perfil = ["ADM", "TECNICO", "CLIENTE"].includes(f.perfil ?? "")
    ? (f.perfil as Perfil)
    : null;
  const situacao =
    f.situacao === "ATIVO" || f.situacao === "INATIVO" ? (f.situacao as "ATIVO" | "INATIVO") : null;
  const clientId = f.clientId && /^[0-9a-f-]{36}$/i.test(f.clientId) ? f.clientId : null;
  const busca = f.busca?.trim() ? f.busca.trim().slice(0, 100) : null;
  const pagina = Math.max(1, Math.trunc(Number(f.pagina) || 1));
  const r = await deps.db.withTransaction(ctx, (tx) =>
    repo.listarUsuarios(tx, {
      perfil,
      situacao,
      clientId,
      busca,
      pagina,
      porPagina: USUARIOS_POR_PAGINA,
    }),
  );
  return { ...r, pagina, porPagina: USUARIOS_POR_PAGINA };
}

/** TL-107 aberto: `null` vira o estado `NAO_ENCONTRADO`. */
export async function obterUsuario(
  ctx: RequestContext,
  id: string,
  deps: Pick<AcessoDeps, "db">,
): Promise<repo.DetalheUsuario | null> {
  exigir(ctx);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return deps.db.withTransaction(ctx, (tx) => repo.buscarDetalhe(tx, id));
}

/** TL-107 "Salvar" na edição. O nome também vai para o `auth_user` (cópia, 03 §2.1 regra 3). */
export async function atualizarUsuario(
  ctx: RequestContext,
  input: AtualizarUsuarioInput,
  deps: AcessoDeps,
): Promise<void> {
  exigir(ctx);
  const v = atualizarUsuarioSchema.parse(input);
  const u = await deps.db.withTransaction(ctx, async (tx) => {
    const atual = await repo.buscarPorId(tx, v.id);
    if (!atual) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
    const ok = await repo.atualizarDados(
      tx,
      v.id,
      { nome: v.nome, telefone: v.telefone ?? null },
      v.rowVersion,
    );
    if (!ok) {
      throw new ErroAcesso(
        "ALTERADO_POR_OUTRO",
        "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
      );
    }
    return atual;
  });
  const c = await deps.auth.$context;
  await c.internalAdapter.updateUser(u.authUserId, { name: v.nome });
}

/** TL-107 "Reenviar link de senha" (só `ATIVO`): novo link inicial de 72 h (DFT-01; E-04.8). */
export async function reenviarLinkSenha(
  ctx: RequestContext,
  id: string,
  deps: AcessoDeps,
): Promise<void> {
  exigir(ctx);
  const u = await deps.db.withTransaction(ctx, (tx) => repo.buscarPorId(tx, id));
  if (!u) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
  if (u.situacao !== "ATIVO") throw new ErroAcesso("NAO_ATIVO", "Só usuário ativo recebe o link.");
  await enviarLinkSenhaInicial(deps, { authUserId: u.authUserId, email: u.email, nome: u.nome });
}

/** Tamanho máximo do motivo da redefinição do segundo fator [A VALIDAR: o doc não fixa]. */
export const MOTIVO_MAX = 500;

/**
 * TL-107 "Redefinir segundo fator" (SEG-17; RN-194): outro ADM apaga o TOTP e os códigos de
 * recuperação de um ADM que perdeu o aplicativo, com motivo obrigatório gravado no `audit_log`.
 * As sessões do alvo são encerradas; no próximo login ele só vê a TL-004 (RN-194).
 * Não aplica o mínimo de 2 ADMs: o alvo já não consegue usar o segundo fator, e bloquear aqui
 * impediria justamente a recuperação que a regra quer garantir.
 */
export async function redefinirSegundoFator(
  ctx: RequestContext,
  input: { id: string; motivo: string },
  origem: Origem,
  deps: AcessoDeps,
): Promise<void> {
  exigir(ctx);
  const motivo = input.motivo.trim();
  if (!motivo || motivo.length > MOTIVO_MAX) {
    throw new ErroAcesso("MOTIVO_OBRIGATORIO", `Informe o motivo (até ${MOTIVO_MAX} caracteres).`);
  }
  if (input.id === ctx.userId) {
    // Com acesso, o próprio ADM gera novos códigos na TL-004; sem acesso, precisa de outro ADM.
    throw new ErroAcesso(
      "PROPRIO_USUARIO",
      "Você não pode redefinir o próprio segundo fator. Peça a outro administrador.",
    );
  }
  const c = await deps.auth.$context;
  const alvo = await deps.db.withTransaction({ ...ctx, reason: motivo }, async (tx) => {
    const u = /^[0-9a-f-]{36}$/i.test(input.id) ? await repo.buscarPorId(tx, input.id) : null;
    if (!u) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
    if (
      u.perfil !== "ADM" ||
      u.situacao !== "ATIVO" ||
      !(await repo.segundoFatorLigado(tx, u.authUserId))
    ) {
      throw new ErroAcesso(
        "SEM_SEGUNDO_FATOR",
        "Só um administrador ativo com segundo fator pode ter o segundo fator redefinido.",
      );
    }
    await repo.auditarRedefinicaoSegundoFator(tx, u.authUserId);
    // Dentro da transação: se a biblioteca falhar, a linha de auditoria não fica sem a mudança.
    await c.adapter.deleteMany({
      model: "twoFactor",
      where: [{ field: "userId", value: u.authUserId }],
    });
    await c.internalAdapter.updateUser(u.authUserId, { twoFactorEnabled: false });
    await c.internalAdapter.deleteUserSessions(u.authUserId);
    for (const tipo of ["MFA_REMOVIDO", "SESSAO_REVOGADA"] as const) {
      await repo.inserirEventoSeguranca(tx, {
        tipo,
        userId: u.id,
        emailHash: null,
        ip: origem.ip,
        userAgent: origem.userAgent,
        requestId: ctx.requestId,
      });
    }
    return u;
  });
  await avisarSeguranca(deps.email, alvo, "MFA_REMOVIDO"); // SEG-19
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

// ---------------------------------------------------------------------------------------------
// Minha conta (TL-005; SEG-13; LG-21). Só os próprios dados: o alvo é sempre `ctx.userId`.
// ---------------------------------------------------------------------------------------------

const eu = (ctx: RequestContext): string => {
  if (!ctx.userId || ctx.role === "SISTEMA") {
    throw new ErroAcesso("SEM_PERMISSAO", "Entre para ver sua conta.");
  }
  return ctx.userId;
};

/** TL-005: dados do próprio usuário (inclui `rowVersion` para salvar). */
export async function minhaConta(ctx: RequestContext, deps: Pick<AcessoDeps, "db">) {
  const id = eu(ctx);
  const u = await deps.db.withTransaction(ctx, (tx) => repo.buscarDetalhe(tx, id));
  if (!u) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
  return u;
}

/**
 * TL-005 "Salvar dados" (LG-21: correção pelo titular). A RLS de `app_user` deixa um CLIENTE ver os
 * usuários do mesmo cliente; por isso o alvo vem do contexto, nunca do navegador.
 */
export async function atualizarMeusDados(
  ctx: RequestContext,
  input: { rowVersion: number; nome: string; telefone?: string | null },
  deps: AcessoDeps,
): Promise<void> {
  const id = eu(ctx);
  const v = atualizarUsuarioSchema.parse({ ...input, id });
  const authUserId = await deps.db.withTransaction(ctx, async (tx) => {
    const atual = await repo.buscarPorId(tx, id);
    if (!atual) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
    const ok = await repo.atualizarDados(
      tx,
      id,
      { nome: v.nome, telefone: v.telefone ?? null },
      v.rowVersion,
    );
    if (!ok) {
      throw new ErroAcesso(
        "ALTERADO_POR_OUTRO",
        "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
      );
    }
    return atual.authUserId;
  });
  const c = await deps.auth.$context;
  await c.internalAdapter.updateUser(authUserId, { name: v.nome });
}

export interface MinhaSessao {
  id: string;
  criadaEm: Date;
  /** `updated_at`: renovada a cada 5 min de uso (LIMITES_SESSAO.renovacaoMs). */
  ultimoUso: Date;
  userAgent: string | null;
  atual: boolean;
}

async function sessoesDe(ctx: RequestContext, deps: Pick<AcessoDeps, "db" | "auth">) {
  const id = eu(ctx);
  const u = await deps.db.withTransaction(ctx, (tx) => repo.buscarPorId(tx, id));
  if (!u) throw new ErroAcesso("NAO_ENCONTRADO", "Usuário não encontrado.");
  const c = await deps.auth.$context;
  return {
    u,
    c,
    sessoes: await c.internalAdapter.listSessions(u.authUserId, { onlyActiveSessions: true }),
  };
}

/** SEG-13 (versão simplificada): só as sessões do próprio usuário. O token nunca sai do servidor. */
export async function minhasSessoes(
  ctx: RequestContext,
  sessaoAtualId: string,
  deps: Pick<AcessoDeps, "db" | "auth">,
): Promise<MinhaSessao[]> {
  const { sessoes } = await sessoesDe(ctx, deps);
  return sessoes
    .map((s) => ({
      id: s.id,
      criadaEm: new Date(s.createdAt),
      ultimoUso: new Date(s.updatedAt),
      userAgent: s.userAgent ?? null,
      atual: s.id === sessaoAtualId,
    }))
    .sort(
      (a, b) => Number(b.atual) - Number(a.atual) || b.ultimoUso.getTime() - a.ultimoUso.getTime(),
    );
}

/**
 * TL-005 "Encerrar" (uma sessão que não é a atual) e "Encerrar todas as outras". Sessão de outro
 * usuário não é encontrada (RN-162). Grava `SESSAO_REVOGADA` (SEG-09).
 */
export async function encerrarMinhasSessoes(
  ctx: RequestContext,
  alvo: { sessaoId: string } | { todasMenos: string },
  origem: Origem,
  deps: Pick<AcessoDeps, "db" | "auth">,
): Promise<number> {
  const { u, c, sessoes } = await sessoesDe(ctx, deps);
  const atual = "todasMenos" in alvo ? alvo.todasMenos : null;
  const remover =
    "sessaoId" in alvo
      ? sessoes.filter((s) => s.id === alvo.sessaoId)
      : sessoes.filter((s) => s.id !== atual);
  if ("sessaoId" in alvo && remover.length === 0) {
    throw new ErroAcesso("NAO_ENCONTRADO", "Sessão não encontrada.");
  }
  for (const s of remover) await c.internalAdapter.deleteSession(s.token);
  if (remover.length > 0) {
    await deps.db.withTransaction(sistema("trilha de acesso"), (tx) =>
      repo.inserirEventoSeguranca(tx, {
        tipo: "SESSAO_REVOGADA",
        userId: u.id,
        emailHash: null,
        ip: origem.ip,
        userAgent: origem.userAgent,
        requestId: ctx.requestId,
      }),
    );
  }
  return remover.length;
}
