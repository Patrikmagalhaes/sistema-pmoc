import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import type { TentativaLogin } from "./domain/bloqueio";
import type { Perfil } from "./domain/sessao";

/** MOD-03: único arquivo do módulo `acesso` que fala com o banco. Sempre dentro de `withTransaction`. */

export interface UsuarioAcesso {
  id: string;
  authUserId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  clientId: string | null;
  situacao: "ATIVO" | "INATIVO";
  rowVersion: number;
}

const colunas = sql`id, auth_user_id AS "authUserId", name AS nome, email::text AS email,
  role AS perfil, client_id AS "clientId", status AS situacao, row_version AS "rowVersion"`;

export async function buscarPorAuthId(tx: Tx, authUserId: string): Promise<UsuarioAcesso | null> {
  const r = await tx.execute(
    sql`SELECT ${colunas} FROM app_user WHERE auth_user_id = ${authUserId}`,
  );
  return (r[0] as UsuarioAcesso | undefined) ?? null;
}

export async function buscarPorId(tx: Tx, id: string): Promise<UsuarioAcesso | null> {
  const r = await tx.execute(sql`SELECT ${colunas} FROM app_user WHERE id = ${id}`);
  return (r[0] as UsuarioAcesso | undefined) ?? null;
}

export async function buscarPorEmail(tx: Tx, email: string): Promise<UsuarioAcesso | null> {
  const r = await tx.execute(sql`SELECT ${colunas} FROM app_user WHERE email = ${email}`);
  return (r[0] as UsuarioAcesso | undefined) ?? null;
}

export async function inserirUsuario(
  tx: Tx,
  u: {
    authUserId: string;
    nome: string;
    email: string;
    perfil: Perfil;
    clientId: string | null;
    telefone: string | null;
  },
): Promise<string> {
  const r =
    await tx.execute(sql`INSERT INTO app_user (name, email, auth_user_id, role, client_id, phone)
    VALUES (${u.nome}, ${u.email}, ${u.authUserId}, ${u.perfil}, ${u.clientId}, ${u.telefone})
    RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** `UPDATE` com `row_version` esperado (CLAUDE.md). Devolve `false` se outra pessoa alterou antes. */
export async function alterarSituacao(
  tx: Tx,
  id: string,
  situacao: "ATIVO" | "INATIVO",
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE app_user
    SET status = ${situacao},
        inactivated_at = ${situacao === "INATIVO" ? sql`now()` : sql`NULL`}
    WHERE id = ${id} AND row_version = ${rowVersion}
    RETURNING id`);
  return r.length === 1;
}

/** SEG-17: ADMs ativos com segundo fator ligado. */
export async function contarAdmsAtivosComSegundoFator(tx: Tx): Promise<number> {
  const r = await tx.execute(sql`SELECT count(*)::int AS n FROM app_user u
    JOIN auth_user a ON a.id = u.auth_user_id
    WHERE u.role = 'ADM' AND u.status = 'ATIVO' AND a.two_factor_enabled`);
  return (r[0] as { n: number }).n;
}

export type TipoEventoSeguranca =
  | "LOGIN_OK"
  | "LOGIN_FALHA"
  | "CONTA_BLOQUEADA"
  | "SENHA_ALTERADA"
  | "SENHA_REDEFINIDA"
  | "MFA_ATIVADO"
  | "MFA_REMOVIDO"
  | "SESSAO_REVOGADA"
  | "ACESSO_NEGADO";

export interface EventoSeguranca {
  tipo: TipoEventoSeguranca;
  userId: string | null;
  emailHash: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** 06 §3.3.3: só inclusão. Nunca grava e-mail em claro, senha nem token (LG-30 a LG-33). */
export async function inserirEventoSeguranca(tx: Tx, e: EventoSeguranca): Promise<void> {
  await tx.execute(sql`INSERT INTO security_event (event_type, user_id, email_hash, ip_address, user_agent, request_id)
    VALUES (${e.tipo}, ${e.userId}, ${e.emailHash}, ${e.ip}::inet, ${e.userAgent}, ${e.requestId})`);
}

/**
 * Limite de uso da aplicação (03 §2.11 `rate_limit_counter`; AF-18). `chave` já vem com o identificador
 * em hash. Janela fixa: ao vencer, recomeça em 1. Devolve `true` se o uso cabe no limite.
 */
export async function consumirLimite(
  tx: Tx,
  chave: string,
  janelaMs: number,
  max: number,
): Promise<boolean> {
  const r = await tx.execute(sql`INSERT INTO rate_limit_counter AS c (key, window_start, count)
    VALUES (${chave}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN c.window_start <= now() - ${janelaMs} * INTERVAL '1 millisecond' THEN 1 ELSE c.count + 1 END,
      window_start = CASE WHEN c.window_start <= now() - ${janelaMs} * INTERVAL '1 millisecond' THEN now() ELSE c.window_start END
    RETURNING count`);
  return (r[0] as { count: number }).count <= max;
}

/** Tentativas de login da conta desde `desde`, em ordem cronológica (SEG-07). */
export async function listarTentativasLogin(
  tx: Tx,
  emailHash: string,
  desde: Date,
): Promise<TentativaLogin[]> {
  const r = await tx.execute(sql`SELECT event_type AS tipo, occurred_at AS em FROM security_event
    WHERE email_hash = ${emailHash} AND event_type IN ('LOGIN_OK', 'LOGIN_FALHA')
      AND occurred_at >= ${desde.toISOString()}::timestamptz
    ORDER BY occurred_at, id`);
  return (r as unknown as { tipo: TentativaLogin["tipo"]; em: string | Date }[]).map((x) => ({
    tipo: x.tipo,
    em: new Date(x.em),
  }));
}

/** Data do último evento do tipo para o usuário (ex.: "ativo desde", TL-004). */
export async function ultimoEvento(
  tx: Tx,
  userId: string,
  tipo: TipoEventoSeguranca,
): Promise<Date | null> {
  const r = await tx.execute(sql`SELECT max(occurred_at) AS em FROM security_event
    WHERE user_id = ${userId} AND event_type = ${tipo}`);
  const em = (r[0] as { em: string | Date | null } | undefined)?.em;
  return em ? new Date(em) : null;
}

export interface FiltroUsuarios {
  perfil: Perfil | null;
  situacao: "ATIVO" | "INATIVO" | null;
  clientId: string | null;
  /** Busca por nome ou e-mail (contém, sem diferenciar maiúsculas). */
  busca: string | null;
  pagina: number;
  porPagina: number;
}

export interface LinhaUsuario extends UsuarioAcesso {
  telefone: string | null;
  inativadoEm: Date | null;
  /** 03 §2.1 regra 7: último `LOGIN_OK` em `security_event`. */
  ultimoLogin: Date | null;
}

/** Escapa `\`, `%` e `_` para o `ILIKE` (busca literal, "contém"). */
const like = (v: string) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** TL-106: lista paginada no servidor (UL-01), ordenada por nome. */
export async function listarUsuarios(
  tx: Tx,
  f: FiltroUsuarios,
): Promise<{ linhas: LinhaUsuario[]; total: number }> {
  const conds = [sql`TRUE`];
  if (f.perfil) conds.push(sql`u.role = ${f.perfil}`);
  if (f.situacao) conds.push(sql`u.status = ${f.situacao}`);
  if (f.clientId) conds.push(sql`u.client_id = ${f.clientId}`);
  if (f.busca)
    conds.push(sql`(u.name ILIKE ${like(f.busca)} OR u.email::text ILIKE ${like(f.busca)})`);
  const where = sql.join(conds, sql` AND `);
  const total = (
    (await tx.execute(sql`SELECT count(*)::int AS n FROM app_user u WHERE ${where}`))[0] as {
      n: number;
    }
  ).n;
  const r = await tx.execute(sql`SELECT u.id, u.auth_user_id AS "authUserId", u.name AS nome,
      u.email::text AS email, u.role AS perfil, u.client_id AS "clientId", u.status AS situacao,
      u.row_version AS "rowVersion", u.phone AS telefone, u.inactivated_at AS "inativadoEm",
      (SELECT max(e.occurred_at) FROM security_event e
        WHERE e.user_id = u.id AND e.event_type = 'LOGIN_OK') AS "ultimoLogin"
    FROM app_user u WHERE ${where}
    ORDER BY u.name, u.id
    LIMIT ${f.porPagina} OFFSET ${(f.pagina - 1) * f.porPagina}`);
  const linhas = (r as unknown as LinhaUsuario[]).map((l) => ({
    ...l,
    inativadoEm: l.inativadoEm ? new Date(l.inativadoEm) : null,
    ultimoLogin: l.ultimoLogin ? new Date(l.ultimoLogin) : null,
  }));
  return { linhas, total };
}

export async function buscarDetalhe(tx: Tx, id: string): Promise<LinhaUsuario | null> {
  const r =
    await tx.execute(sql`SELECT ${colunas}, phone AS telefone, inactivated_at AS "inativadoEm",
      (SELECT max(e.occurred_at) FROM security_event e
        WHERE e.user_id = app_user.id AND e.event_type = 'LOGIN_OK') AS "ultimoLogin"
    FROM app_user WHERE id = ${id}`);
  const l = r[0] as LinhaUsuario | undefined;
  if (!l) return null;
  return {
    ...l,
    inativadoEm: l.inativadoEm ? new Date(l.inativadoEm) : null,
    ultimoLogin: l.ultimoLogin ? new Date(l.ultimoLogin) : null,
  };
}

/** TL-107 "Salvar" na edição: nome e telefone (perfil fixo, RN-179; e-mail só pelo fluxo próprio, SEG-12). */
export async function atualizarDados(
  tx: Tx,
  id: string,
  d: { nome: string; telefone: string | null },
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE app_user SET name = ${d.nome}, phone = ${d.telefone}
    WHERE id = ${id} AND row_version = ${rowVersion} RETURNING id`);
  return r.length === 1;
}
