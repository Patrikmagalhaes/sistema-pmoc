"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { authClient, mensagemDeLogin } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

type Etapa = "senha" | "codigo" | "recuperacao";

/** TL-001: e-mail e senha; para ADM com segundo fator, o código aparece depois (RN-194). */
export function LoginForm({ voltar }: { voltar: string | null }) {
  const [etapa, setEtapa] = useState<Etapa>("senha");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pronto = useHidratado();
  const [mostrarSenha, setMostrarSenha] = useState(false);

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

  const alerta = erro && (
    <div className="alerta erro" role="alert">
      {erro}
    </div>
  );

  if (etapa !== "senha") {
    const totp = etapa === "codigo";
    return (
      <form onSubmit={confirmarCodigo} noValidate>
        {alerta}
        <div className="campo">
          <label htmlFor="codigo">
            {totp ? "Código do aplicativo autenticador" : "Código de recuperação"}
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            autoComplete="one-time-code"
            inputMode={totp ? "numeric" : "text"}
            pattern={totp ? "[0-9]{6}" : undefined}
            maxLength={totp ? 6 : 32}
          />
        </div>
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        <div className="links">
          <button
            type="button"
            className="botao secundario"
            onClick={() => {
              setErro(null);
              setEtapa(totp ? "recuperacao" : "codigo");
            }}
          >
            {totp ? "Usar código de recuperação" : "Usar o aplicativo autenticador"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={entrar} noValidate>
      {alerta}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          name="senha"
          type={mostrarSenha ? "text" : "password"}
          required
          autoComplete="current-password"
        />
        <label style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={mostrarSenha}
            onChange={(e) => setMostrarSenha(e.target.checked)}
          />{" "}
          Mostrar senha
        </label>
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <div className="links">
        <Link href="/senha/esqueci">Esqueci minha senha</Link>
      </div>
    </form>
  );
}
