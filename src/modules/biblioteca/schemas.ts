import { z } from "zod";
import { FORMATO_SIGLA, NATUREZAS, normalizarSigla, PERIODICIDADES } from "./domain/biblioteca";

const texto = (msg: string) => z.string().trim().min(1, msg);
const id = z.uuid();
const versao = z.number().int().min(1);

const dadosTipo = {
  nome: texto("Informe o nome."),
  plural: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  // E-03.1: formato da sigla [A VALIDAR].
  sigla: z
    .string()
    .transform(normalizarSigla)
    .refine((v) => FORMATO_SIGLA.test(v), "A sigla tem de 2 a 5 letras, sem números."),
};

/** FL-03 passo 2: nome, plural opcional, sigla e ao menos um grupo (RN-040). */
export const criarTipoSchema = z.object({
  ...dadosTipo,
  grupos: z
    .array(z.string().trim())
    .transform((gs) => gs.filter((g) => g !== ""))
    .refine((gs) => gs.length > 0, "Inclua ao menos um grupo.")
    .refine(
      (gs) => new Set(gs.map((g) => g.toLowerCase())).size === gs.length,
      "Há grupos repetidos.",
    ),
});
export type CriarTipoInput = z.input<typeof criarTipoSchema>;

export const atualizarTipoSchema = z.object({ id, rowVersion: versao, ...dadosTipo });
export type AtualizarTipoInput = z.input<typeof atualizarTipoSchema>;

export const comVersaoSchema = z.object({ id, rowVersion: versao });

export const incluirGrupoSchema = z.object({ tipoId: id, nome: texto("Informe o nome do grupo.") });
export const renomearGrupoSchema = z.object({
  id,
  rowVersion: versao,
  nome: texto("Informe o nome do grupo."),
});

/** FL-03 passo 3; RN-043: só estes campos (sem procedimento nem faixa, DEC-10, DEC-27). */
const dadosAtividade = {
  titulo: texto("Informe o título."),
  periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  natureza: z.enum(NATUREZAS, "Escolha a natureza."),
  unidade: z.string().nullish(),
  exigeFoto: z.boolean().default(false),
  ordem: z.coerce.number("Informe a ordem.").int("A ordem é um número inteiro."),
};

export const incluirAtividadeSchema = z.object({ tipoId: id, ...dadosAtividade });
export type IncluirAtividadeInput = z.input<typeof incluirAtividadeSchema>;
export const atualizarAtividadeSchema = z.object({ id, rowVersion: versao, ...dadosAtividade });
export type AtualizarAtividadeInput = z.input<typeof atualizarAtividadeSchema>;
