/** 05 §3.13 / DM-11: AES-256-GCM do certificado do RT (RNF-09, RN-121). */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chaveDeBase64, cifrar, decifrar } from "./index";

const chave = chaveDeBase64(randomBytes(32).toString("base64"));

describe("cifra do certificado", () => {
  it("ida e volta; cada cifragem usa um iv novo", () => {
    const dados = Buffer.from("conteúdo do pfx");
    const a = cifrar(chave, dados, "rt_certificate:pkcs12");
    const b = cifrar(chave, dados, "rt_certificate:pkcs12");
    expect(a.equals(b)).toBe(false);
    expect(a.includes(dados)).toBe(false);
    expect(decifrar(chave, a, "rt_certificate:pkcs12").equals(dados)).toBe(true);
  });

  it("outra finalidade (aad), outra chave ou blob alterado falham", () => {
    const blob = cifrar(chave, Buffer.from("senha"), "rt_certificate:senha");
    expect(() => decifrar(chave, blob, "rt_certificate:pkcs12")).toThrow();
    const outra = chaveDeBase64(randomBytes(32).toString("base64"));
    expect(() => decifrar(outra, blob, "rt_certificate:senha")).toThrow();
    const alterado = Buffer.from(blob);
    alterado[alterado.length - 1] = (alterado.at(-1) ?? 0) ^ 1;
    expect(() => decifrar(chave, alterado, "rt_certificate:senha")).toThrow();
  });

  it("a referência identifica a chave sem revelá-la; chave fora de 32 bytes é recusada", () => {
    expect(chave.ref).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(chave.ref).not.toContain(chave.chave.toString("hex").slice(0, 16));
    expect(() => chaveDeBase64(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
