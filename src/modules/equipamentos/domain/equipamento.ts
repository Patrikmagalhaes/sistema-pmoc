/** Regras puras do equipamento (RF-09). A TAG em si é gerada no banco (trigger `equipment_tag`, 0013). */

/** RN-052 [A VALIDAR]: unidade padrão da capacidade. */
export const UNIDADE_PADRAO = "BTU/h";

/** 03 §2.5: `capacity_unit varchar(20)`. */
export const UNIDADE_MAX = 20;

/** 03 §2.5: `capacity numeric(12,2)` → até 10 dígitos inteiros. */
export const CAPACIDADE_LIMITE = 1e10;

/** FL-07 passo 3: prévia antes de salvar; o sequencial só existe depois de gravar (RN-046). */
export const previaDaTag = (codigoLocal: string, sigla: string) => `${codigoLocal}-${sigla}-NNN`;

export type SituacaoEquipamento = "ATIVO" | "INATIVO";
