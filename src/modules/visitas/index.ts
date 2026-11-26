/**
 * Módulo `visitas` (RF-17, RF-18): agenda, remarcação, divisão. Na Etapa 4 cobre só o acompanhamento
 * do recálculo do cronograma depois da emissão (RN-065, RN-066, RN-102); a agenda entra na Etapa 5.
 */
export {
  type AcompanhamentoDasVisitas,
  acompanharRecalculo,
  type EstadoVisita,
  naoIniciada,
  type OcorrenciaQueEntra,
  type VisitaDoPmoc,
} from "./domain/recalculo";
export type { VisitaIniciada } from "./repo";
export {
  gravarAcompanhamentoNaTransacao,
  type ResultadoAcompanhamento,
  visitaEmAndamentoDaAtividadeNaTransacao,
  visitasIniciadasComOcorrenciasNaTransacao,
  visitasNaoIniciadasNaTransacao,
} from "./service";
