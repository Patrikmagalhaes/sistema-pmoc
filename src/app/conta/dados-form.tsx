"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { salvarMeusDadosAction } from "./actions";

/** TL-005 – Seus dados: nome e telefone (LG-21). E-mail só pelo administrador (SEG-12). */
export function DadosForm(p: {
  rowVersion: number;
  nome: string;
  email: string;
  telefone: string | null;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(p.telefone ?? ""));
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") ?? "");
    const tel = telefone.replace(/\D/g, "");
    const err: Record<string, string> = {};
    if (!nome.trim()) err.nome = "Informe o nome.";
    if (tel && !/^[0-9]{10,11}$/.test(tel)) err.telefone = "Telefone com 10 ou 11 dígitos.";
    setErros(err);
    setMsg(null);
    if (Object.keys(err).length) return;
    setEnviando(true);
    try {
      const r = await salvarMeusDadosAction({ rowVersion: p.rowVersion, nome, telefone: tel });
      if (r?.serverError === "SESSAO_EXPIRADA")
        return window.location.assign("/login?voltar=%2Fconta");
      const d = r?.data;
      if (!d) return setMsg({ tipo: "erro", texto: r?.serverError ?? "Não foi possível salvar." });
      if (!d.ok) {
        if (d.campos) setErros(d.campos);
        return setMsg({ tipo: "erro", texto: d.mensagem });
      }
      setMsg({ tipo: "ok", texto: "Dados salvos." });
      router.refresh();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate className="formulario">
      {msg && (
        <div className={`alerta ${msg.tipo}`} role="status">
          {msg.texto}
        </div>
      )}
      <div className="campo">
        <label htmlFor="nome">Nome</label>
        <input id="nome" name="nome" defaultValue={p.nome} aria-invalid={Boolean(erros.nome)} />
        {erros.nome && <span className="erro">{erros.nome}</span>}
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" value={p.email} readOnly aria-describedby="email-dica" />
        <span className="dica" id="email-dica">
          Para trocar o e-mail, fale com o administrador.
        </span>
      </div>
      <div className="campo">
        <label htmlFor="telefone">Telefone (opcional)</label>
        <input
          id="telefone"
          name="telefone"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
          aria-invalid={Boolean(erros.telefone)}
        />
        {erros.telefone && <span className="erro">{erros.telefone}</span>}
      </div>
      <button
        className="botao"
        type="submit"
        disabled={!pronto || enviando}
        style={{ width: "auto" }}
      >
        {enviando ? "Salvando…" : "Salvar dados"}
      </button>
    </form>
  );
}
