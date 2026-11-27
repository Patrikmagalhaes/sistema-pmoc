"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  alterarPeriodicidade,
  criarPmoc,
  ErroPmoc,
  emitirPmoc,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  type MudancaNoPlano,
  previaDaMudancaNoPlano,
  type ResultadoRecalculo,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
  verificarEmissao,
} from "@/modules/pmoc";
import { sessionAction } from "@/server/action";
import { getDatabase } from "@/server/db";
import { emissaoDeps } from "@/server/emissao";

/** Resultado das actions de TL-112 "Criar PMOC" e TL-120: erro de regra com código e mensagem. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

/** `revalidar = false` para leituras (ex.: a verificação da TL-121, que não grava nada). */
async function executar<T extends object>(
  fn: () => Promise<T>,
  revalidar = true,
): Promise<Resultado<T>> {
  try {
    const r = await fn();
    if (revalidar) {
      revalidatePath("/adm/pmocs");
      revalidatePath("/adm/contratos");
      revalidatePath("/adm/locais");
    }
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroPmoc) {
      const campos = e.campo ? { [e.campo]: e.message } : undefined;
      return { ok: false, codigo: e.codigo, mensagem: e.message, campos };
    }
    if (e instanceof z.ZodError) {
      // UF-02: erro de validação do servidor vai para o campo.
      const campos = Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
      return { ok: false, codigo: "VALIDACAO", mensagem: "Confira os campos.", campos };
    }
    throw e;
  }
}

const deps = () => ({ db: getDatabase() });
/** UF-10, FL-09 passo 1: motivo opcional; o limite e o corte de espaços ficam no módulo. */
const motivo = z.string().nullish();
const comVersao = { id: z.uuid(), rowVersion: z.number().int(), motivo };
const periodicidade = z.enum(["MM", "MB", "MT", "MS", "MA"]);

/** O que a tela mostra depois de gravar: o recálculo do PMOC emitido (`null` em rascunho). */
const comRecalculo = (recalculo: ResultadoRecalculo | null) => ({ recalculo });

/**
 * FL-09 passo 2: prévia do impacto da mudança no plano de PMOC emitido (E-07.7, E-09.2). Não grava;
 * `impacto: null` em rascunho (a mudança vale na hora).
 */
export const previaDaMudancaAction = sessionAction
  .inputSchema(
    z.discriminatedUnion("acao", [
      z.object({ acao: z.literal("PERIODICIDADE"), id: z.uuid(), periodicidade }),
      z.object({ acao: z.literal("REMOVER"), id: z.uuid() }),
      z.object({ acao: z.literal("RESTAURAR"), id: z.uuid() }),
      z.object({ acao: z.literal("INCLUIR_MODELO"), pmocId: z.uuid(), modeloId: z.uuid() }),
      z.object({
        acao: z.literal("INCLUIR_NOVA"),
        pmocId: z.uuid(),
        tipoId: z.uuid(),
        periodicidade,
      }),
    ]),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(
      async () => ({
        impacto: await previaDaMudancaNoPlano(ctx.req, parsedInput as MudancaNoPlano, deps()),
      }),
      false,
    ),
  );

/** TL-112 "Criar PMOC" (FL-08 passos 1–3); `copiarDoAnterior` responde à pergunta do passo 2. */
export const criarPmocAction = sessionAction
  .inputSchema(z.object({ contratoId: z.uuid(), copiarDoAnterior: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => executar(() => criarPmoc(ctx.req, parsedInput, deps())));

/** TL-121 `VERIFICANDO`: pré-condições da emissão (RN-007, RN-008, RN-017). Não grava nada. */
export const verificarEmissaoAction = sessionAction
  .inputSchema(z.object({ pmocId: z.uuid() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => verificarEmissao(ctx.req, parsedInput.pmocId, deps()), false),
  );

/**
 * TL-121 "Emitir" (RN-009): PDF, assinatura do RT, versão 1, cronograma, visitas e notificação, numa
 * transação. Síncrona (RN-188): o `maxDuration` da página TL-120 cobre o tempo (S-01).
 *
 * Sem `revalidatePath`: a página atualizada viria na mesma resposta e, já sem o botão "Emitir PMOC"
 * (só existe em `RASCUNHO`), desmontaria o diálogo antes de mostrar `CONCLUIDO` (FL-08 passo 12:
 * versão e "Baixar PDF"). A TL-121 recarrega a página ao fechar o diálogo (`router.refresh`).
 */
export const emitirPmocAction = sessionAction
  .inputSchema(z.object({ pmocId: z.uuid(), rowVersion: z.number().int() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => emitirPmoc(ctx.req, parsedInput, emissaoDeps()), false),
  );

/** TL-120 aba Plano: periodicidade (RN-026); emitido, com recálculo (RN-032). */
export const alterarPeriodicidadeAction = sessionAction
  .inputSchema(z.object({ ...comVersao, periodicidade }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => comRecalculo(await alterarPeriodicidade(ctx.req, parsedInput, deps()))),
  );

/** TL-120 "Remover" (RF-10.3); emitido, com recálculo (RN-183). */
export const removerAtividadeAction = sessionAction
  .inputSchema(z.object(comVersao))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => comRecalculo(await removerAtividadeDoPlano(ctx.req, parsedInput, deps()))),
  );

/** TL-120 "Incluir" de atividade removida (RN-184). */
export const restaurarAtividadeAction = sessionAction
  .inputSchema(z.object(comVersao))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () =>
      comRecalculo(await restaurarAtividadeDoPlano(ctx.req, parsedInput, deps())),
    ),
  );

/** TL-120 "Incluir" da biblioteca (RF-10.3). */
export const incluirDaBibliotecaAction = sessionAction
  .inputSchema(z.object({ pmocId: z.uuid(), modeloId: z.uuid(), motivo }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => incluirAtividadeDaBiblioteca(ctx.req, parsedInput, deps())),
  );

/** TL-120 "Incluir" de atividade nova só deste PMOC (RF-10.3). */
export const incluirNovaAction = sessionAction
  .inputSchema(
    z.object({
      pmocId: z.uuid(),
      tipoId: z.uuid(),
      titulo: z.string(),
      periodicidade: z.string(),
      natureza: z.string(),
      unidade: z.string().nullish(),
      exigeFoto: z.boolean(),
      motivo,
    }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(() =>
      incluirAtividadeNova(
        ctx.req,
        parsedInput as Parameters<typeof incluirAtividadeNova>[1],
        deps(),
      ),
    ),
  );
