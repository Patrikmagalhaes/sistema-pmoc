/** Módulo `equipamentos` (RF-09): equipamentos do local e TAG (RN-046). */
export {
  previaDaTag,
  type SituacaoEquipamento,
  UNIDADE_MAX,
  UNIDADE_PADRAO,
} from "./domain/equipamento";
export type { Equipamento, LinhaEquipamento, OpcaoGrupo, OpcaoTipo } from "./repo";
export type { AtualizarEquipamentoInput, CriarEquipamentoInput } from "./schemas";
export {
  alterarSituacaoEquipamento,
  atualizarEquipamento,
  criarEquipamento,
  type EquipamentoCompleto,
  type EquipamentosDeps,
  type EquipamentosDoLocal,
  ErroEquipamentos,
  excluirEquipamento,
  listarEquipamentosDoLocal,
  type NovoEquipamento,
  obterEquipamento,
  prepararNovoEquipamento,
  SEM_MUDAR_COM_PMOC,
} from "./service";
