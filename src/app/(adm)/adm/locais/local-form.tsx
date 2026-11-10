"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { chamarAcao } from "@/lib/chamar-acao";
import type { Endereco } from "@/lib/endereco";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarLocalAction, criarLocalAction } from "../clientes/actions";

type Erros = Record<string, string | undefined>;

export interface LocalEditavel {
  id: string;
  rowVersion: number;
  codigo: string;
  nome: string;
  telefone: string | null;
  endereco: Endereco;
}

/** TL-110 aba Dados (RF-06; FL-04 passo 3). O código é gerado ao salvar (DM-19) e não muda (RN-047). */
export function LocalForm({ clienteId, local }: { clienteId: string; local?: LocalEditavel }) {
  const novo = !local;
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(local?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, false);
    const dados = {
      nome: String(f.get("nome") ?? "").trim(),
      telefone: telefone.replace(/\D/g, "") || null,
      endereco,
    };
    if (!dados.nome) e.nome = "Informe o nome do local.";
    if (dados.telefone && !/^[0-9]{10,11}$/.test(dados.telefone))
      e.telefone = "Telefone com 10 ou 11 dígitos.";
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro.replace("endereco.", "")) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarLocalAction({ clienteId, ...dados }))
      : await chamarAcao(
          atualizarLocalAction({ id: local.id, rowVersion: local.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/locais/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    setGeral({ tipo: "ok", texto: "Dados salvos." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="grade">
        <div className="campo">
          <label htmlFor="codigo">Código</label>
          <input id="codigo" value={local?.codigo ?? ""} readOnly placeholder="Gerado ao salvar" />
          <span className="dica">Vai na TAG dos equipamentos e não muda.</span>
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
          {erro("telefone")}
        </div>
      </div>
      <div className="campo">
        <label htmlFor="nome">Nome do local</label>
        <input
          id="nome"
          name="nome"
          defaultValue={local?.nome}
          aria-invalid={Boolean(erros.nome)}
        />
        {erro("nome")}
      </div>
      <EnderecoCampos valor={local?.endereco} erros={erros} bairroObrigatorio={false} />
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
