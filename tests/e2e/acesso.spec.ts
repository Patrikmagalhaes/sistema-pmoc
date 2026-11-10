/**
 * Etapa 2 – FL-01 no navegador: TL-001 a TL-004 (04 §4.1, §4.5), estados SEM_ACESSO e SESSAO_EXPIRADA
 * (04 §1.2), RN-194 (ADM só acessa TL-004 até ativar o segundo fator) e SEG-16 (token fora da URL).
 */
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { E2E, usuario } from "./dados";

function totp(base32: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = (h[19] as number) & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const ultimoLink = () => {
  const arquivos = readdirSync(E2E.emailDir).sort();
  const texto = readFileSync(join(E2E.emailDir, arquivos.at(-1) as string), "utf8");
  return texto.match(/(\/senha\/definir\?token=[\w-]+)/)?.[1] as string;
};

let segredoAdm = "";

test("sem sessão: rota protegida leva ao login com retorno (SESSAO_EXPIRADA)", async ({ page }) => {
  await page.goto("/cliente");
  await expect(page).toHaveURL(/\/login\?voltar=%2Fcliente/);
  await expect(page.getByText("Sua sessão expirou. Entre de novo.")).toBeVisible();
});

test("E-01.1: senha errada mostra mensagem única", async ({ page }) => {
  await entrar(page, usuario("CLIENTE").email, "senha totalmente errada");
  await expect(page.locator(".alerta.erro")).toHaveText("E-mail ou senha incorretos.");
  await entrar(page, "ninguem@exemplo.test", "senha totalmente errada");
  await expect(page.locator(".alerta.erro")).toHaveText("E-mail ou senha incorretos.");
});

test("CLIENTE entra no portal e não acessa a administração (CA-01.3)", async ({ page }) => {
  const u = usuario("CLIENTE");
  await entrar(page, u.email, u.senha);
  await expect(page).toHaveURL(/\/cliente$/);
  await expect(page.getByText(u.nome)).toBeVisible();
  const r = await page.goto("/adm");
  expect(r?.status()).toBe(403);
  await expect(page.getByText("Você não tem acesso a esta página.")).toBeVisible();
});

test("TECNICO entra no app e volta para a rota pedida", async ({ page }) => {
  const u = usuario("TECNICO");
  await page.goto("/tecnico");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/tecnico$/);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/tecnico");
  await expect(page).toHaveURL(/\/login\?voltar=/);
});

test("RN-194: ADM sem segundo fator só acessa TL-004; ativa e recebe 10 códigos", async ({
  page,
}) => {
  const u = usuario("ADM");
  await entrar(page, u.email, u.senha);
  await expect(page).toHaveURL(/\/conta\/segundo-fator$/);
  await page.goto("/adm");
  await expect(page).toHaveURL(/\/conta\/segundo-fator$/);

  await page.getByLabel("Confirme sua senha").fill(u.senha);
  await page.getByRole("button", { name: "Continuar" }).click();
  segredoAdm = (await page.locator(".chave").textContent()) ?? "";
  expect(segredoAdm).toMatch(/^[A-Z2-7]+=*$/);

  await page.getByLabel("Código do aplicativo").fill("000000");
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await expect(page.locator(".alerta.erro")).toHaveText("Código incorreto.");

  await page.getByLabel("Código do aplicativo").fill(totp(segredoAdm));
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await expect(page.locator(".codigos li")).toHaveCount(10);
  const concluir = page.getByRole("button", { name: "Concluir" });
  await expect(concluir).toBeDisabled();
  await page.getByLabel("Guardei os códigos em local seguro").check();
  await concluir.click();
  await expect(page).toHaveURL(/\/adm$/);
  await expect(page.getByText(u.nome)).toBeVisible();
});

test("ADM com segundo fator: login pede o código do aplicativo", async ({ page }) => {
  test.skip(!segredoAdm, "depende do teste anterior");
  const u = usuario("ADM");
  await entrar(page, u.email, u.senha);
  await expect(page.getByLabel("Código do aplicativo autenticador")).toBeVisible();
  await page.getByLabel("Código do aplicativo autenticador").fill(totp(segredoAdm));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/adm$/);
  await page.goto("/conta/segundo-fator");
  await expect(page.getByText(/Segundo fator ativo desde \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
});

test("recuperação: resposta genérica, token sai da URL (SEG-16) e a nova senha funciona", async ({
  page,
}) => {
  const u = usuario("CLIENTE");
  await page.goto("/senha/esqueci");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(
    page.getByText("Se o e-mail estiver cadastrado, você receberá um link."),
  ).toBeVisible();

  await page.goto(ultimoLink());
  await expect(page).toHaveURL(/\/senha\/definir$/); // sem ?token=
  await page.getByLabel("Nova senha").fill("curta");
  await page.getByLabel("Repetir senha").fill("curta");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();

  await page.getByLabel("Nova senha").fill("nova frase da cliente");
  await page.getByLabel("Repetir senha").fill("nova frase da cliente");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(/\/login\?senha=alterada/);
  await expect(page.getByText("Senha alterada. Entre com a nova senha.")).toBeVisible();
  await entrar(page, u.email, "nova frase da cliente");
  await expect(page).toHaveURL(/\/cliente$/);
});

test("E-01.4: link inválido mostra só 'Pedir novo link'", async ({ page }) => {
  await page.goto("/senha/definir?token=token-que-nao-existe-123456");
  await expect(page).toHaveURL(/\/senha\/definir$/);
  await expect(page.getByText("Link inválido ou expirado.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir novo link" })).toBeVisible();
  await expect(page.getByLabel("Nova senha")).toHaveCount(0);
});
