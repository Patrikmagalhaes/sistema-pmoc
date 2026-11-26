import { z } from "zod";
import { NATUREZAS, PERIODICIDADES } from "@/modules/biblioteca";

const id = z.uuid();
const versao = z.number().int().min(1);

/** FL-08 passos 1–2: "Criar PMOC", com a resposta a "Copiar do PMOC anterior?" (RN-004). */
export const criarPmocSchema = z.object({ contratoId: id, copiarDoAnterior: z.boolean() });
export type CriarPmocInput = z.input<typeof criarPmocSchema>;

/** Mesmo limite do motivo da RN-194 (módulo `acesso`); o valor vai para `audit_log.reason`. */
export const MOTIVO_MAX = 500;

/**
 * FL-09 passo 1 e UF-10: motivo opcional da mudança no plano de PMOC emitido. Em branco vira `null`.
 */
export const motivoSchema = z
  .string()
  .trim()
  .max(MOTIVO_MAX, `Até ${MOTIVO_MAX} caracteres.`)
  .nullish()
  .transform((m) => (m ? m : null));

/** TL-120 aba Plano: periodicidade da atividade neste PMOC (RN-026). */
export const alterarPeriodicidadeSchema = z.object({
  id,
  rowVersion: versao,
  periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  motivo: motivoSchema,
});
export type AlterarPeriodicidadeInput = z.input<typeof alterarPeriodicidadeSchema>;

export const comVersaoSchema = z.object({ id, rowVersion: versao, motivo: motivoSchema });

/** RF-10.3: inclui no plano uma atividade da biblioteca. */
export const incluirDaBibliotecaSchema = z.object({
  pmocId: id,
  modeloId: id,
  motivo: motivoSchema,
});

/** RF-10.3: atividade nova só deste PMOC (`activity_template_id = NULL`); campos da RN-043. */
export const incluirNovaSchema = z.object({
  pmocId: id,
  tipoId: id,
  titulo: z.string().trim().min(1, "Informe o título."),
  periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  natureza: z.enum(NATUREZAS, "Escolha a natureza."),
  unidade: z.string().nullish(),
  exigeFoto: z.boolean().default(false),
  motivo: motivoSchema,
});
export type IncluirNovaAtividadeInput = z.input<typeof incluirNovaSchema>;

/**
 * FL-09 passo 2: a mudança que o ADM está para confirmar, para a prévia do impacto. Os mesmos campos
 * das ações, sem `row_version` (a prévia não grava) e, na atividade nova, só o que o cronograma usa.
 */
export const mudancaNoPlanoSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("PERIODICIDADE"),
    id,
    periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  }),
  z.object({ acao: z.literal("REMOVER"), id }),
  z.object({ acao: z.literal("RESTAURAR"), id }),
  z.object({ acao: z.literal("INCLUIR_MODELO"), pmocId: id, modeloId: id }),
  z.object({
    acao: z.literal("INCLUIR_NOVA"),
    pmocId: id,
    tipoId: id,
    periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  }),
]);
export type MudancaNoPlano = z.input<typeof mudancaNoPlanoSchema>;

/** TL-121 "Emitir" (RN-009): o `row_version` do PMOC que a tela mostrou (UF-07). */
export const emitirSchema = z.object({ pmocId: id, rowVersion: z.number().int() });
export type EmitirPmocInput = z.input<typeof emitirSchema>;
