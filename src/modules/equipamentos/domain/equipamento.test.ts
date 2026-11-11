/** RN-046 / FL-07 passo 3: prévia da TAG antes de salvar. A TAG definitiva é testada na integração. */
import { describe, expect, it } from "vitest";
import { previaDaTag } from "./equipamento";

describe("prévia da TAG (FL-07 passo 3)", () => {
  it("{código}-{sigla}-NNN", () => {
    expect(previaDaTag("L012", "SPL")).toBe("L012-SPL-NNN");
  });
});
