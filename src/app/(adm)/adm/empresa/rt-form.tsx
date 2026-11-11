"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { chamarAcao } from "@/lib/chamar-acao";
import type { Endereco } from "@/lib/endereco";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { salvarRtAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface RtEditavel {
  rowVersion: number;
  nome: string;
  titulo: string;
  registro: string;
  telefone: string;
  email: string;
  endereco: Endereco;
}

/** TL-102 seção Responsável técnico (RF-04.3; DEC-29; FL-02 passo 3). */
export function RtForm({ rt }: { rt: RtEditavel | null }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(rt?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, true);
    const t = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      nome: t("nome"),
      titulo: t("titulo"),
      registro: t("registro"),
      telefone: telefone.replace(/\D/g, ""),
      email: t("email"),
      endereco,
    };
    if (!dados.nome) e.nome = "Informe o nome do RT.";
    if (!dados.titulo) e.titulo = "Informe o título profissional.";
    if (!dados.registro) e.registro = "Informe o nº de registro.";
    if (!dados.telefone) e.telefone = "Informe o telefone.";
    else if (!/^[0-9]{10,11}$/.test(dados.telefone)) e.telefone = "Telefone com 10 ou 11 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) e.email = "E-mail inválido.";
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro.replace("endereco.", "")) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = await chamarAcao(salvarRtAction({ rowVersion: rt?.rowVersion ?? null, ...dados }));
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    setGeral({ tipo: "ok", texto: "Dados do RT salvos." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);
  const campo = (k: "nome" | "titulo" | "registro", rotulo: string) => (
    <div className="campo">
      <label htmlFor={`rt-${k}`}>{rotulo}</label>
      <input id={`rt-${k}`} name={k} defaultValue={rt?.[k]} aria-invalid={Boolean(erros[k])} />
      {erro(k)}
    </div>
  );

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      {campo("nome", "Nome do RT")}
      <div className="grade">
        {campo("titulo", "Título profissional")}
        {campo("registro", "Nº de registro")}
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="rt-telefone">Telefone do RT</label>
          <input
            id="rt-telefone"
            name="telefone"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            aria-invalid={Boolean(erros.telefone)}
          />
          {erro("telefone")}
        </div>
        <div className="campo">
          <label htmlFor="rt-email">E-mail do RT</label>
          <input
            id="rt-email"
            name="email"
            type="email"
            defaultValue={rt?.email}
            aria-invalid={Boolean(erros.email)}
          />
          {erro("email")}
        </div>
      </div>
      <EnderecoCampos valor={rt?.endereco} erros={erros} bairroObrigatorio={true} prefixo="rt-" />
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar RT"}
      </button>
    </form>
  );
}
