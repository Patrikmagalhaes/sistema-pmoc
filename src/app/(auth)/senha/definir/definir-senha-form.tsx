"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useHidratado } from "@/lib/use-hidratado";
import { definirSenhaAction } from "./actions";

const MIN = 8; // SEG-01; RN-180

/** E-01.4: sem formulário, só "Pedir novo link". */
export function LinkInvalido() {
  return (
    <>
      <div className="alerta erro" role="alert">
        Link inválido ou expirado.
      </div>
      <Link
        className="botao"
        href="/senha/esqueci"
        style={{ display: "block", textAlign: "center" }}
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
    const f = new FormData(e.currentTarget);
    const senha = String(f.get("senha") ?? "");
    const repetir = String(f.get("repetir") ?? "");
    // UF-01 / E-01.5: valida antes de enviar; o servidor revalida tudo (UF-02).
    if (senha.length < MIN)
      return setErros({ senha: `A senha precisa ter pelo menos ${MIN} caracteres.` });
    if (senha !== repetir) return setErros({ repetir: "As senhas não são iguais." });
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
      setErros({ geral: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  if (invalido) return <LinkInvalido />;

  return (
    <form onSubmit={salvar} noValidate>
      {erros.geral && (
        <div className="alerta erro" role="alert">
          {erros.geral}
        </div>
      )}
      <div className="campo">
        <label htmlFor="senha">Nova senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(erros.senha)}
          aria-describedby="senha-dica"
        />
        {erros.senha ? (
          <span className="erro">{erros.senha}</span>
        ) : (
          <span className="dica" id="senha-dica">
            Mínimo de {MIN} caracteres. Uma frase com algumas palavras é fácil de lembrar e difícil
            de adivinhar.
          </span>
        )}
      </div>
      <div className="campo">
        <label htmlFor="repetir">Repetir senha</label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(erros.repetir)}
        />
        {erros.repetir && <span className="erro">{erros.repetir}</span>}
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
