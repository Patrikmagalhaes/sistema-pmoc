import { z } from "zod";
import { NATUREZAS, PERIODICIDADES } from "@/modules/biblioteca";

const id = z.uuid();
const versao = z.number().int().min(1);

/** FL-08 passos 1–2: "Criar PMOC", com a resposta a "Copiar do PMOC anterior?" (RN-004). */
export const criarPmocSchema = z.object({ contratoId: id, copiarDoAnterior: z.boolean() });
export type CriarPmocInput = z.input<typeof criarPmocSchema>;

/** TL-120 aba Plano: periodicidade da atividade neste PMOC (RN-026). */
export const alterarPeriodicidadeSchema = z.object({
  id,
  rowVersion: versao,
  periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
});
export type AlterarPeriodicidadeInput = z.input<typeof alterarPeriodicidadeSchema>;

export const comVersaoSchema = z.object({ id, rowVersion: versao });

/** RF-10.3: inclui no plano uma atividade da biblioteca. */
export const incluirDaBibliotecaSchema = z.object({ pmocId: id, modeloId: id });

/** RF-10.3: atividade nova só deste PMOC (`activity_template_id = NULL`); campos da RN-043. */
export const incluirNovaSchema = z.object({
  pmocId: id,
  tipoId: id,
  titulo: z.string().trim().min(1, "Informe o título."),
  periodicidade: z.enum(PERIODICIDADES, "Escolha a periodicidade."),
  natureza: z.enum(NATUREZAS, "Escolha a natureza."),
  unidade: z.string().nullish(),
  exigeFoto: z.boolean().default(false),
});
export type IncluirNovaAtividadeInput = z.input<typeof incluirNovaSchema>;

/** TL-121 "Emitir" (RN-009): o `row_version` do PMOC que a tela mostrou (UF-07). */
export const emitirSchema = z.object({ pmocId: id, rowVersion: z.number().int() });
export type EmitirPmocInput = z.input<typeof emitirSchema>;
