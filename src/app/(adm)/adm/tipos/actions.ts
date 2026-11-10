"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  alterarSituacaoAtividade,
  alterarSituacaoGrupo,
  alterarSituacaoTipo,
  atualizarAtividade,
  atualizarTipo,
  criarTipo,
  ErroBiblioteca,
  excluirAtividade,
  excluirGrupo,
  excluirTipo,
  incluirAtividade,
  incluirGrupo,
  NATUREZAS,
  PERIODICIDADES,
  renomearGrupo,
} from "@/modules/biblioteca";
import { sessionAction } from "@/server/action";
import { getDatabase } from "@/server/db";

/** Resultado das actions de TL-104/TL-105: erro de regra com código estável e mensagem da tela. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const r = await fn();
    revalidatePath("/adm/tipos");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroBiblioteca) {
      const campos = e.campo ? { [e.campo]: e.message } : undefined;
      return { ok: false, codigo: e.codigo, mensagem: e.message, campos };
    }
    if (e instanceof z.ZodError) {
      // UF-02: erro de validação do servidor vai para o campo correspondente.
      const campos = Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? ""), i.message]));
      return { ok: false, codigo: "VALIDACAO", mensagem: "Confira os campos.", campos };
    }
    throw e;
  }
}

const deps = () => ({ db: getDatabase() });
const comVersao = { id: z.uuid(), rowVersion: z.number().int() };
const situacao = z.enum(["ATIVO", "INATIVO"]);
const dadosAtividade = {
  titulo: z.string(),
  periodicidade: z.enum(PERIODICIDADES),
  natureza: z.enum(NATUREZAS),
  unidade: z.string().nullish(),
  exigeFoto: z.boolean(),
  ordem: z.string(),
};

/** TL-105 "Salvar" (criação): tipo e grupos (FL-03 passo 2). */
export const criarTipoAction = sessionAction
  .inputSchema(
    z.object({
      nome: z.string(),
      plural: z.string().nullish(),
      sigla: z.string(),
      grupos: z.array(z.string()),
    }),
  )
  .action(async ({ parsedInput, ctx }) => executar(() => criarTipo(ctx.req, parsedInput, deps())));

export const atualizarTipoAction = sessionAction
  .inputSchema(
    z.object({ ...comVersao, nome: z.string(), plural: z.string().nullish(), sigla: z.string() }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarTipo(ctx.req, parsedInput, deps());
      return {};
    }),
  );

const alvos = {
  tipo: alterarSituacaoTipo,
  grupo: alterarSituacaoGrupo,
  atividade: alterarSituacaoAtividade,
};
const exclusoes = { tipo: excluirTipo, grupo: excluirGrupo, atividade: excluirAtividade };
const alvo = z.enum(["tipo", "grupo", "atividade"]);

/** Inativar ou reativar tipo, grupo ou atividade (RN-044; TL-105). */
export const alterarSituacaoAction = sessionAction
  .inputSchema(z.object({ ...comVersao, alvo, situacao }))
  .action(async ({ parsedInput: { alvo: a, ...v }, ctx }) =>
    executar(async () => {
      await alvos[a](ctx.req, v, deps());
      return {};
    }),
  );

/** Excluir (lógico) tipo, grupo ou atividade sem uso (EL-4). */
export const excluirAction = sessionAction
  .inputSchema(z.object({ ...comVersao, alvo }))
  .action(async ({ parsedInput: { alvo: a, ...v }, ctx }) =>
    executar(async () => {
      await exclusoes[a](ctx.req, v, deps());
      return {};
    }),
  );

export const incluirGrupoAction = sessionAction
  .inputSchema(z.object({ tipoId: z.uuid(), nome: z.string() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => incluirGrupo(ctx.req, parsedInput, deps())),
  );

export const renomearGrupoAction = sessionAction
  .inputSchema(z.object({ ...comVersao, nome: z.string() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await renomearGrupo(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** FL-03 passo 3. A validação de enum e unidade é do serviço (RN-042). */
export const incluirAtividadeAction = sessionAction
  .inputSchema(z.object({ tipoId: z.uuid(), ...dadosAtividade }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => incluirAtividade(ctx.req, parsedInput, deps())),
  );

/** TL-105 "Salvar" da atividade; `periodicidadeMudou` liga o aviso E-03.5. */
export const atualizarAtividadeAction = sessionAction
  .inputSchema(z.object({ ...comVersao, ...dadosAtividade }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => atualizarAtividade(ctx.req, parsedInput, deps())),
  );
