import "server-only";
import { normalizarCnpj } from "@/lib/cnpj";
import { can } from "@/modules/autorizacao";
import type { RequestContext } from "@/server/context";
import type { Database, Tx } from "@/server/db";
import { restricaoViolada } from "@/server/db/errors";
import * as repo from "./repo";
import {
  type AtualizarClienteInput,
  type AtualizarLocalInput,
  atualizarClienteSchema,
  atualizarLocalSchema,
  type CriarClienteInput,
  type CriarLocalInput,
  criarClienteSchema,
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
      | "TEM_FILHOS",
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
    if (restricaoViolada(e) === "client_cnpj_live_uq") {
      throw new ErroClientes("CNPJ_EM_USO", "Já existe cliente com este CNPJ.", "cnpj");
    }
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
