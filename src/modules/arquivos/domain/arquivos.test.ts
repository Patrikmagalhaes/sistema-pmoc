/** Regras puras de arquivo (06 SEG-50 a SEG-53; E-02.2). */
import { describe, expect, it } from "vitest";
import {
  assinaturaConfere,
  chaveDoArquivoGerado,
  chaveDoObjeto,
  conferirEnvio,
  FINALIDADES,
  SHA256,
} from "./arquivos";

const MAX_LOGO = FINALIDADES.LOGO_EMPRESA.tamanhoMax;
const MSG_LOGO = FINALIDADES.LOGO_EMPRESA.mensagem;

describe("SEG-51 / SEG-52: tipo e tamanho do envio", () => {
  it("PNG e JPEG até o limite são aceitos", () => {
    expect(conferirEnvio("LOGO_EMPRESA", "image/png", 1)).toBeNull();
    expect(conferirEnvio("LOGO_EMPRESA", "image/jpeg", MAX_LOGO)).toBeNull();
  });

  it("SVG e outros tipos são recusados com a mensagem E-02.2", () => {
    expect(conferirEnvio("LOGO_EMPRESA", "image/svg+xml", 10)).toBe(MSG_LOGO);
    expect(conferirEnvio("LOGO_EMPRESA", "application/pdf", 10)).toBe(MSG_LOGO);
  });

  it("arquivo vazio ou acima do limite é recusado", () => {
    expect(conferirEnvio("LOGO_EMPRESA", "image/png", 0)).toBe(MSG_LOGO);
    expect(conferirEnvio("LOGO_EMPRESA", "image/png", MAX_LOGO + 1)).toBe(MSG_LOGO);
  });
});

describe("SEG-50: chave do objeto gerada pelo servidor", () => {
  const agora = new Date("2026-03-05T12:00:00Z");
  const uuid = "0b8f4a52-7d1e-4c3a-9f60-2a1d5e8c7b90";

  it("{kind}/{yyyy}/{mm}/{uuid}.{ext}, mês com dois dígitos", () => {
    expect(chaveDoObjeto("LOGO_EMPRESA", "image/png", agora, uuid)).toBe(
      `logo_empresa/2026/03/${uuid}.png`,
    );
    expect(chaveDoObjeto("LOGO_EMPRESA", "image/jpeg", agora, uuid)).toBe(
      `logo_empresa/2026/03/${uuid}.jpg`,
    );
  });

  it("usa o mês em UTC (virada do mês no fuso de São Paulo)", () => {
    const viradaUtc = new Date("2026-04-01T01:00:00Z"); // 31/03 22:00 em São Paulo
    expect(chaveDoObjeto("LOGO_EMPRESA", "image/png", viradaUtc, uuid)).toMatch(
      /^logo_empresa\/2026\/04\//,
    );
  });

  it("tipo não aceito não gera chave", () => {
    expect(() => chaveDoObjeto("LOGO_EMPRESA", "image/svg+xml", agora, uuid)).toThrow(
      "Tipo de arquivo não aceito.",
    );
  });

  it("arquivo gerado no servidor segue a mesma forma", () => {
    expect(chaveDoArquivoGerado("PMOC_PDF", new Date("2026-11-27T10:00:00Z"), uuid)).toBe(
      `pmoc_pdf/2026/11/${uuid}.pdf`,
    );
  });
});

describe("SEG-53: primeiros bytes conferem com o tipo declarado", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);

  it("PNG e JPEG verdadeiros conferem", () => {
    expect(assinaturaConfere("LOGO_EMPRESA", "image/png", png)).toBe(true);
    expect(assinaturaConfere("LOGO_EMPRESA", "image/jpeg", jpeg)).toBe(true);
  });

  it("conteúdo de outro formato, curto demais ou tipo não aceito não confere", () => {
    expect(assinaturaConfere("LOGO_EMPRESA", "image/png", jpeg)).toBe(false);
    expect(assinaturaConfere("LOGO_EMPRESA", "image/png", png.slice(0, 2))).toBe(false);
    expect(assinaturaConfere("LOGO_EMPRESA", "image/svg+xml", png)).toBe(false);
  });
});

describe("hash do arquivo", () => {
  it("SHA-256 em hexadecimal minúsculo com 64 caracteres", () => {
    expect(SHA256.test("a".repeat(64))).toBe(true);
    expect(SHA256.test("A".repeat(64))).toBe(false);
    expect(SHA256.test("a".repeat(63))).toBe(false);
  });
});
