/** Módulo `arquivos` (05 §3.7; 06 SEG-50 a SEG-53): envio, confirmação e leitura de arquivos. */
export { type ArquivoGerado, FINALIDADES, type Finalidade } from "./domain/arquivos";
export {
  type ArquivosDeps,
  confirmarEnvioNaTransacao,
  ErroArquivos,
  gravarArquivoGeradoNaTransacao,
  lerArquivo,
  lerArquivoNaTransacao,
  type PreparoEnvio,
  prepararEnvio,
} from "./service";
