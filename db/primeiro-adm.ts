/**
 * Cria o primeiro ADM de um banco novo (runbook `docs/runbooks/primeiro-adm.md`).
 * Uso: pnpm adm:primeiro --nome "Nome Completo" --email pessoa@empresa.com.br
 * Recusa se já existe qualquer ADM. Não recebe senha: a pessoa recebe o link inicial por e-mail.
 */
import { parseArgs } from "node:util";
import { criarPrimeiroAdm, ErroAcesso } from "../src/modules/acesso";
import { getAuth } from "../src/server/auth";
import { getDatabase } from "../src/server/db";

const { values } = parseArgs({
  options: { nome: { type: "string" }, email: { type: "string" }, telefone: { type: "string" } },
});
if (!values.nome || !values.email) {
  console.error('Uso: pnpm adm:primeiro --nome "Nome Completo" --email pessoa@empresa.com.br');
  process.exit(2);
}

try {
  await criarPrimeiroAdm(
    { nome: values.nome, email: values.email, telefone: values.telefone ?? null },
    getAuth().deps,
  );
  // Sem imprimir o e-mail nem o link (LG-30 a LG-33).
  console.log("ADM criado. O link para definir a senha foi enviado por e-mail (vale 72 horas).");
} catch (e) {
  if (e instanceof ErroAcesso) {
    console.error(e.message);
    process.exitCode = 1;
  } else {
    console.error("Falhou:", e instanceof Error ? e.message : "erro desconhecido");
    process.exitCode = 1;
  }
} finally {
  await getDatabase().close();
}
