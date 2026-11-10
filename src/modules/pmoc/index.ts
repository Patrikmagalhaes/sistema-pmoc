/**
 * Módulo `pmoc` (RF-10 a RF-16). Na Etapa 3 só expõe a passagem para `HISTORICO`, usada pelo
 * cancelamento e pela confirmação de renovação do contrato (módulo `clientes`). O plano, a emissão e
 * as versões chegam na Etapa 4.
 */
export { tornarHistoricoNaTransacao } from "./service";
