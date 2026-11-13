/**
 * Módulo `pmoc` (RF-10 a RF-16). Etapa 4: rascunho e plano (FL-08 passos 1–6; TL-120). A passagem
 * para `HISTORICO` é usada pelo cancelamento e pela confirmação de renovação do contrato (módulo
 * `clientes`); a inclusão de tipo no plano, pela inclusão de equipamento (módulo `equipamentos`).
 */
export type {
  AtividadePlano,
  EstadoPmoc,
  ModeloDisponivel,
  Pmoc,
  TipoDoPlano,
} from "./repo";
export type {
  AlterarPeriodicidadeInput,
  CriarPmocInput,
  IncluirNovaAtividadeInput,
} from "./schemas";
export {
  type AtividadeNoPlano,
  alterarPeriodicidade,
  criarPmoc,
  ErroPmoc,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  incluirTipoNoPlanoNaTransacao,
  obterPmoc,
  type PmocCompleto,
  type PmocDeps,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
  SEM_MUDAR_PLANO_EMITIDO,
  type TipoNoPlano,
  tornarHistoricoNaTransacao,
} from "./service";
