import "server-only";
import { normalizarCnpj } from "@/lib/cnpj";
import { can } from "@/modules/autorizacao";
import { tornarHistoricoNaTransacao } from "@/modules/pmoc";
import type { RequestContext } from "@/server/context";
import type { Database, Tx } from "@/server/db";
import { restricaoViolada } from "@/server/db/errors";
import {
  diaSeguinte,
  estadoPorDatas,
  hojeEmSaoPaulo,
  podeCancelar,
  podeRenovar,
} from "./domain/contrato";
import * as repo from "./repo";
import {
  type AtualizarClienteInput,
  type AtualizarContratoInput,
  type AtualizarLocalInput,
  atualizarClienteSchema,
  atualizarContratoSchema,
  atualizarLocalSchema,
  type CancelarContratoInput,
  type CriarClienteInput,
  type CriarContratoInput,
  type CriarLocalInput,
  cancelarContratoSchema,
  criarClienteSchema,
  criarContratoSchema,
  criarLocalSchema,
  excluirSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroClientes extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "ALTERADO_POR_OUTRO"
      | "CNPJ_EM_USO"
      | "TEM_FILHOS"
      | "SOBREPOSICAO"
      | "DATAS_TRAVADAS"
      | "ESTADO"
      | "NAO_DISPONIVEL"
      | "VALIDACAO",
    message: string,
    readonly campo?: string,
    /** E-04.2: id do cliente que já tem o CNPJ (a tela mostra o link). */
    readonly existenteId?: string,
  ) {
    super(message);
  }
}

export interface ClientesDeps {
  db: Database;
}

const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Escrita de cadastro (clientes, locais): só ADM (RF-03). */
const exigirEscrita = (ctx: RequestContext) => {
  if (!can(ctx, "cadastro.escrever")) {
    throw new ErroClientes("SEM_PERMISSAO", "Sem permissão para alterar o cadastro.");
  }
};

/**
 * Leitura de um cliente: ADM, ou o CLIENTE dono (RN-162). Para os outros, é como se não existisse
 * (devolve `null` → 404), sem revelar que existe.
 */
const podeLer = (ctx: RequestContext, clienteId: string) =>
  can(ctx, "cadastro.ler", { clientId: clienteId });

const naoEncontrado = (o = "Cliente") => new ErroClientes("NAO_ENCONTRADO", `${o} não encontrado.`);
const conflito = () =>
  new ErroClientes(
    "ALTERADO_POR_OUTRO",
    "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  );

/** Escrita com tradução das restrições do banco (a transação já foi desfeita aqui). */
async function escrever<T>(
  ctx: RequestContext,
  deps: ClientesDeps,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await deps.db.withTransaction(ctx, fn);
  } catch (e) {
    // Corrida entre a checagem de CNPJ e o INSERT: o índice único decide (RF-05.4).
    const r = restricaoViolada(e);
    if (r === "client_cnpj_live_uq") {
      throw new ErroClientes("CNPJ_EM_USO", "Já existe cliente com este CNPJ.", "cnpj");
    }
    // O `EXCLUDE` do contrato e os triggers da 0012 seguram quem passar pela checagem do serviço.
    if (r?.startsWith("contract_") && r.endsWith("_excl")) {
      throw new ErroClientes("SOBREPOSICAO", "Período sobrepõe outro contrato do local.", "fim");
    }
    if (r === "contract_dates_locked") throw datasTravadas();
    if (r === "contract_cancelled_final") throw contratoCancelado();
    throw e;
  }
}

/** Lista para seleção (TL-106 filtro "Cliente"; TL-107 campo "Cliente"). */
export async function listarClientesParaSelecao(
  ctx: RequestContext,
  deps: ClientesDeps,
): Promise<repo.ClienteResumo[]> {
  if (!can(ctx, "cadastro.ler", { clientId: ctx.clientId })) return [];
  return deps.db.withTransaction(ctx, (tx) => repo.listarResumo(tx));
}

// ---------------------------------------------------------------------------------------------
// Cliente (RF-05; TL-108, TL-109)
// ---------------------------------------------------------------------------------------------

/** UL-01: 25 por página (decisão C2). */
export const CLIENTES_POR_PAGINA = 25;

/** TL-108 (só ADM). Filtros inválidos da URL são ignorados. */
export async function listarClientes(
  ctx: RequestContext,
  f: { busca?: string | null; pagina?: number | string | null },
  deps: ClientesDeps,
) {
  exigirEscrita(ctx);
  const busca = f.busca?.trim() ? f.busca.trim().slice(0, 100) : null;
  const cnpjBusca = busca ? normalizarCnpj(busca) : null;
  const pagina = Math.max(1, Math.trunc(Number(f.pagina) || 1));
  const r = await deps.db.withTransaction(ctx, (tx) =>
    repo.listarClientes(tx, {
      busca,
      cnpjBusca: cnpjBusca && cnpjBusca.length >= 2 ? cnpjBusca : null,
      pagina,
      porPagina: CLIENTES_POR_PAGINA,
    }),
  );
  return { ...r, pagina, porPagina: CLIENTES_POR_PAGINA };
}

export interface ClienteCompleto {
  cliente: repo.Cliente;
  locais: repo.LinhaLocal[];
}

/** TL-109 aberto. `null` = não encontrado ou de outro cliente (RN-162). */
export async function obterCliente(
  ctx: RequestContext,
  id: string,
  deps: ClientesDeps,
): Promise<ClienteCompleto | null> {
  if (!ehUuid(id) || !podeLer(ctx, id)) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const cliente = await repo.buscarCliente(tx, id);
    if (!cliente) return null;
    return { cliente, locais: await repo.listarLocais(tx, id) };
  });
}

/** E-04.2: CNPJ já usado por outro cliente vivo. */
async function conferirCnpj(tx: Tx, cnpj: string, proprioId: string | null) {
  const outro = await repo.buscarPorCnpj(tx, cnpj);
  if (outro && outro.id !== proprioId) {
    throw new ErroClientes(
      "CNPJ_EM_USO",
      `Já existe cliente com este CNPJ: ${outro.razaoSocial}.`,
      "cnpj",
      outro.id,
    );
  }
}

/** FL-04 passo 2. */
export async function criarCliente(
  ctx: RequestContext,
  input: CriarClienteInput,
  deps: ClientesDeps,
): Promise<{ id: string }> {
  exigirEscrita(ctx);
  const v = criarClienteSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    await conferirCnpj(tx, v.cnpj, null);
    return { id: await repo.inserirCliente(tx, v) };
  });
}

/** TL-109 "Salvar". */
export async function atualizarCliente(
  ctx: RequestContext,
  input: AtualizarClienteInput,
  deps: ClientesDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = atualizarClienteSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarCliente(tx, v.id))) throw naoEncontrado();
    await conferirCnpj(tx, v.cnpj, v.id);
    if (!(await repo.atualizarCliente(tx, v.id, v, v.rowVersion))) throw conflito();
  });
}

/** TL-109 "Excluir cliente": só sem local vivo (E-04.7; EL-7). Motivo opcional (UF-10). */
export async function excluirCliente(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; motivo?: string | null },
  deps: ClientesDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = excluirSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    await repo.travarCliente(tx, v.id);
    const c = await repo.buscarCliente(tx, v.id);
    if (!c) throw naoEncontrado();
    if (c.temLocalVivo) {
      throw new ErroClientes("TEM_FILHOS", "Exclua antes os locais deste cliente.");
    }
    if (!(await repo.excluirLogico(tx, "client", v.id, ctx.userId, v.motivo, v.rowVersion))) {
      throw conflito();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Local (RF-06; TL-110)
// ---------------------------------------------------------------------------------------------

/** TL-110 aberto. `null` = não encontrado ou de outro cliente (RN-162). */
export async function obterLocal(
  ctx: RequestContext,
  id: string,
  deps: ClientesDeps,
): Promise<repo.Local | null> {
  if (!ehUuid(id)) return null;
  const l = await deps.db.withTransaction(ctx, (tx) => repo.buscarLocal(tx, id));
  return l && podeLer(ctx, l.clienteId) ? l : null;
}

/** FL-04 passo 3: grava e devolve o código gerado (DM-19), que a tela mostra somente leitura. */
export async function criarLocal(
  ctx: RequestContext,
  input: CriarLocalInput,
  deps: ClientesDeps,
): Promise<{ id: string; codigo: string }> {
  exigirEscrita(ctx);
  const v = criarLocalSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    await repo.travarCliente(tx, v.clienteId);
    if (!(await repo.buscarCliente(tx, v.clienteId))) throw naoEncontrado();
    return repo.inserirLocal(tx, v.clienteId, v);
  });
}

/** TL-110 "Salvar". O código não muda (RN-047; trigger na 0011). */
export async function atualizarLocal(
  ctx: RequestContext,
  input: AtualizarLocalInput,
  deps: ClientesDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = atualizarLocalSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarLocal(tx, v.id))) throw naoEncontrado("Local");
    if (!(await repo.atualizarLocal(tx, v.id, v, v.rowVersion))) throw conflito();
  });
}

/** TL-110 "Excluir local": só sem contrato e sem equipamento vivos (E-04.7; EL-7). */
export async function excluirLocal(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; motivo?: string | null },
  deps: ClientesDeps,
): Promise<{ clienteId: string }> {
  exigirEscrita(ctx);
  const v = excluirSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    // Incluir contrato ou equipamento trava a mesma linha: a checagem abaixo não fica velha.
    await repo.travarLocal(tx, v.id);
    const l = await repo.buscarLocal(tx, v.id);
    if (!l) throw naoEncontrado("Local");
    if (l.temContratoVivo || l.temEquipamentoVivo) {
      throw new ErroClientes(
        "TEM_FILHOS",
        "Exclua antes os contratos e os equipamentos deste local.",
      );
    }
    if (!(await repo.excluirLogico(tx, "site", v.id, ctx.userId, v.motivo, v.rowVersion))) {
      throw conflito();
    }
    return { clienteId: l.clienteId };
  });
}

// ---------------------------------------------------------------------------------------------
// Contrato (RF-07, RF-15; FL-06; TL-112)
// ---------------------------------------------------------------------------------------------

const datasTravadas = () =>
  new ErroClientes(
    "DATAS_TRAVADAS",
    "Datas travadas após a emissão. Para encerrar antes, cancele o contrato.", // E-06.4
    "inicio",
  );
const contratoCancelado = () =>
  new ErroClientes("ESTADO", "Contrato cancelado não pode ser alterado."); // E-06.7

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** E-06.2 / RN-143 / CA-07.1, com as datas do contrato que conflita. */
async function conferirSobreposicao(
  tx: Tx,
  localId: string,
  inicio: string,
  fim: string,
  proprioId: string | null,
) {
  const o = await repo.contratoSobreposto(tx, localId, inicio, fim, proprioId);
  if (o) {
    throw new ErroClientes(
      "SOBREPOSICAO",
      `Período sobrepõe o contrato ${fmt(o.inicio)}–${fmt(o.fim)}.`,
      "fim",
    );
  }
}

export interface ContratoCompleto extends repo.Contrato {
  podeCancelar: boolean;
  podeRenovar: boolean;
  podeConfirmarRenovacao: boolean;
  /** TL-112 "Excluir": sem PMOC (o rascunho de PMOC chega na Etapa 4). */
  podeExcluir: boolean;
}

/** TL-110 aba Contratos e PMOC. `null` = local não encontrado ou de outro cliente (RN-162). */
export async function listarContratosDoLocal(
  ctx: RequestContext,
  localId: string,
  deps: ClientesDeps,
): Promise<repo.LinhaContrato[] | null> {
  if (!ehUuid(localId)) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const l = await repo.buscarLocal(tx, localId);
    if (!l || !podeLer(ctx, l.clienteId)) return null;
    return repo.listarContratos(tx, localId);
  });
}

/** TL-112 aberto. `null` = não encontrado ou de outro cliente (RN-162). */
export async function obterContrato(
  ctx: RequestContext,
  id: string,
  deps: ClientesDeps,
): Promise<ContratoCompleto | null> {
  if (!ehUuid(id)) return null;
  const c = await deps.db.withTransaction(ctx, (tx) => repo.buscarContrato(tx, id));
  if (!c || !podeLer(ctx, c.clienteId)) return null;
  return {
    ...c,
    podeCancelar: podeCancelar(c.situacao),
    podeRenovar: podeRenovar(c.situacao, c.temPosterior),
    podeConfirmarRenovacao:
      c.anteriorId !== null && c.situacao !== "CANCELADO" && c.renovacaoConfirmadaEm === null,
    podeExcluir: !c.temPmoc && c.situacao !== "CANCELADO",
  };
}

/** FL-06 renovar passo 2: dados do contrato novo a partir do anterior (início sugerido). */
export async function sugestaoDeRenovacao(
  ctx: RequestContext,
  anteriorId: string,
  deps: ClientesDeps,
): Promise<{ localId: string; anteriorId: string; inicio: string } | null> {
  const a = await obterContrato(ctx, anteriorId, deps);
  if (!a?.podeRenovar) return null;
  return { localId: a.localId, anteriorId: a.id, inicio: diaSeguinte(a.fim) };
}

/**
 * FL-06 criar (e renovar, com `anteriorId` do mesmo local): RN-176, RN-143; estado por RN-142.
 * `agora` vem de quem chama (relógio da requisição; MOD-06).
 */
export async function criarContrato(
  ctx: RequestContext,
  input: CriarContratoInput,
  deps: ClientesDeps,
  agora = new Date(),
): Promise<{ id: string }> {
  exigirEscrita(ctx);
  const v = criarContratoSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    await repo.travarLocal(tx, v.localId);
    if (!(await repo.buscarLocal(tx, v.localId))) throw naoEncontrado("Local");
    if (v.anteriorId) {
      const a = await repo.buscarContrato(tx, v.anteriorId);
      if (!a || a.localId !== v.localId || !podeRenovar(a.situacao, a.temPosterior)) {
        throw new ErroClientes("ESTADO", "O contrato anterior não pode ser renovado.");
      }
    }
    await conferirSobreposicao(tx, v.localId, v.inicio, v.fim, null);
    const situacao = estadoPorDatas(v.inicio, v.fim, hojeEmSaoPaulo(agora));
    return { id: await repo.inserirContrato(tx, v.localId, v, situacao, v.anteriorId ?? null) };
  });
}

/** TL-112 "Salvar": datas travadas após a emissão (RN-145); cancelado é só leitura (E-06.7). */
export async function atualizarContrato(
  ctx: RequestContext,
  input: AtualizarContratoInput,
  deps: ClientesDeps,
  agora = new Date(),
): Promise<void> {
  exigirEscrita(ctx);
  const v = atualizarContratoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const c = await repo.buscarContrato(tx, v.id);
    if (!c) throw naoEncontrado("Contrato");
    if (c.situacao === "CANCELADO") throw contratoCancelado();
    if (c.pmocEmitido && (v.inicio !== c.inicio || v.fim !== c.fim)) throw datasTravadas();
    await repo.travarLocal(tx, c.localId);
    await conferirSobreposicao(tx, c.localId, v.inicio, v.fim, v.id);
    const situacao = estadoPorDatas(v.inicio, v.fim, hojeEmSaoPaulo(agora));
    if (!(await repo.atualizarContrato(tx, v.id, v, situacao, v.rowVersion))) throw conflito();
  });
}

/**
 * TL-112 "Cancelar contrato" (RN-144; FL-06 cancelar): data entre início e fim, motivo obrigatório;
 * contrato → `CANCELADO` e PMOC → `HISTORICO` (RN-014), juntos.
 * Visitas e ocorrências (RN-076, E-06.5, E-06.6) só existem depois da 1ª emissão (Etapa 4); até o
 * cancelamento tratá-las (Etapa 5), contrato com PMOC emitido não é cancelado.
 */
export async function cancelarContrato(
  ctx: RequestContext,
  input: CancelarContratoInput,
  deps: ClientesDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const v = cancelarContratoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const c = await repo.buscarContrato(tx, v.id);
    if (!c) throw naoEncontrado("Contrato");
    if (!podeCancelar(c.situacao)) {
      throw new ErroClientes("ESTADO", "Só contrato a iniciar ou vigente pode ser cancelado.");
    }
    if (v.data < c.inicio || v.data > c.fim) {
      throw new ErroClientes(
        "VALIDACAO",
        `A data de cancelamento fica entre ${fmt(c.inicio)} e ${fmt(c.fim)}.`,
        "data",
      );
    }
    if (c.pmocEmitido) {
      throw new ErroClientes(
        "NAO_DISPONIVEL",
        "O cancelamento de contrato com PMOC emitido ainda não está disponível.",
      );
    }
    if (!(await repo.cancelarContrato(tx, v.id, v.data, v.motivo, v.rowVersion))) throw conflito();
    await tornarHistoricoNaTransacao(tx, v.id);
  });
}

/**
 * TL-112 "Confirmar renovação" (RN-192; FL-06 renovar passo 4): grava quem e quando; o PMOC do
 * contrato anterior vira `HISTORICO` na hora (RN-014; C10). As visitas restantes do anterior
 * continuam válidas (decisão R2 2.1 x): nada muda nelas.
 */
export async function confirmarRenovacao(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: ClientesDeps,
): Promise<void> {
  exigirEscrita(ctx);
  const userId = ctx.userId;
  if (!userId) throw new ErroClientes("SEM_PERMISSAO", "Sem permissão para alterar o cadastro.");
  await escrever(ctx, deps, async (tx) => {
    const c = await repo.buscarContrato(tx, input.id);
    if (!c) throw naoEncontrado("Contrato");
    const anteriorId = c.anteriorId;
    if (!anteriorId || c.situacao === "CANCELADO" || c.renovacaoConfirmadaEm) {
      throw new ErroClientes("ESTADO", "Este contrato não tem renovação a confirmar.");
    }
    if (!(await repo.confirmarRenovacao(tx, input.id, userId, input.rowVersion))) throw conflito();
    await tornarHistoricoNaTransacao(tx, anteriorId);
  });
}

/** TL-112 "Excluir": só sem PMOC e não cancelado (E-06.7). Motivo opcional (UF-10). */
export async function excluirContrato(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; motivo?: string | null },
  deps: ClientesDeps,
): Promise<{ localId: string }> {
  exigirEscrita(ctx);
  const v = excluirSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    const c = await repo.buscarContrato(tx, v.id);
    if (!c) throw naoEncontrado("Contrato");
    if (c.situacao === "CANCELADO") throw contratoCancelado();
    if (c.temPmoc) throw new ErroClientes("TEM_FILHOS", "Exclua antes o PMOC deste contrato.");
    if (!(await repo.excluirContrato(tx, v.id, ctx.userId, v.motivo, v.rowVersion))) {
      throw conflito();
    }
    return { localId: c.localId };
  });
}
