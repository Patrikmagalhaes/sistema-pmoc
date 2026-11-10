"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
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
    setMsg(null);
    if (Object.keys(err).length) return;
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
        return setMsg({ tipo: "erro", texto: "Não foi possível trocar a senha. Tente novamente." });
      }
      form.reset();
      setMsg({ tipo: "ok", texto: "Senha alterada. As outras sessões foram encerradas." });
      router.refresh();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={trocar} noValidate className="formulario">
      {msg && (
        <div className={`alerta ${msg.tipo}`} role="status">
          {msg.texto}
        </div>
      )}
      <div className="campo">
        <label htmlFor="atual">Senha atual</label>
        <input
          id="atual"
          name="atual"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(erros.atual)}
        />
        {erro("atual")}
      </div>
      <div className="campo">
        <label htmlFor="nova">Nova senha</label>
        <input
          id="nova"
          name="nova"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(erros.nova)}
        />
        {erro("nova") ?? (
          <span className="dica">
            Mínimo de {MIN} caracteres. Uma frase com algumas palavras funciona bem.
          </span>
        )}
      </div>
      <div className="campo">
        <label htmlFor="repetir">Repetir nova senha</label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(erros.repetir)}
        />
        {erro("repetir")}
      </div>
      <button
        className="botao"
        type="submit"
        disabled={!pronto || enviando}
        style={{ width: "auto" }}
      >
        {enviando ? "Trocando…" : "Trocar senha"}
      </button>
    </form>
  );
}
