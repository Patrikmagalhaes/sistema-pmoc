import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra da aplicação para o certificado do RT (05 §3.13; DM-11; RNF-09): AES-256-GCM com a chave mestra
 * `CERT_ENCRYPTION_KEY`. O blob gravado é `versão (1) | iv (12) | tag (16) | cifrado`. O `aad` amarra o
 * blob à finalidade (ex.: arquivo vs. senha): trocar um pelo outro falha na decifragem.
 */

const VERSAO = 1;
const IV = 12;
const TAG = 16;

export interface ChaveCifra {
  /** `encryption_key_ref`: identifica a chave sem revelá-la (permite rotação). */
  ref: string;
  chave: Buffer;
}

/** Chave de 32 bytes em base64. `ref` = 16 primeiros hex do SHA-256 da chave. */
export function chaveDeBase64(b64: string): ChaveCifra {
  const chave = Buffer.from(b64, "base64");
  if (chave.length !== 32) throw new Error("A chave de cifra deve ter 32 bytes em base64.");
  return { ref: `sha256:${createHash("sha256").update(chave).digest("hex").slice(0, 16)}`, chave };
}

export function cifrar(c: ChaveCifra, dados: Uint8Array, aad: string): Buffer {
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", c.chave, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const cifrado = Buffer.concat([cipher.update(dados), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSAO]), iv, cipher.getAuthTag(), cifrado]);
}

/** Lança se o blob foi alterado, se a chave é outra ou se o `aad` não confere. */
export function decifrar(c: ChaveCifra, blob: Uint8Array, aad: string): Buffer {
  const b = Buffer.from(blob);
  if (b.length < 1 + IV + TAG || b[0] !== VERSAO) throw new Error("Blob cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", c.chave, b.subarray(1, 1 + IV));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(b.subarray(1 + IV, 1 + IV + TAG));
  return Buffer.concat([decipher.update(b.subarray(1 + IV + TAG)), decipher.final()]);
}
