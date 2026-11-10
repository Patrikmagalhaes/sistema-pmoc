"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

/** TL-002 – Esqueci minha senha (FL-01 recuperação). A resposta nunca revela se o e-mail existe (SEG-08). */
export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pronto = useHidratado();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/senha/definir",
      });
      // 429 (limite por IP, SEG-61) também recebe a resposta genérica.
      if (error && error.status !== 429)
        return setErro("Não foi possível enviar. Tente novamente.");
      setEnviado(true);
    } catch {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="centro">
      <div className="cartao">
        <h1>Esqueci minha senha</h1>
        {enviado ? (
          <div className="alerta ok" role="status">
            Se o e-mail estiver cadastrado, você receberá um link.
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            {erro && (
              <div className="alerta erro" role="alert">
                {erro}
              </div>
            )}
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <button className="botao" type="submit" disabled={!pronto || enviando}>
              {enviando ? "Enviando…" : "Enviar link"}
            </button>
          </form>
        )}
        <div className="links">
          <Link href="/login">Voltar ao login</Link>
        </div>
      </div>
    </main>
  );
}
