"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient, mensagemDeLogin } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

type Etapa = "senha" | "codigo" | "recuperacao";

/** TL-001: e-mail e senha; para ADM com segundo fator, o código aparece depois (RN-194). */
export function LoginForm({ voltar }: { voltar: string | null }) {
  const [etapa, setEtapa] = useState<Etapa>("senha");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pronto = useHidratado();

  // O servidor decide o destino de cada perfil (04 §1.1 regra 1); recarga completa leva o cookie novo.
  const concluir = () => window.location.assign(voltar ?? "/");

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: String(f.get("email") ?? "").trim(),
        password: String(f.get("senha") ?? ""),
      });
      if (error) return setErro(mensagemDeLogin(error.status, "senha"));
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return setEtapa("codigo");
      concluir();
    } catch {
      setErro(mensagemDeLogin(undefined, "senha"));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("codigo") ?? "").trim();
    setErro(null);
    setEnviando(true);
    try {
      const { error } =
        etapa === "codigo"
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
      if (error) return setErro(mensagemDeLogin(error.status, "codigo"));
      concluir();
    } catch {
      setErro(mensagemDeLogin(undefined, "codigo"));
    } finally {
      setEnviando(false);
    }
  }

  const alerta = erro && <Alert tom="danger">{erro}</Alert>;

  if (etapa !== "senha") {
    const totp = etapa === "codigo";
    return (
      // `key`: sem ela o React reaproveita o <input> do e-mail e o código nasce preenchido.
      <form key={etapa} onSubmit={confirmarCodigo} noValidate className="flex flex-col gap-4">
        {alerta}
        <Field
          id="codigo"
          label={totp ? "Código do aplicativo autenticador" : "Código de recuperação"}
          dica={totp ? "Os 6 dígitos que aparecem no aplicativo." : undefined}
        >
          <Input
            name="codigo"
            required
            autoComplete="one-time-code"
            inputMode={totp ? "numeric" : "text"}
            pattern={totp ? "[0-9]{6}" : undefined}
            maxLength={totp ? 6 : 32}
            className="tabular-nums"
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!pronto}
          loading={enviando}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
        <Button
          variant="tertiary"
          className="self-center"
          onClick={() => {
            setErro(null);
            setEtapa(totp ? "recuperacao" : "codigo");
          }}
        >
          {totp ? "Usar código de recuperação" : "Usar o aplicativo autenticador"}
        </Button>
      </form>
    );
  }

  return (
    <form key="senha" onSubmit={entrar} noValidate className="flex flex-col gap-4">
      {alerta}
      <Field id="email" label="E-mail">
        <Input name="email" type="email" required autoComplete="username" />
      </Field>
      <Field id="senha" label="Senha">
        <PasswordInput name="senha" required autoComplete="current-password" />
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!pronto}
        loading={enviando}
      >
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
      <Link href="/senha/esqueci" className="self-center text-body">
        Esqueci minha senha
      </Link>
    </form>
  );
}
