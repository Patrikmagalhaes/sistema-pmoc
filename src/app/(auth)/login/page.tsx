import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { retornoSeguro, sessaoAtual } from "@/server/auth/sessao";
import { LoginForm } from "./login-form";

export const runtime = "nodejs";
export const metadata = { title: "Entrar – Sistema PMOC" };

/** TL-001 – Login (04 §4.1; FL-01). Template T-AUTH (doc 08 §4.3). */
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
    <AuthCard titulo="Entrar">
      {voltar && !sp.senha && <Alert tom="warning">Sua sessão expirou. Entre de novo.</Alert>}
      {sp.senha === "alterada" && (
        <Alert tom="success">Senha alterada. Entre com a nova senha.</Alert>
      )}
      <LoginForm voltar={voltar} />
    </AuthCard>
  );
}
