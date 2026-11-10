"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { atualizarMeusDados, ErroAcesso, encerrarMinhasSessoes } from "@/modules/acesso";
import { sessionAction } from "@/server/action";
import { getAuth } from "@/server/auth";
import { origemAtual, sessaoAtual } from "@/server/auth/sessao";

type Resultado =
  | { ok: true; encerradas?: number }
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

async function executar(fn: () => Promise<number | undefined>): Promise<Resultado> {
  try {
    const n = await fn();
    revalidatePath("/conta");
    return { ok: true, encerradas: n };
  } catch (e) {
    if (e instanceof ErroAcesso) return { ok: false, codigo: e.codigo, mensagem: e.message };
    if (e instanceof z.ZodError) {
      const campos = Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? ""), i.message]));
      return { ok: false, codigo: "VALIDACAO", mensagem: "Confira os campos.", campos };
    }
    throw e;
  }
}

/** TL-005 "Salvar dados" (LG-21). */
export const salvarMeusDadosAction = sessionAction
  .inputSchema(
    z.object({ rowVersion: z.number().int(), nome: z.string(), telefone: z.string().nullish() }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarMeusDados(ctx.req, parsedInput, getAuth().deps);
      return undefined;
    }),
  );

/** Sessão atual vem do servidor, nunca do navegador. */
async function sessaoAtualId(): Promise<string> {
  const s = await sessaoAtual();
  if (s.estado !== "OK") throw new ErroAcesso("SEM_PERMISSAO", "Entre de novo.");
  return s.sessaoId;
}

/** TL-005 "Encerrar" (SEG-13). A sessão atual se encerra com "Sair". */
export const encerrarSessaoAction = sessionAction
  .inputSchema(z.object({ sessaoId: z.string().min(1).max(128) }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      if (parsedInput.sessaoId === (await sessaoAtualId())) {
        throw new ErroAcesso("NAO_ENCONTRADO", 'Para encerrar esta sessão, use "Sair".');
      }
      return encerrarMinhasSessoes(
        ctx.req,
        { sessaoId: parsedInput.sessaoId },
        await origemAtual(),
        getAuth().deps,
      );
    }),
  );

/** TL-005 "Encerrar todas as outras" (SEG-13). */
export const encerrarOutrasSessoesAction = sessionAction.action(async ({ ctx }) =>
  executar(async () =>
    encerrarMinhasSessoes(
      ctx.req,
      { todasMenos: await sessaoAtualId() },
      await origemAtual(),
      getAuth().deps,
    ),
  ),
);
