import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import type { Natureza, Periodicidade } from "./domain/biblioteca";

/** MOD-03: único arquivo do módulo `biblioteca` que fala com o banco. Sempre dentro de `withTransaction`. */

type Situacao = "ATIVO" | "INATIVO";

export interface LinhaTipo {
  id: string;
  nome: string;
  plural: string | null;
  sigla: string;
  situacao: Situacao;
  rowVersion: number;
  grupos: number;
  atividadesAtivas: number;
}

/** TL-104: tipos vivos (EL-5), por nome; inativos só com o filtro (UL-03). */
export async function listarTipos(tx: Tx, mostrarInativos: boolean): Promise<LinhaTipo[]> {
  const r = await tx.execute(sql`SELECT t.id, t.name AS nome, t.plural_name AS plural,
      t.acronym AS sigla, t.status AS situacao, t.row_version AS "rowVersion",
      (SELECT count(*)::int FROM equipment_group g
        WHERE g.equipment_type_id = t.id AND g.deleted_at IS NULL AND g.status = 'ATIVO') AS grupos,
      (SELECT count(*)::int FROM activity_template a
        WHERE a.equipment_type_id = t.id AND a.deleted_at IS NULL AND a.status = 'ATIVO') AS "atividadesAtivas"
    FROM equipment_type t
    WHERE t.deleted_at IS NULL ${mostrarInativos ? sql`` : sql`AND t.status = 'ATIVO'`}
    ORDER BY lower(t.name), t.id`);
  return r as unknown as LinhaTipo[];
}

export interface Tipo {
  id: string;
  nome: string;
  plural: string | null;
  sigla: string;
  situacao: Situacao;
  rowVersion: number;
  /** Uso do tipo (EL-4): atividade em PMOC ou equipamento, incluindo excluídos. */
  emUso: boolean;
  /** E-03.4: há equipamento do tipo, a sigla não muda. */
  siglaTravada: boolean;
  /** EL-7: grupos ou atividades vivos bloqueiam a exclusão do tipo. */
  filhosVivos: boolean;
}

export async function buscarTipo(tx: Tx, id: string): Promise<Tipo | null> {
  const r = await tx.execute(sql`SELECT t.id, t.name AS nome, t.plural_name AS plural,
      t.acronym AS sigla, t.status AS situacao, t.row_version AS "rowVersion",
      EXISTS (SELECT 1 FROM equipment e WHERE e.equipment_type_id = t.id) AS "siglaTravada",
      (EXISTS (SELECT 1 FROM equipment e WHERE e.equipment_type_id = t.id)
        OR EXISTS (SELECT 1 FROM pmoc_activity p WHERE p.equipment_type_id = t.id)) AS "emUso",
      (EXISTS (SELECT 1 FROM equipment_group g WHERE g.equipment_type_id = t.id AND g.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM activity_template a
          WHERE a.equipment_type_id = t.id AND a.deleted_at IS NULL)) AS "filhosVivos"
    FROM equipment_type t WHERE t.id = ${id} AND t.deleted_at IS NULL`);
  return (r[0] as Tipo | undefined) ?? null;
}

export interface Grupo {
  id: string;
  nome: string;
  situacao: Situacao;
  rowVersion: number;
  /** Uso do grupo (EL-4): equipamento, incluindo excluídos. */
  emUso: boolean;
}

export async function listarGrupos(tx: Tx, tipoId: string): Promise<Grupo[]> {
  const r = await tx.execute(sql`SELECT g.id, g.name AS nome, g.status AS situacao,
      g.row_version AS "rowVersion",
      EXISTS (SELECT 1 FROM equipment e WHERE e.equipment_group_id = g.id) AS "emUso"
    FROM equipment_group g
    WHERE g.equipment_type_id = ${tipoId} AND g.deleted_at IS NULL
    ORDER BY lower(g.name), g.id`);
  return r as unknown as Grupo[];
}

export interface Atividade {
  id: string;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
  ordem: number;
  situacao: Situacao;
  rowVersion: number;
  /** Uso da atividade (EL-4): está no plano de algum PMOC. */
  emUso: boolean;
}

const colunasAtividade = sql`a.id, a.title AS titulo, a.default_periodicity AS periodicidade,
  a.nature AS natureza, a.unit AS unidade, a.requires_photo AS "exigeFoto", a.display_order AS ordem,
  a.status AS situacao, a.row_version AS "rowVersion",
  EXISTS (SELECT 1 FROM pmoc_activity p WHERE p.activity_template_id = a.id) AS "emUso"`;

export async function listarAtividades(tx: Tx, tipoId: string): Promise<Atividade[]> {
  const r = await tx.execute(sql`SELECT ${colunasAtividade} FROM activity_template a
    WHERE a.equipment_type_id = ${tipoId} AND a.deleted_at IS NULL`);
  return r as unknown as Atividade[];
}

export async function buscarAtividade(
  tx: Tx,
  id: string,
): Promise<(Atividade & { tipoId: string }) | null> {
  const r = await tx.execute(sql`SELECT ${colunasAtividade}, a.equipment_type_id AS "tipoId"
    FROM activity_template a WHERE a.id = ${id} AND a.deleted_at IS NULL`);
  return (r[0] as (Atividade & { tipoId: string }) | undefined) ?? null;
}

export async function buscarGrupo(
  tx: Tx,
  id: string,
): Promise<(Grupo & { tipoId: string }) | null> {
  const r = await tx.execute(sql`SELECT g.id, g.name AS nome, g.status AS situacao,
      g.row_version AS "rowVersion", g.equipment_type_id AS "tipoId",
      EXISTS (SELECT 1 FROM equipment e WHERE e.equipment_group_id = g.id) AS "emUso"
    FROM equipment_group g WHERE g.id = ${id} AND g.deleted_at IS NULL`);
  return (r[0] as (Grupo & { tipoId: string }) | undefined) ?? null;
}

// ---- escrita ----------------------------------------------------------------------------------

/**
 * Trava a linha do tipo até o fim da transação: duas pessoas inativando grupos ao mesmo tempo não
 * deixam, juntas, o tipo sem grupo ativo (RN-040).
 */
export async function travarTipo(tx: Tx, id: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM equipment_type WHERE id = ${id} FOR UPDATE`);
}

export async function inserirTipo(
  tx: Tx,
  t: { nome: string; plural: string | null; sigla: string },
): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO equipment_type (name, plural_name, acronym)
    VALUES (${t.nome}, ${t.plural}, ${t.sigla}) RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** `UPDATE` com `row_version` esperado. Devolve `false` se outra pessoa alterou antes (UF-07). */
export async function atualizarTipo(
  tx: Tx,
  id: string,
  t: { nome: string; plural: string | null; sigla: string },
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE equipment_type
    SET name = ${t.nome}, plural_name = ${t.plural}, acronym = ${t.sigla}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

type Tabela = "equipment_type" | "equipment_group" | "activity_template";

/** Inativar ou reativar (RN-044, RN-152) com `row_version`. */
export async function alterarSituacao(
  tx: Tx,
  tabela: Tabela,
  id: string,
  situacao: Situacao,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE ${sql.identifier(tabela)} SET status = ${situacao}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** Exclusão lógica (EL-2): nunca `DELETE`. */
export async function excluirLogico(
  tx: Tx,
  tabela: Tabela,
  id: string,
  usuarioId: string | null,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE ${sql.identifier(tabela)}
    SET deleted_at = now(), deleted_by_user_id = ${usuarioId}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

export async function inserirGrupo(tx: Tx, tipoId: string, nome: string): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO equipment_group (equipment_type_id, name)
    VALUES (${tipoId}, ${nome}) RETURNING id`);
  return (r[0] as { id: string }).id;
}

export async function renomearGrupo(
  tx: Tx,
  id: string,
  nome: string,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE equipment_group SET name = ${nome}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

export interface DadosAtividade {
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
  ordem: number;
}

export async function inserirAtividade(tx: Tx, tipoId: string, a: DadosAtividade): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO activity_template (equipment_type_id, title,
      default_periodicity, nature, unit, requires_photo, display_order)
    VALUES (${tipoId}, ${a.titulo}, ${a.periodicidade}, ${a.natureza}, ${a.unidade}, ${a.exigeFoto},
      ${a.ordem}) RETURNING id`);
  return (r[0] as { id: string }).id;
}

export async function atualizarAtividade(
  tx: Tx,
  id: string,
  a: DadosAtividade,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE activity_template SET title = ${a.titulo},
      default_periodicity = ${a.periodicidade}, nature = ${a.natureza}, unit = ${a.unidade},
      requires_photo = ${a.exigeFoto}, display_order = ${a.ordem}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}
