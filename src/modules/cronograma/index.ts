/**
 * Módulo `cronograma` (RF-11): ocorrências e estados. Na Etapa 4 expõe o cálculo puro (RN-021 a
 * RN-028), usado pela pré-visualização do plano e pela emissão do PMOC, e o recálculo depois da
 * emissão (RN-032, RN-067, RN-068, RN-183, RN-184).
 */
export {
  type AtividadeDoPlano,
  buildSchedule,
  type EquipamentoDoCronograma,
  type EstadoOcorrencia,
  INTERVALO_MESES,
  indiceDoMes,
  type MesDoContrato,
  type MotivoRecalculo,
  mesesDoCronograma,
  mesesPrevistos,
  type OcorrenciaExistente,
  type OcorrenciaPrevista,
  primeiroMesRecalculavel,
  type Recalculo,
  recalcularCronograma,
} from "./domain/cronograma";
