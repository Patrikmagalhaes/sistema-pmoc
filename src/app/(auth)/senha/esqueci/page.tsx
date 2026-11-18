"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
      setErro("Não foi possível enviar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthCard
      titulo="Esqueci minha senha"
      descricao={enviado ? undefined : "Informe seu e-mail para receber o link de nova senha."}
    >
      {enviado ? (
        <Alert tom="success">Se o e-mail estiver cadastrado, você receberá um link.</Alert>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          {erro && <Alert tom="danger">{erro}</Alert>}
          <Field id="email" label="E-mail">
            <Input name="email" type="email" required autoComplete="username" />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!pronto}
            loading={enviando}
          >
            {enviando ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="self-center text-body">
        Voltar ao login
      </Link>
    </AuthCard>
  );
}
