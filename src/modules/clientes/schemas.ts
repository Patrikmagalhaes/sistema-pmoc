import { z } from "zod";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import { enderecoSchema, telefoneOpcional } from "@/lib/endereco";
import { dataValida } from "./domain/contrato";

const id = z.uuid();
const versao = z.number().int().min(1);
const opcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/** RF-05; TL-109 aba Dados. CNPJ e telefones gravados sem máscara (RF-05.5). */
const dadosCliente = z
  .object({
    razaoSocial: z.string().trim().min(1, "Informe a razão social."),
    nomeFantasia: opcional,
    // E-04.1 / CA-05.1 / CA-05.2: tamanho, CPF e dígito verificador (DM-13).
    cnpj: z.string().transform(normalizarCnpj).refine(cnpjValido, "CNPJ inválido."),
    telefone1: telefoneOpcional,
    telefone2: telefoneOpcional,
    // Cliente: bairro opcional (03 §2.3).
    endereco: enderecoSchema({ bairroObrigatorio: false }),
  })
  .superRefine((v, ctx) => {
    // E-04.4 / RF-05.3: telefone 2 exige o 1 e não o repete.
    if (v.telefone2 && !v.telefone1)
      ctx.addIssue({
        code: "custom",
        path: ["telefone2"],
        message: "Preencha o telefone 1 antes.",
      });
    else if (v.telefone2 && v.telefone2 === v.telefone1)
      ctx.addIssue({ code: "custom", path: ["telefone2"], message: "O telefone 2 repete o 1." });
  });

export const criarClienteSchema = dadosCliente;
export type CriarClienteInput = z.input<typeof criarClienteSchema>;
export const atualizarClienteSchema = z.object({ id, rowVersion: versao }).and(dadosCliente);
export type AtualizarClienteInput = z.input<typeof atualizarClienteSchema>;

export const excluirSchema = z.object({ id, rowVersion: versao, motivo: opcional });

/** RF-06; TL-110 aba Dados. O código é gerado (DM-19) e não vem daqui. */
const dadosLocal = z.object({
  nome: z.string().trim().min(1, "Informe o nome do local."),
  telefone: telefoneOpcional,
  endereco: enderecoSchema({ bairroObrigatorio: false }),
});

export const criarLocalSchema = z.object({ clienteId: id }).and(dadosLocal);
export type CriarLocalInput = z.input<typeof criarLocalSchema>;
export const atualizarLocalSchema = z.object({ id, rowVersion: versao }).and(dadosLocal);
export type AtualizarLocalInput = z.input<typeof atualizarLocalSchema>;

/** RF-07; RN-176; TL-112. Datas de negócio `YYYY-MM-DD`. */
const data = (msg: string) => z.string().refine(dataValida, msg);
const dadosContrato = z
  .object({
    inicio: data("Informe a data de início."),
    fim: data("Informe a data de fim."),
    // E-06.3 / DM-09: ART obrigatória, texto livre sem formato (AF-16).
    art: z.string().trim().min(1, "Informe o nº da ART."),
    th: opcional.refine((v) => !v || v.length <= 30, "O código TH tem até 30 caracteres."),
    revisao: opcional.refine((v) => !v || v.length <= 10, "A revisão tem até 10 caracteres."),
  })
  .refine((v) => v.fim > v.inicio, {
    path: ["fim"],
    message: "A data de fim deve ser depois da de início.", // E-06.1
  });

export const criarContratoSchema = z
  .object({ localId: id, anteriorId: id.nullish() })
  .and(dadosContrato);
export type CriarContratoInput = z.input<typeof criarContratoSchema>;
export const atualizarContratoSchema = z.object({ id, rowVersion: versao }).and(dadosContrato);
export type AtualizarContratoInput = z.input<typeof atualizarContratoSchema>;

/** RN-144: data entre início e fim (conferida no serviço) e motivo obrigatório (decisão R2 2.5). */
export const cancelarContratoSchema = z.object({
  id,
  rowVersion: versao,
  data: data("Informe a data de cancelamento."),
  motivo: z.string().trim().min(1, "Informe o motivo do cancelamento."),
});
export type CancelarContratoInput = z.input<typeof cancelarContratoSchema>;
