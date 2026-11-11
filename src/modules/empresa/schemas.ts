import { z } from "zod";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import { enderecoSchema, telefoneObrigatorio } from "@/lib/endereco";

/** `null` = o registro único ainda não existe (FL-02 passo 1: primeiro acesso). */
const versao = z.number().int().min(1).nullable();
const texto = (msg: string) => z.string().trim().min(1, msg);

/** RF-04.2 (todos obrigatórios; §9.5); TL-102 seção Empresa. Endereço com bairro (03 §2.2). */
const dadosEmpresa = z.object({
  razaoSocial: texto("Informe a razão social."),
  cnpj: z.string().transform(normalizarCnpj).refine(cnpjValido, "CNPJ inválido."), // E-02.1
  telefone: telefoneObrigatorio,
  crea: texto("Informe o registro CREA."),
  endereco: enderecoSchema({ bairroObrigatorio: true }),
});

/** `logo`: comprovante do envio (módulo `arquivos`); obrigatório na criação, opcional na edição. */
export const salvarEmpresaSchema = z
  .object({ rowVersion: versao, logo: z.string().min(1).nullish() })
  .and(dadosEmpresa);
export type SalvarEmpresaInput = z.input<typeof salvarEmpresaSchema>;

/** RF-04.3; TL-102 seção RT (pessoa física, DEC-29). */
const dadosRt = z.object({
  nome: texto("Informe o nome do RT."),
  titulo: texto("Informe o título profissional."),
  registro: texto("Informe o nº de registro."),
  telefone: telefoneObrigatorio,
  email: z.string().trim().pipe(z.email("E-mail inválido.")),
  endereco: enderecoSchema({ bairroObrigatorio: true }),
});

export const salvarRtSchema = z.object({ rowVersion: versao }).and(dadosRt);
export type SalvarRtInput = z.input<typeof salvarRtSchema>;

/** TL-103: arquivo (bytes) e senha; os bytes chegam em base64 da tela (até 50 KB, SEG-52). */
export const enviarCertificadoSchema = z.object({
  nomeArquivo: z.string().trim().min(1, "Escolha o arquivo do certificado."),
  arquivo: z.string().min(1, "Escolha o arquivo do certificado."),
  senha: z.string().min(1, "Informe a senha do certificado."),
});
export type EnviarCertificadoInput = z.input<typeof enviarCertificadoSchema>;
