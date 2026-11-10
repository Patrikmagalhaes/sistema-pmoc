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
  await expect(page.getByAltText("QR code para o aplicativo autenticador")).toBeVisible();
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

// ---- TL-106 / TL-107 – gestão de usuários pelo ADM (FL-05) ------------------------------------

async function entrarAdm(page: Page) {
  const u = usuario("ADM");
  await entrar(page, u.email, u.senha);
  await page.getByLabel("Código do aplicativo autenticador").fill(totp(segredoAdm));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/adm$/);
}

test("isolamento: CLIENTE e TECNICO não abrem a gestão de usuários (CA-01.3)", async ({ page }) => {
  for (const perfil of ["CLIENTE", "TECNICO"] as const) {
    const u = usuario(perfil);
    await entrar(page, u.email, perfil === "CLIENTE" ? "nova frase da cliente" : u.senha);
    await expect(page).not.toHaveURL(/\/login/);
    for (const rota of ["/adm/usuarios", "/adm/usuarios/novo"]) {
      const r = await page.goto(rota);
      expect(r?.status(), `${perfil} ${rota}`).toBe(403);
    }
    await page
      .getByRole("button", { name: "Ir para o início" })
      .or(page.getByRole("link", { name: "Ir para o início" }))
      .click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("ADM cria técnico; o link inicial define a senha e o técnico entra (FL-05, DFT-01)", async ({
  page,
}) => {
  test.skip(!segredoAdm, "depende do segundo fator do ADM");
  await entrarAdm(page);
  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/adm\/usuarios$/);
  await page.getByRole("link", { name: "Novo usuário" }).click();

  await page.getByRole("button", { name: "Salvar" }).click(); // UF-01: valida antes de enviar
  await expect(page.getByText("Informe o nome.")).toBeVisible();

  await page.getByLabel("Nome").fill("Rafael Técnico Novo");
  await page.getByLabel("E-mail").fill("rafael.novo@exemplo.test");
  await page.getByLabel("Perfil").selectOption("TECNICO");
  await page.getByLabel("Telefone (opcional)").fill("11987654321");
  await expect(page.getByLabel("Telefone (opcional)")).toHaveValue("(11) 98765-4321"); // UF-03
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByText("Usuário criado. Enviamos o link para definir a senha."),
  ).toBeVisible();
  await expect(page.getByLabel("Perfil")).toBeDisabled(); // RN-179

  // E-mail repetido (E-05.1)
  await page.goto("/adm/usuarios/novo");
  await page.getByLabel("Nome").fill("Duplicado");
  await page.getByLabel("E-mail").fill("rafael.novo@exemplo.test");
  await page.getByLabel("Perfil").selectOption("TECNICO");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator(".campo .erro")).toHaveText("Este e-mail já está em uso.");

  // Lista com busca (UL-02: filtro na URL)
  await page.goto("/adm/usuarios");
  await page.getByLabel("Buscar").fill("rafael.novo");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/busca=rafael\.novo/);
  await expect(page.locator("tbody tr")).toHaveCount(1);

  // O técnico define a senha pelo link e entra
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(ultimoLink());
  await page.getByLabel("Nova senha").fill("frase do rafael novo");
  await page.getByLabel("Repetir senha").fill("frase do rafael novo");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await entrar(page, "rafael.novo@exemplo.test", "frase do rafael novo");
  await expect(page).toHaveURL(/\/tecnico$/);
});

test("ADM inativa com confirmação; o usuário perde o acesso; reativar devolve (RN-141, UF-09)", async ({
  page,
}) => {
  test.skip(!segredoAdm, "depende do segundo fator do ADM");
  await entrarAdm(page);
  await page.goto("/adm/usuarios?busca=rafael.novo");
  await page.getByRole("link", { name: "Rafael Técnico Novo" }).click();
  await page.getByRole("button", { name: "Inativar" }).click();
  await expect(page.getByText(/O usuário perde o acesso na hora/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar inativação" }).click();
  await expect(
    page.getByText("Usuário inativado. As sessões dele foram encerradas."),
  ).toBeVisible();
  await expect(page.locator(".titulo-pagina .etiqueta")).toContainText("Inativo");

  // Inativo some da lista padrão (UL-03) e aparece com o filtro
  await page.goto("/adm/usuarios?busca=rafael.novo");
  await expect(page.getByText("Nenhum resultado para os filtros.")).toBeVisible();
  await page.goto("/adm/usuarios?busca=rafael.novo&situacao=INATIVO");
  await expect(page.locator("tbody tr")).toHaveCount(1);

  // Próprio ADM: "Inativar" desabilitado (E-05.2)
  await page.goto(`/adm/usuarios?busca=${encodeURIComponent(usuario("ADM").email)}&situacao=TODOS`);
  await page.getByRole("link", { name: usuario("ADM").nome }).click();
  await expect(page.getByRole("button", { name: "Inativar" })).toBeDisabled();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrar(page, "rafael.novo@exemplo.test", "frase do rafael novo");
  await expect(page.locator(".alerta.erro")).toHaveText("E-mail ou senha incorretos."); // E-01.2

  await entrarAdm(page);
  await page.goto("/adm/usuarios?busca=rafael.novo&situacao=INATIVO");
  await page.getByRole("link", { name: "Rafael Técnico Novo" }).click();
  await page.getByRole("button", { name: "Reativar" }).click();
  await expect(page.getByText("Usuário reativado.")).toBeVisible();
});
