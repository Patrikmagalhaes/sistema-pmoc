"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  alterarSituacaoEquipamento,
  atualizarEquipamento,
  criarEquipamento,
  ErroEquipamentos,
  excluirEquipamento,
} from "@/modules/equipamentos";
import { sessionAction } from "@/server/action";
import { getDatabase } from "@/server/db";

/** Resultado das actions de TL-111: erro de regra com código estável e mensagem da tela. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const r = await fn();
    revalidatePath("/adm/equipamentos");
    revalidatePath("/adm/locais");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroEquipamentos) {
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
const comVersao = { id: z.uuid(), rowVersion: z.number().int() };
const dados = {
  grupoId: z.string(),
  ambiente: z.string(),
  marca: z.string().nullish(),
  modelo: z.string().nullish(),
  serie: z.string().nullish(),
  capacidade: z.string().nullish(),
  unidade: z.string().nullish(),
};

/** TL-111 "Salvar" (criação), FL-07 criar: devolve a TAG gerada (RN-046). */
export const criarEquipamentoAction = sessionAction
  .inputSchema(z.object({ localId: z.uuid(), tipoId: z.string(), ...dados }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => criarEquipamento(ctx.req, parsedInput, deps())),
  );

export const atualizarEquipamentoAction = sessionAction
  .inputSchema(z.object({ ...comVersao, ...dados }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarEquipamento(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** TL-111 "Inativar" / "Reativar". */
export const alterarSituacaoEquipamentoAction = sessionAction
  .inputSchema(z.object({ ...comVersao, situacao: z.enum(["ATIVO", "INATIVO"]) }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await alterarSituacaoEquipamento(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** TL-111 "Excluir" (RN-048). */
export const excluirEquipamentoAction = sessionAction
  .inputSchema(z.object({ ...comVersao, motivo: z.string().nullish() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => excluirEquipamento(ctx.req, parsedInput, deps())),
  );
