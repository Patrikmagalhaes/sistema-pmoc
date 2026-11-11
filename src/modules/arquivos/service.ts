import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { can } from "@/modules/autorizacao";
import type { RequestContext } from "@/server/context";
import type { Database, Tx } from "@/server/db";
import type { Armazenamento } from "@/server/storage";
import {
  assinaturaConfere,
  chaveDoObjeto,
  conferirEnvio,
  FINALIDADES,
  type Finalidade,
  PRAZO_ENVIO_S,
  SHA256,
} from "./domain/arquivos";
import * as repo from "./repo";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroArquivos extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "VALIDACAO"
      | "ENVIO_INVALIDO"
      | "NAO_RECEBIDO"
      | "DIVERGENTE",
    message: string,
    readonly campo?: string,
  ) {
    super(message);
  }
}

export interface ArquivosDeps {
  db: Database;
  armazenamento: Armazenamento;
  /** Assina o comprovante de envio (o servidor não guarda envio pendente). */
  segredo: string;
}

/** Quem pode enviar e ler cada finalidade (RF-03). */
const PERMISSAO: Record<Finalidade, "empresa.gerenciar"> = { LOGO_EMPRESA: "empresa.gerenciar" };

const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** O que o servidor decidiu no preparo; volta assinado e é conferido na confirmação. */
interface Comprovante {
  f: Finalidade;
  k: string;
  m: string;
  n: number;
  h: string;
  o: string | null;
  u: string | null;
  e: number;
}

const hmac = (segredo: string, carga: string) =>
  createHmac("sha256", createHash("sha256").update(`arquivos:${segredo}`).digest())
    .update(carga)
    .digest();

function assinarComprovante(segredo: string, c: Comprovante): string {
  const carga = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${carga}.${hmac(segredo, carga).toString("base64url")}`;
}

function lerComprovante(segredo: string, token: string): Comprovante | null {
  const [carga = "", assinatura = ""] = token.split(".");
  const esperada = hmac(segredo, carga);
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    return JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as Comprovante;
  } catch {
    return null;
  }
}

export interface PreparoEnvio {
  /** PUT do navegador direto no armazenamento (SEG-50). */
  url: string;
  /** Entregue de volta na confirmação (ex.: ao salvar a empresa). */
  comprovante: string;
}

/**
 * SEG-50 a SEG-52: confere finalidade, tipo e tamanho declarados, decide a chave e devolve a URL de
 * envio de uso único. Nada é gravado no banco até a confirmação.
 */
export async function prepararEnvio(
  ctx: RequestContext,
  input: {
    finalidade: Finalidade;
    nome: string | null;
    mime: string;
    tamanho: number;
    sha256: string;
  },
  deps: ArquivosDeps,
  agora = new Date(),
): Promise<PreparoEnvio> {
  if (!(input.finalidade in FINALIDADES)) {
    throw new ErroArquivos("VALIDACAO", "Finalidade de arquivo desconhecida.");
  }
  if (!can(ctx, PERMISSAO[input.finalidade])) {
    throw new ErroArquivos("SEM_PERMISSAO", "Sem permissão para enviar este arquivo.");
  }
  const problema = conferirEnvio(input.finalidade, input.mime, input.tamanho);
  if (problema) throw new ErroArquivos("VALIDACAO", problema, "arquivo");
  if (!SHA256.test(input.sha256))
    throw new ErroArquivos("VALIDACAO", "Resumo do arquivo inválido.");
  const chave = chaveDoObjeto(input.finalidade, input.mime, agora, randomUUID());
  const url = await deps.armazenamento.urlDeEnvio(chave, {
    mime: input.mime,
    tamanho: input.tamanho,
    segundos: PRAZO_ENVIO_S,
  });
  // Nome original só para `original_filename` (SEG-50), cortado.
  const nome = input.nome?.trim().slice(0, 200) || null;
  const comprovante = assinarComprovante(deps.segredo, {
    f: input.finalidade,
    k: chave,
    m: input.mime,
    n: input.tamanho,
    h: input.sha256,
    o: nome,
    u: ctx.userId,
    e: agora.getTime() + PRAZO_ENVIO_S * 1000,
  });
  return { url, comprovante };
}

/**
 * SEG-53 / INT-11: confere o objeto gravado (tamanho, `sha256` calculado aqui e assinatura do formato)
 * e grava `stored_file` na transação de quem chama (MOD-05a). Divergente: não grava nem referencia.
 * `finalidade` é a que quem chama espera (o logo não vira outra coisa).
 */
export async function confirmarEnvioNaTransacao(
  tx: Tx,
  ctx: RequestContext,
  comprovante: string,
  finalidade: Finalidade,
  deps: ArquivosDeps,
  agora = new Date(),
): Promise<{ id: string }> {
  const c = lerComprovante(deps.segredo, comprovante);
  if (!c || c.f !== finalidade || c.u !== ctx.userId || agora.getTime() > c.e) {
    throw new ErroArquivos(
      "ENVIO_INVALIDO",
      "Envio inválido ou expirado. Escolha o arquivo de novo.",
      "arquivo",
    );
  }
  if (!can(ctx, PERMISSAO[c.f])) {
    throw new ErroArquivos("SEM_PERMISSAO", "Sem permissão para enviar este arquivo.");
  }
  const bytes = await deps.armazenamento.ler(c.k);
  if (!bytes) {
    throw new ErroArquivos(
      "NAO_RECEBIDO",
      "O arquivo não chegou. Escolha o arquivo de novo.",
      "arquivo",
    );
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== c.n || sha256 !== c.h || !assinaturaConfere(c.f, c.m, bytes)) {
    throw new ErroArquivos("DIVERGENTE", FINALIDADES[c.f].mensagem, "arquivo");
  }
  const id = await repo.inserirArquivo(tx, {
    kind: c.f,
    clienteId: null,
    chave: c.k,
    nomeOriginal: c.o,
    mime: c.m,
    tamanho: bytes.length,
    sha256,
  });
  return { id };
}

/**
 * `/api/arquivos/:id` (05 §3.7; RN-171): confere a permissão e devolve os bytes. `null` = não existe ou
 * sem acesso (404, RN-162). Na Etapa 3 só o logo é servido; as demais finalidades entram com as etapas
 * delas, cada uma com a sua regra de acesso.
 */
export async function lerArquivo(
  ctx: RequestContext,
  id: string,
  deps: ArquivosDeps,
): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!ehUuid(id)) return null;
  const a = await deps.db.withTransaction(ctx, (tx) => repo.buscarArquivo(tx, id));
  if (a?.kind !== "LOGO_EMPRESA" || !can(ctx, PERMISSAO.LOGO_EMPRESA)) return null;
  const bytes = await deps.armazenamento.ler(a.chave);
  return bytes ? { mime: a.mime, bytes } : null;
}
