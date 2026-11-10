export type { Cliente, ClienteResumo, LinhaCliente, LinhaLocal, Local } from "./repo";
export type {
  AtualizarClienteInput,
  AtualizarLocalInput,
  CriarClienteInput,
  CriarLocalInput,
} from "./schemas";
export {
  atualizarCliente,
  atualizarLocal,
  CLIENTES_POR_PAGINA,
  type ClienteCompleto,
  type ClientesDeps,
  criarCliente,
  criarLocal,
  ErroClientes,
  excluirCliente,
  excluirLocal,
  listarClientes,
  listarClientesParaSelecao,
  obterCliente,
  obterLocal,
} from "./service";
