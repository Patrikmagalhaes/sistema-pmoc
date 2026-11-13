/**
 * Módulo `cronograma` (RF-11): ocorrências e estados. Na Etapa 4 expõe o cálculo puro (RN-021 a
 * RN-028), usado pela pré-visualização do plano e pela emissão do PMOC.
 */
export {
  type AtividadeDoPlano,
  buildSchedule,
  type EquipamentoDoCronograma,
  INTERVALO_MESES,
  type MesDoContrato,
  mesesDoCronograma,
  mesesPrevistos,
  type OcorrenciaPrevista,
} from "./domain/cronograma";
