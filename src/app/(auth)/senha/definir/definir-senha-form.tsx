"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useHidratado } from "@/lib/use-hidratado";
import { definirSenhaAction } from "./actions";

const MIN = 8; // SEG-01; RN-180

/** E-01.4: sem formulário, só "Pedir novo link". */
export function LinkInvalido() {
  return (
    <>
      <Alert tom="danger">Link inválido ou expirado.</Alert>
      <Link
        href="/senha/esqueci"
        className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}
      >
        Pedir novo link
      </Link>
    </>
  );
}

export function DefinirSenhaForm() {
  const router = useRouter();
  const [erros, setErros] = useState<{ senha?: string; repetir?: string; geral?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const pronto = useHidratado();
  const [invalido, setInvalido] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const senha = String(f.get("senha") ?? "");
    const repetir = String(f.get("repetir") ?? "");
    // UF-01 / E-01.5: valida antes de enviar; o servidor revalida tudo (UF-02).
    if (senha.length < MIN) {
      setErros({ senha: `A senha precisa ter pelo menos ${MIN} caracteres.` });
      return (form.elements.namedItem("senha") as HTMLElement | null)?.focus();
    }
    if (senha !== repetir) {
      setErros({ repetir: "As senhas não são iguais." });
      return (form.elements.namedItem("repetir") as HTMLElement | null)?.focus();
    }
    setErros({});
    setEnviando(true);
    try {
      const r = await definirSenhaAction({ senha });
      const d = r?.data;
      if (d?.ok) return router.replace("/login?senha=alterada");
      if (d && !d.ok && d.erro === "LINK_INVALIDO") return setInvalido(true);
      if (d && !d.ok && d.erro === "SENHA") return setErros({ senha: d.mensagem });
      setErros({ geral: r?.serverError ?? "Não foi possível salvar. Tente novamente." });
    } catch {
      setErros({ geral: "Não foi possível salvar. Verifique a conexão e tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  if (invalido) return <LinkInvalido />;

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      {erros.geral && <Alert tom="danger">{erros.geral}</Alert>}
      <Field
        id="senha"
        label="Nova senha"
        erro={erros.senha}
        dica={`Mínimo de ${MIN} caracteres. Uma frase com algumas palavras é fácil de lembrar e difícil de adivinhar.`}
      >
        <PasswordInput name="senha" required autoComplete="new-password" />
      </Field>
      <Field id="repetir" label="Repetir senha" erro={erros.repetir}>
        <PasswordInput name="repetir" required autoComplete="new-password" />
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!pronto}
        loading={enviando}
      >
        {enviando ? "Salvando…" : "Salvar senha"}
      </Button>
    </form>
  );
}
