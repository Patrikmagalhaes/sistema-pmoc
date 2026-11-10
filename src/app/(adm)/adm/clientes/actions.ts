"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UFS } from "@/lib/endereco";
import {
  atualizarCliente,
  atualizarLocal,
  criarCliente,
  criarLocal,
  ErroClientes,
  excluirCliente,
  excluirLocal,
} from "@/modules/clientes";
import { sessionAction } from "@/server/action";
import { getDatabase } from "@/server/db";

/** Resultado das actions de TL-109/TL-110: erro de regra com código estável e mensagem da tela. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      codigo: string;
      mensagem: string;
      campos?: Record<string, string>;
      /** E-04.2: cliente que já tem o CNPJ. */
      existenteId?: string;
    };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const r = await fn();
    revalidatePath("/adm/clientes");
    revalidatePath("/adm/locais");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroClientes) {
      const campos = e.campo ? { [e.campo]: e.message } : undefined;
      return {
        ok: false,
        codigo: e.codigo,
        mensagem: e.message,
        campos,
        existenteId: e.existenteId,
      };
    }
    if (e instanceof z.ZodError) {
      // UF-02: erro de validação do servidor vai para o campo (caminho com ponto, ex.: endereco.cep).
      const campos = Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
      return { ok: false, codigo: "VALIDACAO", mensagem: "Confira os campos.", campos };
    }
    throw e;
  }
}

const deps = () => ({ db: getDatabase() });
const comVersao = { id: z.uuid(), rowVersion: z.number().int() };
const endereco = z.object({
  logradouro: z.string(),
  numero: z.string().nullish(),
  semNumero: z.boolean(),
  complemento: z.string().nullish(),
  bairro: z.string().nullish(),
  cidade: z.string(),
  uf: z.enum(UFS),
  cep: z.string(),
});
const dadosCliente = {
  razaoSocial: z.string(),
  nomeFantasia: z.string().nullish(),
  cnpj: z.string(),
  telefone1: z.string().nullish(),
  telefone2: z.string().nullish(),
  endereco,
};
const dadosLocal = { nome: z.string(), telefone: z.string().nullish(), endereco };
const excluir = z.object({ ...comVersao, motivo: z.string().nullish() });

/** TL-109 "Salvar" (criação), FL-04 passo 2. */
export const criarClienteAction = sessionAction
  .inputSchema(z.object(dadosCliente))
  .action(async ({ parsedInput, ctx }) =>
    executar(() => criarCliente(ctx.req, parsedInput, deps())),
  );

export const atualizarClienteAction = sessionAction
  .inputSchema(z.object({ ...comVersao, ...dadosCliente }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarCliente(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** TL-109 "Excluir cliente" (E-04.7). */
export const excluirClienteAction = sessionAction
  .inputSchema(excluir)
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await excluirCliente(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** TL-110 "Salvar" (criação), FL-04 passo 3: devolve o código gerado. */
export const criarLocalAction = sessionAction
  .inputSchema(z.object({ clienteId: z.uuid(), ...dadosLocal }))
  .action(async ({ parsedInput, ctx }) => executar(() => criarLocal(ctx.req, parsedInput, deps())));

export const atualizarLocalAction = sessionAction
  .inputSchema(z.object({ ...comVersao, ...dadosLocal }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await atualizarLocal(ctx.req, parsedInput, deps());
      return {};
    }),
  );

/** TL-110 "Excluir local" (E-04.7). */
export const excluirLocalAction = sessionAction
  .inputSchema(excluir)
  .action(async ({ parsedInput, ctx }) =>
    executar(() => excluirLocal(ctx.req, parsedInput, deps())),
  );
