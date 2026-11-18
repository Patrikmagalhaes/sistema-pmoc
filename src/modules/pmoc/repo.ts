import "server-only";
import { sql } from "drizzle-orm";
import type { Natureza, Periodicidade } from "@/modules/biblioteca";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `pmoc` que fala com o banco. Sempre dentro de `withTransaction`. */

export type EstadoPmoc = "RASCUNHO" | "EMITIDO" | "ASSINADO_CLIENTE" | "HISTORICO";

/**
 * RN-014: o PMOC vivo do contrato vira `HISTORICO` (de `RASCUNHO`, `EMITIDO` ou `ASSINADO_CLIENTE`;
 * doc 02 §7.3). Já histórico, nada muda. Devolve se mudou.
 */
export async function tornarHistorico(tx: Tx, contratoId: string): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE pmoc SET status = 'HISTORICO', historic_since = now()
    WHERE contract_id = ${contratoId} AND deleted_at IS NULL AND status <> 'HISTORICO'
    RETURNING id`);
  return r.length === 1;
}

// ---------------------------------------------------------------------------------------------
// Criação (FL-08 passos 1–3)
// ---------------------------------------------------------------------------------------------

export interface ContratoParaPmoc {
  id: string;
  localId: string;
  clienteId: string;
  situacao: "A_INICIAR" | "VIGENTE" | "ENCERRADO" | "CANCELADO";
  /** PMOC vivo do contrato (RN-001). */
  pmocId: string | null;
  /** PMOC vivo do contrato anterior (RN-004). */
  anteriorPmocId: string | null;
}

/** Contrato vivo, com a linha travada: duas criações do mesmo PMOC não correm juntas (RN-001). */
export async function travarContrato(tx: Tx, id: string): Promise<ContratoParaPmoc | null> {
  const r = await tx.execute(sql`SELECT k.id, k.site_id AS "localId", s.client_id AS "clienteId",
      k.status AS situacao,
      (SELECT p.id FROM pmoc p WHERE p.contract_id = k.id AND p.deleted_at IS NULL) AS "pmocId",
      (SELECT p.id FROM pmoc p WHERE p.contract_id = k.previous_contract_id AND p.deleted_at IS NULL)
        AS "anteriorPmocId"
    FROM contract k JOIN site s ON s.id = k.site_id
    WHERE k.id = ${id} AND k.deleted_at IS NULL AND s.deleted_at IS NULL
    FOR UPDATE OF k`);
  return (r[0] as ContratoParaPmoc | undefined) ?? null;
}

export async function inserirPmoc(
  tx: Tx,
  contratoId: string,
  copiadoDe: string | null,
): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO pmoc (contract_id, copied_from_pmoc_id)
    VALUES (${contratoId}, ${copiadoDe}) RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** Tipo vivo e `ATIVO` (RN-152) com ao menos um equipamento vivo e `ATIVO` no local (RN-002). */
const tipoPresente = (localId: string) => sql`t.deleted_at IS NULL AND t.status = 'ATIVO'
  AND EXISTS (SELECT 1 FROM equipment e WHERE e.site_id = ${localId} AND e.equipment_type_id = t.id
    AND e.deleted_at IS NULL AND e.status = 'ATIVO')`;

/**
 * RN-002: copia as atividades `ATIVO` da biblioteca, com a periodicidade padrão, para cada tipo presente
 * no local que ainda não tem nenhuma linha no plano (nem removida). Com `tipoId`, só esse tipo
 * (FL-07 passo 5). Devolve quantas atividades entraram.
 */
export async function copiarDaBiblioteca(
  tx: Tx,
  pmocId: string,
  localId: string,
  tipoId: string | null = null,
): Promise<number> {
  const r = await tx.execute(sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id,
      activity_template_id, title, periodicity, nature, unit, requires_photo, display_order)
    SELECT ${pmocId}, a.equipment_type_id, a.id, a.title, a.default_periodicity, a.nature, a.unit,
      a.requires_photo, a.display_order
    FROM activity_template a JOIN equipment_type t ON t.id = a.equipment_type_id
    WHERE a.deleted_at IS NULL AND a.status = 'ATIVO' AND ${tipoPresente(localId)}
      AND (${tipoId}::uuid IS NULL OR t.id = ${tipoId}::uuid)
      AND NOT EXISTS (SELECT 1 FROM pmoc_activity x
        WHERE x.pmoc_id = ${pmocId} AND x.equipment_type_id = t.id)
    RETURNING id`);
  return r.length;
}

/**
 * RN-004: copia do PMOC anterior as atividades não removidas, com a periodicidade dele, dos tipos
 * presentes no local. Tipo ou atividade da biblioteca que ficou `INATIVO` não entra (RN-152). Nunca
 * copia ocorrências, registros, visitas nem assinaturas.
 */
export async function copiarDoAnterior(
  tx: Tx,
  pmocId: string,
  anteriorId: string,
  localId: string,
): Promise<number> {
  const r = await tx.execute(sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id,
      activity_template_id, title, periodicity, nature, unit, requires_photo, display_order)
    SELECT ${pmocId}, pa.equipment_type_id, pa.activity_template_id, pa.title, pa.periodicity,
      pa.nature, pa.unit, pa.requires_photo, pa.display_order
    FROM pmoc_activity pa
    JOIN equipment_type t ON t.id = pa.equipment_type_id
    LEFT JOIN activity_template a ON a.id = pa.activity_template_id
    WHERE pa.pmoc_id = ${anteriorId} AND pa.removed_at IS NULL AND ${tipoPresente(localId)}
      AND (pa.activity_template_id IS NULL OR (a.deleted_at IS NULL AND a.status = 'ATIVO'))
    RETURNING id`);
  return r.length;
}

/** FL-07 passo 5: PMOCs vivos em `RASCUNHO` dos contratos vivos do local. */
export async function rascunhosDoLocal(tx: Tx, localId: string): Promise<string[]> {
  const r = await tx.execute(sql`SELECT p.id FROM pmoc p JOIN contract k ON k.id = p.contract_id
    WHERE k.site_id = ${localId} AND k.deleted_at IS NULL AND p.deleted_at IS NULL
      AND p.status = 'RASCUNHO'
    ORDER BY p.id FOR UPDATE OF p`);
  return (r as unknown as { id: string }[]).map((x) => x.id);
}

// ---------------------------------------------------------------------------------------------
// Leitura (TL-120)
// ---------------------------------------------------------------------------------------------

export interface Pmoc {
  id: string;
  situacao: EstadoPmoc;
  versaoAtual: number | null;
  emitidoAlgumaVez: boolean;
  copiadoDe: string | null;
  contratoId: string;
  situacaoContrato: ContratoParaPmoc["situacao"];
  inicio: string;
  fim: string;
  meses: number;
  th: string | null;
  revisao: string | null;
  localId: string;
  localNome: string;
  localCodigo: string;
  clienteId: string;
  clienteRazaoSocial: string;
}

/** PMOC vivo com contrato, local e cliente vivos (EL-5). `paraEscrita` trava a linha do PMOC. */
export async function buscarPmoc(tx: Tx, id: string, paraEscrita = false): Promise<Pmoc | null> {
  const r = await tx.execute(sql`SELECT p.id, p.status AS situacao,
      p.current_version_number AS "versaoAtual", (p.first_issued_at IS NOT NULL) AS "emitidoAlgumaVez",
      p.copied_from_pmoc_id AS "copiadoDe", k.id AS "contratoId", k.status AS "situacaoContrato",
      to_char(k.start_date, 'YYYY-MM-DD') AS inicio, to_char(k.end_date, 'YYYY-MM-DD') AS fim,
      k.month_count AS meses, k.th_code AS th, k.revision AS revisao,
      s.id AS "localId", s.name AS "localNome", s.code AS "localCodigo",
      c.id AS "clienteId", c.legal_name AS "clienteRazaoSocial"
    FROM pmoc p
    JOIN contract k ON k.id = p.contract_id
    JOIN site s ON s.id = k.site_id
    JOIN client c ON c.id = s.client_id
    WHERE p.id = ${id} AND p.deleted_at IS NULL AND k.deleted_at IS NULL
      AND s.deleted_at IS NULL AND c.deleted_at IS NULL
    ${paraEscrita ? sql`FOR UPDATE OF p` : sql``}`);
  return (r[0] as Pmoc | undefined) ?? null;
}

/** Dados lidos para as pré-condições da emissão (RN-007, RN-008). Sem dados do certificado (RN-121). */
export interface DadosParaEmissao {
  empresaCadastrada: boolean;
  rtCadastrado: boolean;
  certificado: { tipo: "A1" | "A3"; validoAte: Date } | null;
  art: string | null;
  atividadesNoPlano: number;
}

export async function dadosParaEmissao(tx: Tx, p: Pmoc): Promise<DadosParaEmissao> {
  // Certificado vigente: no máximo um (`rt_certificate_current_uq`).
  const r = await tx.execute(sql`SELECT
      EXISTS (SELECT 1 FROM executor_company) AS "empresaCadastrada",
      EXISTS (SELECT 1 FROM technical_responsible) AS "rtCadastrado",
      c.certificate_type AS "certTipo", c.valid_until AS "certAte",
      (SELECT k.art_number FROM contract k WHERE k.id = ${p.contratoId}) AS art,
      (SELECT count(*)::int FROM pmoc_activity pa
        WHERE pa.pmoc_id = ${p.id} AND pa.removed_at IS NULL) AS "atividadesNoPlano"
    FROM (SELECT 1) um
    LEFT JOIN rt_certificate c ON c.is_current AND c.deleted_at IS NULL`);
  const x = r[0] as Omit<DadosParaEmissao, "certificado"> & {
    certTipo: "A1" | "A3" | null;
    certAte: Date | string | null;
  };
  return {
    empresaCadastrada: x.empresaCadastrada,
    rtCadastrado: x.rtCadastrado,
    certificado:
      x.certTipo && x.certAte ? { tipo: x.certTipo, validoAte: new Date(x.certAte) } : null,
    art: x.art,
    atividadesNoPlano: x.atividadesNoPlano,
  };
}

export interface AtividadePlano {
  id: string;
  rowVersion: number;
  tipoId: string;
  modeloId: string | null;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
  ordem: number;
  removida: boolean;
}

/** Plano inteiro do PMOC, inclusive as atividades removidas (RF-10.3). */
export async function listarPlano(tx: Tx, pmocId: string): Promise<AtividadePlano[]> {
  const r = await tx.execute(sql`SELECT pa.id, pa.row_version AS "rowVersion",
      pa.equipment_type_id AS "tipoId", pa.activity_template_id AS "modeloId", pa.title AS titulo,
      pa.periodicity AS periodicidade, pa.nature AS natureza, pa.unit AS unidade,
      pa.requires_photo AS "exigeFoto", pa.display_order AS ordem,
      (pa.removed_at IS NOT NULL) AS removida
    FROM pmoc_activity pa WHERE pa.pmoc_id = ${pmocId}
    ORDER BY pa.display_order, pa.id`);
  return r as unknown as AtividadePlano[];
}

export interface TipoDoPlano {
  id: string;
  nome: string;
  sigla: string;
  equipamentosAtivos: number;
}

/**
 * Tipos do PMOC: os que têm linha no plano e os presentes no local (com equipamento `ATIVO`), por
 * nome. Um tipo presente sem atividade aparece vazio (aba Plano).
 */
export async function tiposDoPlano(
  tx: Tx,
  pmocId: string,
  localId: string,
): Promise<TipoDoPlano[]> {
  const r = await tx.execute(sql`SELECT t.id, t.name AS nome, t.acronym AS sigla,
      (SELECT count(*)::int FROM equipment e WHERE e.site_id = ${localId}
        AND e.equipment_type_id = t.id AND e.deleted_at IS NULL AND e.status = 'ATIVO')
        AS "equipamentosAtivos"
    FROM equipment_type t
    WHERE EXISTS (SELECT 1 FROM pmoc_activity pa WHERE pa.pmoc_id = ${pmocId} AND pa.equipment_type_id = t.id)
       OR (${tipoPresente(localId)})
    ORDER BY lower(t.name), t.id`);
  return r as unknown as TipoDoPlano[];
}

/** RN-023: os equipamentos que entram no cronograma (vivos e `ATIVO`). */
export async function equipamentosAtivos(
  tx: Tx,
  localId: string,
): Promise<{ id: string; tipoId: string }[]> {
  const r = await tx.execute(sql`SELECT e.id, e.equipment_type_id AS "tipoId" FROM equipment e
    WHERE e.site_id = ${localId} AND e.deleted_at IS NULL AND e.status = 'ATIVO'
    ORDER BY e.tag`);
  return r as unknown as { id: string; tipoId: string }[];
}

export interface ModeloDisponivel {
  id: string;
  tipoId: string;
  titulo: string;
  periodicidade: Periodicidade;
}

/**
 * "Incluir atividade" (RF-10.3): atividades `ATIVO` da biblioteca, dos tipos dados, que não têm linha
 * no plano. A que tem linha removida volta pela própria linha (RN-184), não por aqui.
 */
export async function modelosDisponiveis(
  tx: Tx,
  pmocId: string,
  tipoIds: string[],
): Promise<ModeloDisponivel[]> {
  if (tipoIds.length === 0) return [];
  const r = await tx.execute(sql`SELECT a.id, a.equipment_type_id AS "tipoId", a.title AS titulo,
      a.default_periodicity AS periodicidade
    FROM activity_template a
    WHERE a.deleted_at IS NULL AND a.status = 'ATIVO'
      AND a.equipment_type_id IN (${sql.join(
        tipoIds.map((t) => sql`${t}::uuid`),
        sql`, `,
      )})
      AND NOT EXISTS (SELECT 1 FROM pmoc_activity pa WHERE pa.pmoc_id = ${pmocId} AND pa.activity_template_id = a.id)
    ORDER BY a.display_order, lower(a.title), a.id`);
  return r as unknown as ModeloDisponivel[];
}

// ---------------------------------------------------------------------------------------------
// Escrita do plano (RF-10)
// ---------------------------------------------------------------------------------------------

/** Linha do plano com o PMOC dono (para conferir estado e permissão antes de escrever). */
export async function buscarAtividade(
  tx: Tx,
  id: string,
): Promise<(AtividadePlano & { pmocId: string }) | null> {
  const r =
    await tx.execute(sql`SELECT pa.id, pa.pmoc_id AS "pmocId", pa.row_version AS "rowVersion",
      pa.equipment_type_id AS "tipoId", pa.activity_template_id AS "modeloId", pa.title AS titulo,
      pa.periodicity AS periodicidade, pa.nature AS natureza, pa.unit AS unidade,
      pa.requires_photo AS "exigeFoto", pa.display_order AS ordem,
      (pa.removed_at IS NOT NULL) AS removida
    FROM pmoc_activity pa WHERE pa.id = ${id}`);
  return (r[0] as (AtividadePlano & { pmocId: string }) | undefined) ?? null;
}

/** RN-026: a periodicidade vale para todos os equipamentos do tipo. Auditoria por trigger (CA-10.2). */
export async function alterarPeriodicidade(
  tx: Tx,
  id: string,
  periodicidade: Periodicidade,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE pmoc_activity SET periodicity = ${periodicidade}
    WHERE id = ${id} AND row_version = ${rowVersion} AND removed_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** RF-10.3: a linha nunca é apagada (EL-8); só ganha `removed_at`. */
export async function removerAtividade(
  tx: Tx,
  id: string,
  userId: string | null,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE pmoc_activity
    SET removed_at = now(), removed_by_user_id = ${userId}
    WHERE id = ${id} AND row_version = ${rowVersion} AND removed_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** RN-184: a atividade volta ao plano pela mesma linha. */
export async function restaurarAtividade(tx: Tx, id: string, rowVersion: number): Promise<boolean> {
  const r =
    await tx.execute(sql`UPDATE pmoc_activity SET removed_at = NULL, removed_by_user_id = NULL
    WHERE id = ${id} AND row_version = ${rowVersion} AND removed_at IS NOT NULL RETURNING id`);
  return r.length === 1;
}

/** Copia uma atividade `ATIVO` da biblioteca para o plano, com a periodicidade padrão (RN-002). */
export async function incluirModelo(
  tx: Tx,
  pmocId: string,
  modeloId: string,
): Promise<string | null> {
  const r = await tx.execute(sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id,
      activity_template_id, title, periodicity, nature, unit, requires_photo, display_order)
    SELECT ${pmocId}, a.equipment_type_id, a.id, a.title, a.default_periodicity, a.nature, a.unit,
      a.requires_photo, a.display_order
    FROM activity_template a WHERE a.id = ${modeloId} AND a.deleted_at IS NULL AND a.status = 'ATIVO'
    RETURNING id`);
  return (r[0] as { id: string } | undefined)?.id ?? null;
}

export interface NovaAtividade {
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
}

/** Atividade incluída à mão (`activity_template_id = NULL`), no fim da ordem do tipo. */
export async function incluirNova(
  tx: Tx,
  pmocId: string,
  tipoId: string,
  a: NovaAtividade,
): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title,
      periodicity, nature, unit, requires_photo, display_order)
    VALUES (${pmocId}, ${tipoId}, ${a.titulo}, ${a.periodicidade}, ${a.natureza}, ${a.unidade},
      ${a.exigeFoto},
      (SELECT coalesce(max(display_order), 0) + 1 FROM pmoc_activity
        WHERE pmoc_id = ${pmocId} AND equipment_type_id = ${tipoId}))
    RETURNING id`);
  return (r[0] as { id: string }).id;
}
