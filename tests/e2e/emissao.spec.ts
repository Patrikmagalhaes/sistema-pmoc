/**
 * Etapa 4 – emissão do PMOC no navegador, do rascunho à verificação pública (FL-08; TL-120, TL-121,
 * TL-007; RF-12, RF-13; RN-009, RN-016, RN-171, RN-187; E-08.7; INT-14).
 *
 * Independente do acesso.spec: usa o ADM próprio da emissão (ativa o segundo fator aqui) e o PMOC em
 * rascunho que o servidor de E2E cria com `popularDemo` (empresa, RT, certificado A1 de teste,
 * 4 equipamentos e contrato de 12 meses).
 */
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { textoDasPaginas } from "../pdf/texto";
import { E2E, usuarioPorEmail } from "./dados";
import type { DadosDeDemo } from "./demo-dados";
import { totp } from "./totp";

const adm = usuarioPorEmail("adm.emissao.e2e@exemplo.test");

/** FL-01 + RN-194: o ADM novo entra, ativa o segundo fator na TL-004 e chega à área do ADM. */
async function entrarAtivandoSegundoFator(page: Page) {
  await page.setExtraHTTPHeaders({ "x-real-ip": "10.9.0.1" }); // IP próprio (SEG-60)
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adm.email);
  await page.getByLabel("Senha", { exact: true }).fill(adm.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/conta\/segundo-fator$/);
  await page.getByLabel("Confirme sua senha").fill(adm.senha);
  await page.getByRole("button", { name: "Continuar" }).click();
  const segredo = (await page.locator('[data-slot="chave"]').textContent()) ?? "";
  await page.getByLabel("Código do aplicativo").fill(totp(segredo));
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await page.getByLabel("Guardei os códigos em local seguro").check();
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page).toHaveURL(/\/adm$/);
}

test("FL-08: emite o PMOC, baixa o PDF assinado e o código confere na verificação pública", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000); // PDF gerado e assinado de forma síncrona, com `next dev` compilando
  const demo = JSON.parse(readFileSync(E2E.demoFile, "utf8")) as DadosDeDemo;
  await entrarAtivandoSegundoFator(page);

  await page.goto(`/adm/pmocs/${demo.pmocId}`);
  await expect(page.getByRole("link", { name: "Versões e assinaturas" })).toBeVisible();
  const dialogo = page.getByRole("dialog");

  await test.step("TL-121: verificação sem pendências mostra o resumo e o aviso E-08.9", async () => {
    await page.getByRole("button", { name: "Emitir PMOC" }).click();
    await expect(dialogo.getByText("Após emitir, o PDF é assinado pelo RT")).toBeVisible();
    await expect(dialogo.getByText("Equipamentos")).toBeVisible();
    await expect(dialogo.getByText("Visitas a criar")).toBeVisible();
  });

  await test.step("RF-12, RF-13: emitir gera e assina o PDF (E-08.7 até concluir)", async () => {
    await dialogo.getByRole("button", { name: "Emitir", exact: true }).click();
    await expect(dialogo.getByText(/PMOC emitido – versão 1\./)).toBeVisible({ timeout: 240_000 });
  });

  const href = (await dialogo.getByRole("link", { name: "Baixar PDF" }).getAttribute("href")) ?? "";
  expect(href).toMatch(/^\/api\/arquivos\/[0-9a-f-]{36}$/);

  let codigo = "";
  await test.step("RN-171: o PDF assinado é servido ao ADM, com o código de verificação impresso", async () => {
    const r = await page.request.get(href);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    const pdf = Buffer.from(await r.body());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const texto = (await textoDasPaginas(pdf)).join("\n");
    codigo = /Código de verificação: ([0-9A-Z-]+)/.exec(texto)?.[1] ?? "";
    expect(codigo.replaceAll("-", "")).toHaveLength(26); // RN-187
  });

  await test.step("RN-016: a aba Versões mostra a v1 como atual", async () => {
    await dialogo.getByText("Fechar", { exact: true }).click(); // o do rodapé (o X do título também é "Fechar")
    await expect(dialogo).toHaveCount(0);
    await page.goto(`/adm/pmocs/${demo.pmocId}?aba=versoes`);
    const linha = page.getByRole("table", { name: "Versões do PMOC" }).locator("tbody tr").first();
    await expect(linha).toContainText("v1");
    await expect(linha).toContainText("atual");
    await expect(page.getByRole("button", { name: "Emitir PMOC" })).toHaveCount(0);
  });

  await test.step("TL-007 e INT-14: sem login, o código mostra o documento sem dado do cliente", async () => {
    const anonimo = await browser.newContext();
    try {
      const p = await anonimo.newPage();
      expect((await p.request.get(href)).status()).toBe(401); // o PDF exige sessão
      await p.goto(`/verificar/${codigo}`);
      await expect(p.getByText("Documento emitido por este sistema.")).toBeVisible();
      await expect(p.getByText("Vigente", { exact: true })).toBeVisible();
      await expect(p.getByText("v1", { exact: true })).toBeVisible();
      await expect(
        p.getByText(/Hospital Demonstração|Unidade Centro|Jose da Conceicao/),
      ).toHaveCount(0);
    } finally {
      await anonimo.close();
    }
  });
});
