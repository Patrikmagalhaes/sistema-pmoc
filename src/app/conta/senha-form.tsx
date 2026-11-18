"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { avisar } from "@/components/ui/toaster";
import { authClient } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

const MIN = 8; // SEG-01

/**
 * TL-005 – Trocar senha. A biblioteca revoga as outras sessões (SEG-04, forçado no servidor), grava
 * `SENHA_ALTERADA` e envia o e-mail de segurança (SEG-19).
 */
export function SenhaForm() {
  const router = useRouter();
  const pronto = useHidratado();
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function trocar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const atual = String(f.get("atual") ?? "");
    const nova = String(f.get("nova") ?? "");
    const repetir = String(f.get("repetir") ?? "");
    const err: Record<string, string> = {};
    if (!atual) err.atual = "Informe a senha atual.";
    if (nova.length < MIN) err.nova = `A senha precisa ter pelo menos ${MIN} caracteres.`;
    else if (nova !== repetir) err.repetir = "As senhas não são iguais.";
    setErros(err);
    setErro(null);
    const primeiro = Object.keys(err)[0];
    if (primeiro) return (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
    setEnviando(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: atual,
        newPassword: nova,
        revokeOtherSessions: true,
      });
      if (error) {
        if (error.code === "INVALID_PASSWORD") return setErros({ atual: "Senha atual incorreta." });
        if (error.status === 400 && error.message) return setErros({ nova: error.message });
        if (error.status === 401) return window.location.assign("/login?voltar=%2Fconta");
        return setErro("Não foi possível trocar a senha. Tente novamente.");
      }
      form.reset();
      avisar.sucesso("Senha alterada. As outras sessões foram encerradas.");
      router.refresh();
    } catch {
      setErro("Não foi possível trocar a senha. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={trocar} noValidate aria-labelledby="titulo-senha">
      <Card
        titulo={<span id="titulo-senha">Senha</span>}
        descricao="Ao trocar, as outras sessões abertas são encerradas."
        rodape={
          <Button type="submit" variant="secondary" disabled={!pronto} loading={enviando}>
            {enviando ? "Trocando…" : "Trocar senha"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {erro && <Alert tom="danger">{erro}</Alert>}
          <Field id="atual" label="Senha atual" erro={erros.atual}>
            <PasswordInput name="atual" autoComplete="current-password" />
          </Field>
          <Field
            id="nova"
            label="Nova senha"
            erro={erros.nova}
            dica={`Mínimo de ${MIN} caracteres. Uma frase com algumas palavras funciona bem.`}
          >
            <PasswordInput name="nova" autoComplete="new-password" />
          </Field>
          <Field id="repetir" label="Repetir nova senha" erro={erros.repetir}>
            <PasswordInput name="repetir" autoComplete="new-password" />
          </Field>
        </div>
      </Card>
    </form>
  );
}
