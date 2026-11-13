import "server-only";
import { can } from "@/modules/autorizacao";
import { incluirTipoNoPlanoNaTransacao } from "@/modules/pmoc";
import type { RequestContext } from "@/server/context";
import type { Database, Tx } from "@/server/db";
import { restricaoViolada } from "@/server/db/errors";
import { previaDaTag } from "./domain/equipamento";
import * as repo from "./repo";
import {
  type AtualizarEquipamentoInput,
  alterarSituacaoSchema,
  atualizarEquipamentoSchema,
  type CriarEquipamentoInput,
  criarEquipamentoSchema,
  excluirSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroEquipamentos extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "ALTERADO_POR_OUTRO"
      | "LIMITE_TAG"
      | "TEM_REGISTRO"
      | "ESTADO"
      | "NAO_DISPONIVEL"
      | "VALIDACAO",
    message: string,
    readonly campo?: string,
  ) {
    super(message);
  }
}

export interface EquipamentosDeps {
  db: Database;
}

const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Escrita de equipamento: só ADM (RF-03; RF-09). */
const exigirEscrita = (ctx: RequestContext) => {
  if (!can(ctx, "equipamento.escrever")) {
    throw new ErroEquipamentos("SEM_PERMISSAO", "Sem permissão para alterar equipamentos.");
  }
};

/** Leitura: ADM, ou o CLIENTE dono (RN-162). Para os outros, é como se não existisse (404). */
const podeLer = (ctx: RequestContext, clienteId: string) =>
  can(ctx, "equipamento.ler", { clientId: clienteId });

const naoEncontrado = (o = "Equipamento") =>
  new ErroEquipamentos("NAO_ENCONTRADO", `${o} não encontrado.`);
const conflito = () =>
  new ErroEquipamentos(
    "ALTERADO_POR_OUTRO",
    "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  );
const limiteTag = () =>
  new ErroEquipamentos("LIMITE_TAG", "Limite de TAGs deste tipo no local atingido.", "tipoId"); // E-07.6
const comRegistro = () =>
  new ErroEquipamentos("TEM_REGISTRO", "Equipamento com registro: só pode ser inativado."); // E-07.5

/** Mensagem única para o que depende do recálculo pós-emissão (FL-07 passo 4; RN-065 a RN-068). */
export const SEM_MUDAR_COM_PMOC =
  "Incluir, inativar, reativar ou excluir equipamento em local com PMOC emitido ainda não está disponível.";

/** Escrita com tradução das restrições do banco (a transação já foi desfeita aqui). */
async function escrever<T>(
  ctx: RequestContext,
  deps: EquipamentosDeps,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await deps.db.withTransaction(ctx, fn);
  } catch (e) {
    const r = restricaoViolada(e);
    if (r === "equipment_tag_limit") throw limiteTag();
    if (r === "equipment_has_records") throw comRegistro();
    throw e;
  }
}

/**
 * FL-07 passo 4: com PMOC emitido, ocorrências e visitas mudariam (RN-065, RN-067, RN-068). Com PMOC
 * em `RASCUNHO`, nada é gravado no cronograma: a pré-visualização recalcula na leitura (RN-006, DM-05).
 */
async function exigirSemPmocEmitido(tx: Tx, localId: string) {
  if (await repo.temPmocEmitido(tx, localId)) {
    throw new ErroEquipamentos("NAO_DISPONIVEL", SEM_MUDAR_COM_PMOC);
  }
}

// ---------------------------------------------------------------------------------------------
// Leitura (TL-110 aba Equipamentos; TL-111)
// ---------------------------------------------------------------------------------------------

export interface EquipamentosDoLocal {
  equipamentos: repo.LinhaEquipamento[];
  /** Filtro "Tipo": tipos presentes no local. */
  tipos: repo.OpcaoGrupo[];
}

/** TL-110 aba Equipamentos. `null` = local não encontrado ou de outro cliente (RN-162). */
export async function listarEquipamentosDoLocal(
  ctx: RequestContext,
  localId: string,
  f: { tipoId?: string | null; mostrarInativos?: boolean },
  deps: EquipamentosDeps,
): Promise<EquipamentosDoLocal | null> {
  if (!ehUuid(localId)) return null;
  // Filtro inválido da URL é ignorado.
  const tipoId = f.tipoId && ehUuid(f.tipoId) ? f.tipoId : null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const l = await repo.buscarLocal(tx, localId);
    if (!l || !podeLer(ctx, l.clienteId)) return null;
    const mostrarInativos = Boolean(f.mostrarInativos);
    const equipamentos = await repo.listarDoLocal(tx, localId, { tipoId, mostrarInativos });
    return { equipamentos, tipos: await repo.tiposDoLocal(tx, localId) };
  });
}

export interface NovoEquipamento {
  local: repo.LocalDoEquipamento;
  /** Vazio: "Cadastre um tipo de equipamento antes." (TL-111 estado Vazio). */
  tipos: (repo.OpcaoTipo & { previaTag: string })[];
  /** Com PMOC emitido no local, a inclusão espera o recálculo pós-emissão (RN-067). */
  bloqueio: string | null;
}

/** TL-111 vazio (FL-07 criar). `null` = local não encontrado. Só ADM. */
export async function prepararNovoEquipamento(
  ctx: RequestContext,
  localId: string,
  deps: EquipamentosDeps,
): Promise<NovoEquipamento | null> {
  if (!ehUuid(localId) || !can(ctx, "equipamento.escrever")) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const local = await repo.buscarLocal(tx, localId);
    if (!local) return null;
    const tipos = (await repo.listarOpcoesDeTipo(tx)).map((t) => ({
      ...t,
      previaTag: previaDaTag(local.codigo, t.sigla),
    }));
    const bloqueio = (await repo.temPmocEmitido(tx, localId)) ? SEM_MUDAR_COM_PMOC : null;
    return { local, tipos, bloqueio };
  });
}

export interface EquipamentoCompleto extends repo.Equipamento {
  /** Grupos para a edição: os ativos do tipo e o atual (mesmo inativo). */
  grupos: repo.OpcaoGrupo[];
  /** RN-048: sem registro pode excluir. */
  podeExcluir: boolean;
  /** Com PMOC emitido no local, inativar, reativar e excluir esperam o recálculo (RN-067, RN-068). */
  bloqueio: string | null;
}

/** TL-111 aberto. `null` = não encontrado ou de outro cliente (RN-162). */
export async function obterEquipamento(
  ctx: RequestContext,
  id: string,
  deps: EquipamentosDeps,
): Promise<EquipamentoCompleto | null> {
  if (!ehUuid(id)) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const e = await repo.buscarEquipamento(tx, id);
    if (!e || !podeLer(ctx, e.clienteId)) return null;
    const grupos = (await repo.listarGruposDoTipo(tx, e.tipoId))
      .filter((g) => g.ativo || g.id === e.grupoId)
      .map(({ id, nome }) => ({ id, nome }));
    const bloqueio = (await repo.temPmocEmitido(tx, e.localId)) ? SEM_MUDAR_COM_PMOC : null;
    return { ...e, grupos, podeExcluir: !e.temRegistro, bloqueio };
  });
}

// ---------------------------------------------------------------------------------------------
// Escrita (FL-07)
// ---------------------------------------------------------------------------------------------

/** FL-07 criar: tipo e grupo `ATIVO` (RN-041, RN-045); TAG gerada no banco (RN-046). */
export async function criarEquipamento(
  ctx: RequestContext,
  input: CriarEquipamentoInput,
  deps: EquipamentosDeps,
): Promise<{ id: string; tag: string }> {
  exigirEscrita(ctx);
  const v = criarEquipamentoSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    await repo.travarLocal(tx, v.localId);
    if (!(await repo.buscarLocal(tx, v.localId))) throw naoEncontrado("Local");
    await exigirSemPmocEmitido(tx, v.localId);
    const ok = await repo.tipoEGrupoAtivos(tx, v.tipoId, v.grupoId);
    if (!ok.tipo) throw new ErroEquipamentos("VALIDACAO", "Escolha um tipo ativo.", "tipoId");
    // E-07.2: grupo de outro tipo (a tela não oferece; a FK composta também segura).
    if (!ok.grupo)
      throw new ErroEquipamentos("VALIDACAO", "Escolha um grupo ativo do tipo.", "grupoId");
    const novo = await repo.inserirEquipamento(tx, v.localId, v.tipoId, v);
    await incluirTipoNoPlanoNaTransacao(tx, v.localId, v.tipoId); // FL-07 passo 5
    return novo;
  });
}

/**
 * TL-111 "Salvar". Local, tipo e TAG não mudam (RN-046, RN-049; trigger na 0013). Trocar de grupo só
 * para um grupo `ATIVO` do tipo; manter o atual vale mesmo se ele foi inativado.
 */
export async function atualizarEquipamento(
  ctx: RequestContext,
  input: AtualizarEquipamentoInput,
  deps: EquipamentosDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = atualizarEquipamentoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const e = await repo.buscarEquipamento(tx, v.id);
    if (!e) throw naoEncontrado();
    if (v.grupoId !== e.grupoId && !(await repo.tipoEGrupoAtivos(tx, e.tipoId, v.grupoId)).grupo) {
      throw new ErroEquipamentos("VALIDACAO", "Escolha um grupo ativo do tipo.", "grupoId");
    }
    if (!(await repo.atualizarEquipamento(tx, v.id, v, v.rowVersion))) throw conflito();
  });
}

/**
 * TL-111 "Inativar" (RN-152) e "Reativar" [A VALIDAR] (sem fonte; inferido). Reativar exige tipo e
 * grupo `ATIVO`, como a inclusão (FL-07 passo 2); com PMOC em `RASCUNHO`, reativar um tipo fora do
 * plano o inclui, como a inclusão (FL-07 passo 5). Com PMOC emitido (RN-067, RN-068), espera o
 * recálculo pós-emissão.
 */
export async function alterarSituacaoEquipamento(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; situacao: "ATIVO" | "INATIVO" },
  deps: EquipamentosDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = alterarSituacaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const e = await repo.buscarEquipamento(tx, v.id);
    if (!e) throw naoEncontrado();
    if (e.situacao === v.situacao) {
      throw new ErroEquipamentos(
        "ESTADO",
        v.situacao === "INATIVO"
          ? "O equipamento já está inativo."
          : "O equipamento já está ativo.",
      );
    }
    await exigirSemPmocEmitido(tx, e.localId);
    if (v.situacao === "ATIVO" && !(e.tipoAtivo && e.grupoAtivo)) {
      throw new ErroEquipamentos(
        "ESTADO",
        "Reative antes o tipo e o grupo do equipamento na biblioteca.",
      );
    }
    if (!(await repo.alterarSituacao(tx, v.id, v.situacao, v.rowVersion))) throw conflito();
    if (v.situacao === "ATIVO") await incluirTipoNoPlanoNaTransacao(tx, e.localId, e.tipoId);
  });
}

/** TL-111 "Excluir": só sem ocorrência registrada (RN-048; E-07.5). Motivo opcional (UF-10). */
export async function excluirEquipamento(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; motivo?: string | null },
  deps: EquipamentosDeps,
): Promise<{ localId: string }> {
  exigirEscrita(ctx);
  const v = excluirSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    const e = await repo.buscarEquipamento(tx, v.id);
    if (!e) throw naoEncontrado();
    if (e.temRegistro) throw comRegistro();
    await exigirSemPmocEmitido(tx, e.localId);
    if (!(await repo.excluirEquipamento(tx, v.id, ctx.userId, v.motivo, v.rowVersion))) {
      throw conflito();
    }
    return { localId: e.localId };
  });
}
