/** Módulo `arquivos` (05 §3.7; 06 SEG-50 a SEG-53): envio, confirmação e leitura de arquivos. */
export { FINALIDADES, type Finalidade } from "./domain/arquivos";
export {
  type ArquivosDeps,
  confirmarEnvioNaTransacao,
  ErroArquivos,
  lerArquivo,
  type PreparoEnvio,
  prepararEnvio,
} from "./service";
