/**
 * TL-007 – Verificar documento: pública, sem login (RN-187; 06 INT-14; decisão R2 2.8 b). O resultado
 * "encontrado" é coberto no teste de integração da emissão (precisa de PMOC emitido).
 */
import { expect, test } from "@playwright/test";

test("sem sessão: abre o formulário e recusa código fora do formato sem sair da tela", async ({
  page,
}) => {
  await page.goto("/verificar");
  await expect(page).toHaveURL(/\/verificar$/); // não manda para o login
  await expect(page.getByRole("heading", { name: "Verificar documento" })).toBeVisible();

  await page.getByLabel("Código de verificação").fill("abc-123");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText(/Código inválido/)).toBeVisible();
  await expect(page.getByLabel("Código de verificação")).toHaveValue("abc-123");
});

test("código no formato: vai para /verificar/{código} e informa que não existe", async ({
  page,
}) => {
  await page.goto("/verificar");
  await page.getByLabel("Código de verificação").fill("zzzz-zzzz-zzzz-zzzz-zzzz-zzzz-zz");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/verificar\/Z{26}$/);
  await expect(page.getByText(/Nenhum documento com este código/)).toBeVisible();
  await expect(page.getByText("ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZ")).toBeVisible();
});
