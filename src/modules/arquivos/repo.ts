import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `arquivos` que fala com o banco. Sempre dentro de `withTransaction`. */

export interface NovoArquivo {
  kind: string;
  clienteId: string | null;
  chave: string;
  nomeOriginal: string | null;
  mime: string;
  tamanho: number;
  sha256: string;
}

/** `stored_file` é `[I]`: só `INSERT` (RN-126). */
export async function inserirArquivo(tx: Tx, a: NovoArquivo): Promise<string> {
  const r = await tx.execute(sql`INSERT INTO stored_file (kind, client_id, storage_key,
      original_filename, mime_type, size_bytes, sha256)
    VALUES (${a.kind}, ${a.clienteId}, ${a.chave}, ${a.nomeOriginal}, ${a.mime}, ${a.tamanho},
      ${a.sha256})
    RETURNING id`);
  return (r[0] as { id: string }).id;
}

export interface Arquivo {
  id: string;
  kind: string;
  clienteId: string | null;
  chave: string;
  mime: string;
}

/** A RLS limita o CLIENTE aos arquivos do próprio cliente (05 §4.2). */
export async function buscarArquivo(tx: Tx, id: string): Promise<Arquivo | null> {
  const r = await tx.execute(sql`SELECT id, kind, client_id AS "clienteId", storage_key AS chave,
      mime_type AS mime
    FROM stored_file WHERE id = ${id}`);
  return (r[0] as Arquivo | undefined) ?? null;
}
