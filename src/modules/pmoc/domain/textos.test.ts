/**
 * Anexo 1 do PMOC (RF-12.2; DEC-19). Rascunho [A VALIDAR] autorizado em 18/11/2026 (auditoria-final
 * §6): impresso com o aviso e com os erros C1 a C3 da transcrição antiga corrigidos (análise C4).
 */
import { describe, expect, it } from "vitest";
import { ANEXO1 } from "./textos";

describe("Anexo 1: Portaria MS 3.523/1998 (rascunho)", () => {
  it("tem versão, que vai no retrato da emissão", () => {
    expect(ANEXO1.versao).toBe("rascunho-1");
    expect(ANEXO1.titulo).toContain("3.523");
  });

  it("o primeiro parágrafo é o aviso [A VALIDAR], impresso no PDF", () => {
    expect(ANEXO1.paragrafos[0]).toMatch(/^\[A VALIDAR/);
  });

  it("C1: o texto do Art. 2º não se repete dentro do Art. 6º", () => {
    const inicioArt2 = "Determinar que serão objeto de Regulamento Técnico";
    expect(ANEXO1.paragrafos.filter((p) => p.includes(inicioArt2))).toHaveLength(1);
  });

  it('C2: sem o "a. a." no Art. 5º', () => {
    expect(ANEXO1.paragrafos.some((p) => p.includes("a. a."))).toBe(false);
  });

  it("C3: uma nota avisa que os Anexos I e II não são reproduzidos", () => {
    expect(ANEXO1.paragrafos.at(-1)).toMatch(/^Nota: os Anexos I e II .* não são reproduzidos/);
  });

  it("artigos 1º a 10 em ordem, uma vez cada", () => {
    const artigos = ANEXO1.paragrafos
      .map((p) => /^Art\. (\d+)/.exec(p)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);
    expect(artigos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
