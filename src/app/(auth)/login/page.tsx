import { redirect } from "next/navigation";
import { retornoSeguro, sessaoAtual } from "@/server/auth/sessao";
import { LoginForm } from "./login-form";

export const runtime = "nodejs";
export const metadata = { title: "Entrar – Sistema PMOC" };

/** TL-001 – Login (04 §4.1; FL-01). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const voltar = retornoSeguro(typeof sp.voltar === "string" ? sp.voltar : null);
  // Já logado: segue direto para o destino.
  if ((await sessaoAtual()).estado !== "ANONIMO") redirect(voltar ?? "/");
  return (
    <main className="centro">
      <div className="cartao">
        <h1>Entrar</h1>
        {voltar && !sp.senha && (
          <div className="alerta erro" role="status">
            Sua sessão expirou. Entre de novo.
          </div>
        )}
        {sp.senha === "alterada" && (
          <div className="alerta ok" role="status">
            Senha alterada. Entre com a nova senha.
          </div>
        )}
        <LoginForm voltar={voltar} />
      </div>
    </main>
  );
}
