import "server-only";
import { sql } from "drizzle-orm";
import type { Natureza, Periodicidade } from "@/modules/biblioteca";
import type { OcorrenciaPrevista } from "@/modules/cronograma";
import type { Tx } from "@/server/db";
import type { DadosDoDocumento, SnapshotPmocV1 } from "./domain/snapshot";

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
  rowVersion: number;
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

/**
 * PMOC vivo com contrato, local e cliente vivos (EL-5). `paraEscrita` trava a linha do PMOC; com
 * `"SEM_ESPERAR"`, se outra transação já a travou, o banco recusa na hora (`55P03`, E-08.8).
 */
export async function buscarPmoc(
  tx: Tx,
  id: string,
  paraEscrita: boolean | "SEM_ESPERAR" = false,
): Promise<Pmoc | null> {
  const r = await tx.execute(sql`SELECT p.id, p.row_version AS "rowVersion", p.status AS situacao,
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
    ${
      paraEscrita === "SEM_ESPERAR"
        ? sql`FOR UPDATE OF p NOWAIT`
        : paraEscrita
          ? sql`FOR UPDATE OF p`
          : sql``
    }`);
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

// ---------------------------------------------------------------------------------------------
// Emissão (RN-009; FL-08 passo 11)
// ---------------------------------------------------------------------------------------------

/** Bloco [E] com os nomes de `src/lib/endereco` (03 §1). */
const endereco = sql.raw(`json_build_object('logradouro', address_street,
  'numero', address_number, 'semNumero', address_without_number,
  'complemento', address_complement, 'bairro', address_neighborhood,
  'cidade', address_city, 'uf', address_state, 'cep', address_zip)`);

/**
 * Tudo o que o retrato da emissão precisa (03 `pmoc_version.snapshot`), menos os textos. Lido na
 * transação da emissão, com o PMOC já travado. Sem empresa ou RT, devolve `null` (a verificação das
 * pré-condições já recusou antes).
 */
export async function dadosDoDocumento(
  tx: Tx,
  p: Pmoc,
): Promise<Omit<DadosDoDocumento, "textos"> | null> {
  const um = async <T>(q: ReturnType<typeof sql>) => (await tx.execute(q))[0] as T | undefined;
  const empresa = await um<DadosDoDocumento["empresa"]>(sql`SELECT legal_name AS "razaoSocial",
      cnpj, phone AS telefone, crea_registration AS crea, logo_file_id AS "logoArquivoId",
      ${endereco} AS endereco
    FROM executor_company`);
  const rt = await um<DadosDoDocumento["rt"]>(sql`SELECT full_name AS nome,
      professional_title AS titulo, registration_number AS registro, phone AS telefone,
      email::text AS email, ${endereco} AS endereco
    FROM technical_responsible`);
  const cliente = await um<DadosDoDocumento["cliente"]>(sql`SELECT legal_name AS "razaoSocial",
      trade_name AS "nomeFantasia", cnpj, phone_1 AS telefone1, phone_2 AS telefone2,
      ${endereco} AS endereco
    FROM client WHERE id = ${p.clienteId}`);
  const local = await um<DadosDoDocumento["local"]>(sql`SELECT name AS nome, code AS codigo,
      phone AS telefone, ${endereco} AS endereco
    FROM site WHERE id = ${p.localId}`);
  const contrato = await um<DadosDoDocumento["contrato"]>(sql`SELECT
      to_char(start_date, 'YYYY-MM-DD') AS inicio, to_char(end_date, 'YYYY-MM-DD') AS fim,
      month_count AS meses, art_number AS art, th_code AS th, revision AS revisao
    FROM contract WHERE id = ${p.contratoId}`);
  if (!empresa || !rt || !cliente || !local || !contrato) return null;
  const tipos = (await tx.execute(sql`SELECT t.id, t.name AS nome, t.plural_name AS "nomePlural",
      t.acronym AS sigla
    FROM equipment_type t
    WHERE EXISTS (SELECT 1 FROM equipment e WHERE e.site_id = ${p.localId}
      AND e.equipment_type_id = t.id AND e.deleted_at IS NULL AND e.status = 'ATIVO')
    ORDER BY t.id`)) as unknown as DadosDoDocumento["tipos"];
  const equipamentos = (await tx.execute(sql`SELECT e.id, e.tag, e.equipment_type_id AS "tipoId",
      g.name AS grupo, e.location_description AS localizacao, e.brand AS marca, e.model AS modelo,
      e.serial_number AS serie, e.capacity::text AS capacidade,
      e.capacity_unit AS "unidadeCapacidade", e.status AS situacao
    FROM equipment e JOIN equipment_group g ON g.id = e.equipment_group_id
    WHERE e.site_id = ${p.localId} AND e.deleted_at IS NULL
    ORDER BY e.tag`)) as unknown as DadosDoDocumento["equipamentos"];
  const atividades = (await listarPlano(tx, p.id)).map((a) => ({
    id: a.id,
    tipoId: a.tipoId,
    titulo: a.titulo,
    periodicidade: a.periodicidade,
    natureza: a.natureza,
    unidade: a.unidade,
    ordem: a.ordem,
    removida: a.removida,
  }));
  return { empresa, rt, cliente, local, contrato, tipos, atividades, equipamentos };
}

/** Versão mais nova do texto padrão (03 `standard_text`, tabela [I]: cada mudança é versão nova). */
export async function textoPadrao(
  tx: Tx,
  codigo: "RECOMENDACOES_PMOC",
): Promise<{ versao: number; corpo: string } | null> {
  const r = await tx.execute(sql`SELECT version AS versao, body AS corpo FROM standard_text
    WHERE code = ${codigo} ORDER BY version DESC LIMIT 1`);
  return (r[0] as { versao: number; corpo: string } | undefined) ?? null;
}

export interface NovaVersao {
  pmocId: string;
  numero: number;
  motivo: string | null;
  snapshot: SnapshotPmocV1;
  arquivoId: string;
  sha256: string;
  certificadoId: string;
  emitidaEm: Date;
  emitidaPor: string;
  versaoRenderizador: string;
  codigoVerificacao: string;
}

export type EstadoVersao = "AGUARDANDO_ASSINATURA" | "ASSINADO_CLIENTE" | "SUBSTITUIDA";

/** Linha da aba "Versões e assinaturas" (TL-120). */
export interface VersaoDoPmoc {
  id: string;
  numero: number;
  situacao: EstadoVersao;
  atual: boolean;
  emitidaEm: Date;
  emitidaPor: string | null;
  motivo: string | null;
  pdfArquivoId: string;
  assinadaPor: string | null;
  assinadaEm: Date | null;
}

/** Versões do PMOC, da mais nova para a mais antiga (RN-016, RN-126: todas continuam disponíveis). */
export async function listarVersoes(tx: Tx, pmocId: string): Promise<VersaoDoPmoc[]> {
  const r = await tx.execute(sql`SELECT v.id, v.version_number AS numero, v.status AS situacao,
      v.is_current AS atual, v.issued_at AS "emitidaEm", u.name AS "emitidaPor",
      v.issue_reason AS motivo, v.pdf_file_id AS "pdfArquivoId",
      s.signer_name AS "assinadaPor", s.signed_at AS "assinadaEm"
    FROM pmoc_version v
    LEFT JOIN app_user u ON u.id = v.issued_by_user_id
    LEFT JOIN document_signature s ON s.pmoc_version_id = v.id
    WHERE v.pmoc_id = ${pmocId}
    ORDER BY v.version_number DESC`);
  return (r as unknown as VersaoDoPmoc[]).map((v) => ({
    ...v,
    emitidaEm: new Date(v.emitidaEm),
    assinadaEm: v.assinadaEm && new Date(v.assinadaEm),
  }));
}

/** VP-2: a versão nova é a atual e aguarda a assinatura do cliente. `client_id` vem por trigger. */
export async function inserirVersao(tx: Tx, v: NovaVersao): Promise<string> {
  const em = v.emitidaEm.toISOString();
  const r = await tx.execute(sql`INSERT INTO pmoc_version (pmoc_id, version_number, status,
      is_current, issue_reason, snapshot, snapshot_schema_version, pdf_file_id, pdf_sha256,
      rt_signature_method, rt_certificate_id, rt_signed_at, issued_at, issued_by_user_id,
      renderer_version, verification_code, created_by_user_id)
    VALUES (${v.pmocId}, ${v.numero}, 'AGUARDANDO_ASSINATURA', true, ${v.motivo},
      ${JSON.stringify(v.snapshot)}::jsonb, ${v.snapshot.schema}, ${v.arquivoId}, ${v.sha256},
      'AUTOMATICA_A1', ${v.certificadoId}, ${em}, ${em}, ${v.emitidaPor},
      ${v.versaoRenderizador}, ${v.codigoVerificacao}, ${v.emitidaPor})
    RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** RN-009 passo 3: `RASCUNHO` → `EMITIDO`, marcando a 1ª emissão (congela o cronograma, HM-1). */
export async function marcarEmitido(
  tx: Tx,
  pmocId: string,
  versao: number,
  emitidoEm: Date,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE pmoc SET status = 'EMITIDO',
      current_version_number = ${versao},
      first_issued_at = coalesce(first_issued_at, ${emitidoEm.toISOString()}::timestamptz)
    WHERE id = ${pmocId} AND status = 'RASCUNHO' RETURNING id`);
  return r.length === 1;
}

/**
 * RN-009 passo 4 (HM-1, DM-04): uma linha `PREVISTA` por célula prevista do `buildSchedule`. Em lote,
 * num só comando, para o PMOC de 200 equipamentos (S-01). Criadas pelo sistema (DM-18).
 */
export async function inserirOcorrencias(
  tx: Tx,
  pmocId: string,
  ocorrencias: readonly OcorrenciaPrevista[],
): Promise<number> {
  if (ocorrencias.length === 0) return 0;
  const linhas = ocorrencias.map((o) => ({
    a: o.atividadeId,
    e: o.equipamentoId,
    m: o.indice,
    r: o.referencia,
    v: o.vencimento,
  }));
  const r = await tx.execute(sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id,
      month_index, reference_month, due_date, status)
    SELECT ${pmocId}, x.a, x.e, x.m, x.r, x.v, 'PREVISTA'
    FROM jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb)
      AS x(a uuid, e uuid, m smallint, r date, v date)
    RETURNING id`);
  return r.length;
}

/**
 * RN-060 (RN-009 passo 5): para cada mês com ocorrência `PREVISTA`, uma visita `A_AGENDAR` com o local
 * e todas as ocorrências do mês. Criadas pelo sistema (DM-18). Devolve quantas visitas.
 */
export async function criarVisitasDoCronograma(
  tx: Tx,
  pmocId: string,
  localId: string,
): Promise<number> {
  const visitas = await tx.execute(sql`INSERT INTO visit (pmoc_id, site_id, reference_month_index,
      reference_month, origin)
    SELECT ${pmocId}, ${localId}, o.month_index, o.reference_month, 'AUTOMATICA'
    FROM occurrence o WHERE o.pmoc_id = ${pmocId} AND o.status = 'PREVISTA'
    GROUP BY o.month_index, o.reference_month
    ORDER BY o.month_index
    RETURNING id`);
  await tx.execute(sql`INSERT INTO visit_occurrence (visit_id, occurrence_id)
    SELECT v.id, o.id FROM visit v
    JOIN occurrence o ON o.pmoc_id = v.pmoc_id AND o.month_index = v.reference_month_index
    WHERE v.pmoc_id = ${pmocId} AND v.origin = 'AUTOMATICA' AND v.deleted_at IS NULL
      AND o.status = 'PREVISTA'`);
  return visitas.length;
}

/** RN-101 (RN-009 passo 6): "PMOC aguardando assinatura" para cada usuário `ATIVO` do cliente. */
export async function notificarClientes(tx: Tx, p: Pmoc, versao: number): Promise<number> {
  const corpo = `O PMOC de ${p.localNome} (versão ${versao}) está aguardando a sua assinatura.`;
  const r =
    await tx.execute(sql`INSERT INTO notification (recipient_user_id, event_type, title, body,
      entity_type, entity_id, payload)
    SELECT u.id, 'PMOC_AGUARDANDO_ASSINATURA', 'PMOC aguardando assinatura', ${corpo},
      'pmoc', ${p.id}, ${JSON.stringify({ versao })}::jsonb
    FROM app_user u
    WHERE u.role = 'CLIENTE' AND u.client_id = ${p.clienteId} AND u.status = 'ATIVO'`);
  // Sem RETURNING: a RLS de `notification` só deixa o destinatário ler a linha (05 §4.2), e o
  // RETURNING passaria pela política de leitura. O total vem do próprio comando.
  return (r as unknown as { count: number }).count;
}
