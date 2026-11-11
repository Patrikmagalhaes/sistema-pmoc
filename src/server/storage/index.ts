import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getEnv } from "../env";

/**
 * Armazenamento de arquivos (05 §3.7). Em produção será o Supabase Storage (bucket privado); até o
 * projeto existir, o desenvolvimento usa uma pasta local com o mesmo desenho: URL de envio assinada,
 * de uso único e com prazo (SEG-50), e objeto nunca sobrescrito nem apagado (RN-126).
 */
export interface Armazenamento {
  /** URL para o navegador enviar o arquivo direto (PUT), aceitando até `tamanho` bytes do tipo `mime`. */
  urlDeEnvio(
    chave: string,
    o: { mime: string; tamanho: number; segundos: number },
  ): Promise<string>;
  /** Bytes gravados na chave, ou `null` se não existe. */
  ler(chave: string): Promise<Buffer | null>;
}

export type RecebimentoLocal = "OK" | "INVALIDO" | "EXPIRADO" | "JA_ENVIADO" | "TAMANHO" | "TIPO";

/** Armazenamento local: também recebe o PUT da URL de envio (rota `/api/arquivos/envio`). */
export interface ArmazenamentoLocal extends Armazenamento {
  receber(token: string, bytes: Uint8Array, mime: string): Promise<RecebimentoLocal>;
}

/** SEG-50: a chave vem do servidor (`{kind}/{yyyy}/{mm}/{uuid}.{ext}`); nada fora disso vira caminho. */
const FORMATO_CHAVE = /^[a-z_]+\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function armazenamentoLocal(
  dir: string,
  segredo: string,
  agora: () => number = Date.now,
): ArmazenamentoLocal {
  const chaveHmac = createHash("sha256").update(`armazenamento-local:${segredo}`).digest();
  const assinar = (carga: string) => createHmac("sha256", chaveHmac).update(carga).digest();
  const caminho = (chave: string) => {
    if (!FORMATO_CHAVE.test(chave)) throw new Error("Chave de armazenamento inválida.");
    return join(dir, chave);
  };

  return {
    async urlDeEnvio(chave, o) {
      caminho(chave);
      const carga = b64url(
        JSON.stringify({ k: chave, m: o.mime, n: o.tamanho, e: agora() + o.segundos * 1000 }),
      );
      return `/api/arquivos/envio?t=${carga}.${b64url(assinar(carga))}`;
    },

    async ler(chave) {
      try {
        return await readFile(caminho(chave));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },

    async receber(token, bytes, mime) {
      const [carga = "", assinatura = ""] = token.split(".");
      const esperada = assinar(carga);
      const recebida = Buffer.from(assinatura, "base64url");
      if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
        return "INVALIDO";
      }
      let t: { k: string; m: string; n: number; e: number };
      try {
        t = JSON.parse(Buffer.from(carga, "base64url").toString("utf8"));
      } catch {
        return "INVALIDO";
      }
      if (agora() > t.e) return "EXPIRADO";
      if (mime !== t.m) return "TIPO";
      if (bytes.length === 0 || bytes.length > t.n) return "TAMANHO";
      const p = caminho(t.k);
      await mkdir(dirname(p), { recursive: true });
      try {
        // `wx`: nunca sobrescreve; o segundo envio com o mesmo token é recusado (uso único).
        await writeFile(p, bytes, { flag: "wx" });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") return "JA_ENVIADO";
        throw e;
      }
      return "OK";
    },
  };
}

/** Produção sem Supabase configurado: falha (nunca grava em disco do servidor). */
export function armazenamentoNaoConfigurado(): Armazenamento {
  const falhar = async (): Promise<never> => {
    throw new Error("Armazenamento de produção ainda não configurado (Supabase Storage, 05 §3.7).");
  };
  return { urlDeEnvio: falhar, ler: falhar };
}

let shared: Armazenamento | undefined;

/** Instância única: local em desenvolvimento e teste; em produção, até o Supabase, recusa. */
export function getArmazenamento(): Armazenamento {
  if (!shared) {
    const env = getEnv();
    shared =
      process.env.NODE_ENV === "production"
        ? armazenamentoNaoConfigurado()
        : armazenamentoLocal(
            env.STORAGE_DEV_DIR ?? join(process.cwd(), "tmp", "armazenamento"),
            env.BETTER_AUTH_SECRET,
          );
  }
  return shared;
}

export const ehLocal = (a: Armazenamento): a is ArmazenamentoLocal => "receber" in a;
