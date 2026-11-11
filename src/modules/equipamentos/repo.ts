import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import type { SituacaoEquipamento } from "./domain/equipamento";

/** MOD-03: único arquivo do módulo `equipamentos` que fala com o banco. Sempre dentro de `withTransaction`. */

export interface LocalDoEquipamento {
  id: string;
  clienteId: string;
  nome: string;
  codigo: string;
}

/** Local e cliente vivos (EL-5). */
export async function buscarLocal(tx: Tx, id: string): Promise<LocalDoEquipamento | null> {
  const r = await tx.execute(sql`SELECT s.id, s.client_id AS "clienteId", s.name AS nome,
      s.code AS codigo
    FROM site s JOIN client c ON c.id = s.client_id
    WHERE s.id = ${id} AND s.deleted_at IS NULL AND c.deleted_at IS NULL`);
  return (r[0] as LocalDoEquipamento | undefined) ?? null;
}

/** Trava a linha do local: incluir equipamento e excluir o local não correm juntos (EL-7). */
export async function travarLocal(tx: Tx, id: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM site WHERE id = ${id} FOR UPDATE`);
}

/**
 * PMOC do local ainda não histórico (`RASCUNHO`, `EMITIDO`, `ASSINADO_CLIENTE`). Com ele, incluir,
 * inativar ou excluir equipamento mexe no plano e no cronograma (FL-07 passos 4–5; RN-006, RN-067,
 * RN-068), o que chega com a Etapa 4.
 */
export async function temPmocAberto(tx: Tx, localId: string): Promise<boolean> {
  const r = await tx.execute(sql`SELECT EXISTS (SELECT 1 FROM pmoc p
      JOIN contract k ON k.id = p.contract_id
      WHERE k.site_id = ${localId} AND k.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.status <> 'HISTORICO') AS sim`);
  return Boolean((r[0] as { sim: boolean } | undefined)?.sim);
}

export interface OpcaoGrupo {
  id: string;
  nome: string;
}

export interface OpcaoTipo {
  id: string;
  nome: string;
  sigla: string;
  grupos: OpcaoGrupo[];
}

/** FL-07 passo 2: tipos `ATIVO` com os grupos `ATIVO` deles (vivos; EL-5), por nome. */
export async function listarOpcoesDeTipo(tx: Tx): Promise<OpcaoTipo[]> {
  const r = await tx.execute(sql`SELECT t.id, t.name AS nome, t.acronym AS sigla,
      coalesce((SELECT json_agg(json_build_object('id', g.id, 'nome', g.name)
          ORDER BY lower(g.name), g.id)
        FROM equipment_group g
        WHERE g.equipment_type_id = t.id AND g.deleted_at IS NULL AND g.status = 'ATIVO'), '[]')
        AS grupos
    FROM equipment_type t
    WHERE t.deleted_at IS NULL AND t.status = 'ATIVO'
    ORDER BY lower(t.name), t.id`);
  return r as unknown as OpcaoTipo[];
}

/** Grupos vivos do tipo, por nome, com a situação (a edição mostra os ativos e o atual). */
export async function listarGruposDoTipo(
  tx: Tx,
  tipoId: string,
): Promise<(OpcaoGrupo & { ativo: boolean })[]> {
  const r = await tx.execute(sql`SELECT g.id, g.name AS nome, g.status = 'ATIVO' AS ativo
    FROM equipment_group g WHERE g.equipment_type_id = ${tipoId} AND g.deleted_at IS NULL
    ORDER BY lower(g.name), g.id`);
  return r as unknown as (OpcaoGrupo & { ativo: boolean })[];
}

/** RN-041 e FL-07 passo 2: o grupo é do tipo, e ambos estão vivos e `ATIVO`. */
export async function tipoEGrupoAtivos(
  tx: Tx,
  tipoId: string,
  grupoId: string,
): Promise<{ tipo: boolean; grupo: boolean }> {
  const r = await tx.execute(sql`SELECT
      EXISTS (SELECT 1 FROM equipment_type t
        WHERE t.id = ${tipoId} AND t.deleted_at IS NULL AND t.status = 'ATIVO') AS tipo,
      EXISTS (SELECT 1 FROM equipment_group g
        WHERE g.id = ${grupoId} AND g.equipment_type_id = ${tipoId}
          AND g.deleted_at IS NULL AND g.status = 'ATIVO') AS grupo`);
  return r[0] as { tipo: boolean; grupo: boolean };
}

export interface LinhaEquipamento {
  id: string;
  tag: string;
  tipo: string;
  grupo: string;
  ambiente: string;
  marca: string | null;
  modelo: string | null;
  situacao: SituacaoEquipamento;
}

/** TL-110 aba Equipamentos: vivos (EL-5), por TAG; inativos só com o filtro (UL-03). */
export async function listarDoLocal(
  tx: Tx,
  localId: string,
  f: { tipoId: string | null; mostrarInativos: boolean },
): Promise<LinhaEquipamento[]> {
  const r = await tx.execute(sql`SELECT e.id, e.tag, t.name AS tipo, g.name AS grupo,
      e.location_description AS ambiente, e.brand AS marca, e.model AS modelo, e.status AS situacao
    FROM equipment e
    JOIN equipment_type t ON t.id = e.equipment_type_id
    JOIN equipment_group g ON g.id = e.equipment_group_id
    WHERE e.site_id = ${localId} AND e.deleted_at IS NULL
      ${f.tipoId ? sql`AND e.equipment_type_id = ${f.tipoId}` : sql``}
      ${f.mostrarInativos ? sql`` : sql`AND e.status = 'ATIVO'`}
    ORDER BY e.tag`);
  return r as unknown as LinhaEquipamento[];
}

/** Filtro "Tipo" da aba: os tipos dos equipamentos vivos do local, ativos ou não. */
export async function tiposDoLocal(tx: Tx, localId: string): Promise<OpcaoGrupo[]> {
  const r = await tx.execute(sql`SELECT DISTINCT t.id, t.name AS nome, lower(t.name) AS ordem
    FROM equipment e JOIN equipment_type t ON t.id = e.equipment_type_id
    WHERE e.site_id = ${localId} AND e.deleted_at IS NULL
    ORDER BY ordem, t.id`);
  return (r as unknown as (OpcaoGrupo & { ordem: string })[]).map(({ id, nome }) => ({ id, nome }));
}

export interface Equipamento {
  id: string;
  rowVersion: number;
  localId: string;
  localNome: string;
  localCodigo: string;
  clienteId: string;
  tag: string;
  tipoId: string;
  tipoNome: string;
  tipoAtivo: boolean;
  grupoId: string;
  grupoNome: string;
  grupoAtivo: boolean;
  ambiente: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  /** `numeric` chega como texto do driver (ex.: "12000.00"). */
  capacidade: string | null;
  unidade: string | null;
  situacao: SituacaoEquipamento;
  inativadoEm: Date | null;
  /** RN-048, RN-049: alguma ocorrência do equipamento tem registro. */
  temRegistro: boolean;
}

export async function buscarEquipamento(tx: Tx, id: string): Promise<Equipamento | null> {
  const r = await tx.execute(sql`SELECT e.id, e.row_version AS "rowVersion", e.site_id AS "localId",
      s.name AS "localNome", s.code AS "localCodigo", s.client_id AS "clienteId", e.tag,
      e.equipment_type_id AS "tipoId", t.name AS "tipoNome", t.status = 'ATIVO' AS "tipoAtivo",
      e.equipment_group_id AS "grupoId", g.name AS "grupoNome",
      (g.status = 'ATIVO' AND g.deleted_at IS NULL) AS "grupoAtivo",
      e.location_description AS ambiente, e.brand AS marca, e.model AS modelo,
      e.serial_number AS serie, e.capacity AS capacidade, e.capacity_unit AS unidade,
      e.status AS situacao, e.inactivated_at AS "inativadoEm",
      EXISTS (SELECT 1 FROM occurrence o JOIN occurrence_record r ON r.occurrence_id = o.id
        WHERE o.equipment_id = e.id) AS "temRegistro"
    FROM equipment e
    JOIN site s ON s.id = e.site_id
    JOIN client c ON c.id = s.client_id
    JOIN equipment_type t ON t.id = e.equipment_type_id
    JOIN equipment_group g ON g.id = e.equipment_group_id
    WHERE e.id = ${id} AND e.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL`);
  const e = r[0] as
    | (Omit<Equipamento, "inativadoEm"> & { inativadoEm: string | Date | null })
    | undefined;
  if (!e) return null;
  return { ...e, inativadoEm: e.inativadoEm ? new Date(e.inativadoEm) : null };
}

export interface DadosEquipamento {
  grupoId: string;
  ambiente: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  capacidade: number | null;
  unidade: string | null;
}

/** A TAG e o sequencial vêm do trigger `equipment_tag` (RN-046), nunca do navegador. */
export async function inserirEquipamento(
  tx: Tx,
  localId: string,
  tipoId: string,
  d: DadosEquipamento,
): Promise<{ id: string; tag: string }> {
  const r = await tx.execute(sql`INSERT INTO equipment (site_id, equipment_type_id,
      equipment_group_id, location_description, brand, model, serial_number, capacity, capacity_unit)
    VALUES (${localId}, ${tipoId}, ${d.grupoId}, ${d.ambiente}, ${d.marca}, ${d.modelo}, ${d.serie},
      ${d.capacidade}, ${d.unidade})
    RETURNING id, tag`);
  return r[0] as { id: string; tag: string };
}

export async function atualizarEquipamento(
  tx: Tx,
  id: string,
  d: DadosEquipamento,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE equipment SET equipment_group_id = ${d.grupoId},
      location_description = ${d.ambiente}, brand = ${d.marca}, model = ${d.modelo},
      serial_number = ${d.serie}, capacity = ${d.capacidade}, capacity_unit = ${d.unidade}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** `INATIVO` grava `inactivated_at` (base de RN-068); reativar limpa. */
export async function alterarSituacao(
  tx: Tx,
  id: string,
  situacao: SituacaoEquipamento,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE equipment SET status = ${situacao},
      inactivated_at = ${situacao === "INATIVO" ? sql`now()` : sql`NULL`}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** Exclusão lógica (EL-2), com motivo opcional (UF-10). */
export async function excluirEquipamento(
  tx: Tx,
  id: string,
  usuarioId: string | null,
  motivo: string | null,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE equipment
    SET deleted_at = now(), deleted_by_user_id = ${usuarioId}, deletion_reason = ${motivo}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}
