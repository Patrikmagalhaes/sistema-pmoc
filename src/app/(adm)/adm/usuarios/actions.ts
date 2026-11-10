"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  atualizarUsuario,
  criarUsuario,
  ErroAcesso,
  inativarUsuario,
  reativarUsuario,
  redefinirSegundoFator,
  reenviarLinkSenha,
} from "@/modules/acesso";
import { sessionAction } from "@/server/action";
import { getAuth } from "@/server/auth";
import { origemAtual } from "@/server/auth/sessao";

/** Resultado das actions de TL-107: erro de regra com código estável e mensagem da tela. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const r = await fn();
    revalidatePath("/adm/usuarios");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroAcesso) {
      const campos: Record<string, string> | undefined =
        e.codigo === "EMAIL_EM_USO"
          ? { email: e.message }
          : e.codigo === "MOTIVO_OBRIGATORIO"
            ? { motivo: e.message }
            : undefined;
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

const id = z.object({ id: z.uuid() });
const comVersao = z.object({ id: z.uuid(), rowVersion: z.number().int() });

/** TL-107 "Salvar" (criação): dispara a senha inicial (DFT-01). */
export const criarUsuarioAction = sessionAction
  .inputSchema(
    z.object({
      nome: z.string(),
      email: z.string(),
      perfil: z.string(),
      clientId: z.string().nullish(),
      telefone: z.string().nullish(),
    }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(() =>
      criarUsuario(
        ctx.req,
        {
          ...parsedInput,
          perfil: parsedInput.perfil as "ADM" | "TECNICO" | "CLIENTE",
          clientId: parsedInput.clientId || null,
        },
        ctx.headers,
        getAuth().deps,
      ),
    ),
  );

/** TL-107 "Salvar" (edição). */
export const atualizarUsuarioAction = sessionAction
  .inputSchema(
    z.object({
      id: z.uuid(),
      rowVersion: z.number().int(),
      nome: z.string(),
      telefone: z.string().nullish(),
    }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarUsuario(ctx.req, parsedInput, getAuth().deps);
      return {};
    }),
  );

export const inativarUsuarioAction = sessionAction
  .inputSchema(comVersao)
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await inativarUsuario(ctx.req, parsedInput, ctx.headers, getAuth().deps);
      return {};
    }),
  );

export const reativarUsuarioAction = sessionAction
  .inputSchema(comVersao)
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await reativarUsuario(ctx.req, parsedInput, ctx.headers, getAuth().deps);
      return {};
    }),
  );

/** TL-107 "Redefinir segundo fator" (SEG-17; RN-194): motivo obrigatório. */
export const redefinirSegundoFatorAction = sessionAction
  .inputSchema(z.object({ id: z.uuid(), motivo: z.string() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await redefinirSegundoFator(ctx.req, parsedInput, await origemAtual(), getAuth().deps);
      return {};
    }),
  );

export const reenviarLinkAction = sessionAction
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await reenviarLinkSenha(ctx.req, parsedInput.id, getAuth().deps);
      return {};
    }),
  );
