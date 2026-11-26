/**
 * Módulo `pmoc` (RF-10 a RF-16). Etapa 4: rascunho e plano (FL-08 passos 1–6; TL-120), verificação
 * das pré-condições (FL-08 passo 7; TL-121; RN-007, RN-008, RN-017) e emissão (FL-08 passo 11; RN-009).
 * A passagem para `HISTORICO` é usada pelo cancelamento e pela confirmação de renovação do contrato
 * (módulo `clientes`); a inclusão de tipo no plano, pela inclusão de equipamento (módulo
 * `equipamentos`). As regras de apresentação e o retrato alimentam o gerador do PDF (`src/server/pdf`).
 * `verificarDocumento` serve a tela pública TL-007 (RN-187; INT-14).
 */
export {
  codigoImpresso,
  normalizarCodigo,
  TAMANHO_CODIGO,
} from "./domain/codigo-verificacao";
export {
  blocosDeDozeMeses,
  CAMPO_VAZIO_NO_PDF,
  type Campo,
  campos,
  camposDeEndereco,
  capacidade,
  cnpj,
  type EstadoDaCelula,
  enderecoEmLinha,
  estadoNaEmissao,
  identificacaoContrato,
  LEGENDA_FICHA,
  type LinhaDaListagem,
  listagemDeEquipamentos,
  localEData,
  mesCurto,
  ROTULO_CELULA,
  telefone,
  telefones,
  vigencia,
} from "./domain/documento";
export type { CodigoPendencia, DestinoPendencia, Pendencia } from "./domain/emissao";
export {
  type DadosDoDocumento,
  montarSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotPmocV1,
  type TipoDoSnapshot,
} from "./domain/snapshot";
export { ANEXO1 } from "./domain/textos";
export {
  LIMITE_VERIFICACAO_POR_IP,
  ROTULO_SITUACAO_VERIFICADA,
  type SituacaoVerificada,
} from "./domain/verificacao";
export type {
  AtividadePlano,
  EstadoPmoc,
  EstadoVersao,
  ModeloDisponivel,
  Pmoc,
  TipoDoPlano,
  VersaoDoPmoc,
} from "./repo";
export type {
  AlterarPeriodicidadeInput,
  CriarPmocInput,
  EmitirPmocInput,
  IncluirNovaAtividadeInput,
  MudancaNoPlano,
} from "./schemas";
export { MOTIVO_MAX } from "./schemas";
export {
  type AtividadeNoPlano,
  alterarPeriodicidade,
  criarPmoc,
  type DocumentoVerificado,
  type EmissaoDeps,
  ErroPmoc,
  emitirPmoc,
  type HipoteseDeRecalculo,
  type ImpactoDoRecalculo,
  impactoDoRecalculoNaTransacao,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  incluirTipoNoPlanoNaTransacao,
  obterPmoc,
  type PmocCompleto,
  type PmocDeps,
  previaDaMudancaNoPlano,
  type ResultadoEmissao,
  type ResultadoRecalculo,
  type ResultadoVerificacao,
  recalcularCronogramaNaTransacao,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
  type TipoNoPlano,
  tornarHistoricoNaTransacao,
  type VerificacaoEmissao,
  verificarDocumento,
  verificarEmissao,
} from "./service";
