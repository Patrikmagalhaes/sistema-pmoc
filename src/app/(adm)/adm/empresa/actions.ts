"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UFS } from "@/lib/endereco";
import { ErroArquivos } from "@/modules/arquivos";
import { ErroEmpresa, enviarCertificado, salvarEmpresa, salvarRt } from "@/modules/empresa";
import { sessionAction } from "@/server/action";
import { empresaDeps } from "@/server/arquivos";

/** Resultado das actions de TL-102/TL-103: erro de regra com código estável e mensagem da tela. */
export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const r = await fn();
    revalidatePath("/adm/empresa");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroEmpresa || e instanceof ErroArquivos) {
      const campos = e.campo ? { [e.campo]: e.message } : undefined;
      return { ok: false, codigo: e.codigo, mensagem: e.message, campos };
    }
    if (e instanceof z.ZodError) {
      // UF-02: erro de validação do servidor vai para o campo (caminho com ponto, ex.: endereco.cep).
      const campos = Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
      return { ok: false, codigo: "VALIDACAO", mensagem: "Confira os campos.", campos };
    }
    throw e;
  }
}

const versao = z.number().int().nullable();
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

/**
 * TL-102 "Salvar empresa" (FL-02 passo 2). O logo novo chega como comprovante do envio feito por
 * `POST /api/arquivos` (05 §3.1) e é conferido aqui, na mesma transação (SEG-53).
 */
export const salvarEmpresaAction = sessionAction
  .inputSchema(
    z.object({
      rowVersion: versao,
      logo: z.string().nullish(),
      razaoSocial: z.string(),
      cnpj: z.string(),
      telefone: z.string(),
      crea: z.string(),
      endereco,
    }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await salvarEmpresa(ctx.req, parsedInput, empresaDeps());
      return {};
    }),
  );

/** TL-102 "Salvar RT" (FL-02 passo 3). */
export const salvarRtAction = sessionAction
  .inputSchema(
    z.object({
      rowVersion: versao,
      nome: z.string(),
      titulo: z.string(),
      registro: z.string(),
      telefone: z.string(),
      email: z.string(),
      endereco,
    }),
  )
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      await salvarRt(ctx.req, parsedInput, empresaDeps());
      return {};
    }),
  );

/**
 * TL-103 "Enviar certificado" (FL-02 passos 4–6). Os bytes chegam em base64 e são lidos só em memória
 * (SEG-54); a resposta nunca traz arquivo nem senha (RN-121).
 */
export const enviarCertificadoAction = sessionAction
  .inputSchema(z.object({ nomeArquivo: z.string(), arquivo: z.string(), senha: z.string() }))
  .action(async ({ parsedInput, ctx }) =>
    executar(async () => {
      const r = await enviarCertificado(ctx.req, parsedInput, empresaDeps());
      return { titular: r.titular, aviso: r.aviso };
    }),
  );
