"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { chamarAcao } from "@/lib/chamar-acao";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import type { Endereco } from "@/lib/endereco";
import { mascararCnpj, mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarClienteAction, criarClienteAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface ClienteEditavel {
  id: string;
  rowVersion: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  telefone1: string | null;
  telefone2: string | null;
  endereco: Endereco;
}

const digitos = (v: string) => v.replace(/\D/g, "");

/** TL-109 aba Dados (RF-05; FL-04 passo 2). Máscara só na tela; grava sem máscara (RF-05.5). */
export function ClienteForm({ cliente }: { cliente?: ClienteEditavel }) {
  const novo = !cliente;
  const router = useRouter();
  const pronto = useHidratado();
  const [cnpj, setCnpj] = useState(mascararCnpj(cliente?.cnpj));
  const [tel1, setTel1] = useState(mascararTelefone(cliente?.telefone1 ?? ""));
  const [tel2, setTel2] = useState(mascararTelefone(cliente?.telefone2 ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [existente, setExistente] = useState<string | null>(null);
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, false);
    const dados = {
      razaoSocial: String(f.get("razaoSocial") ?? "").trim(),
      nomeFantasia: String(f.get("nomeFantasia") ?? "").trim() || null,
      cnpj: normalizarCnpj(cnpj),
      telefone1: digitos(tel1) || null,
      telefone2: digitos(tel2) || null,
      endereco,
    };
    if (!dados.razaoSocial) e.razaoSocial = "Informe a razão social.";
    if (!cnpjValido(dados.cnpj)) e.cnpj = "CNPJ inválido."; // E-04.1
    for (const [k, v] of [
      ["telefone1", dados.telefone1],
      ["telefone2", dados.telefone2],
    ] as const)
      if (v && !/^[0-9]{10,11}$/.test(v)) e[k] = "Telefone com 10 ou 11 dígitos.";
    if (!e.telefone2 && dados.telefone2 && !dados.telefone1)
      e.telefone2 = "Preencha o telefone 1 antes."; // E-04.4
    else if (!e.telefone2 && dados.telefone2 && dados.telefone2 === dados.telefone1)
      e.telefone2 = "O telefone 2 repete o 1.";
    setErros(e);
    setExistente(null);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      const nome = primeiro.replace("endereco.", "");
      (form.elements.namedItem(nome) as HTMLElement | null)?.focus(); // UF-01
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarClienteAction(dados))
      : await chamarAcao(
          atualizarClienteAction({ id: cliente.id, rowVersion: cliente.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      setExistente(r.falha?.existenteId ?? null);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/clientes/${String(r.dados.id)}?aviso=criado`);
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
          {existente && (
            <>
              {" "}
              <Link href={`/adm/clientes/${existente}`}>Abrir o cliente existente</Link>
            </>
          )}
        </div>
      )}
      <div className="campo">
        <label htmlFor="razaoSocial">Razão social</label>
        <input
          id="razaoSocial"
          name="razaoSocial"
          defaultValue={cliente?.razaoSocial}
          aria-invalid={Boolean(erros.razaoSocial)}
        />
        {erro("razaoSocial")}
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="nomeFantasia">Nome fantasia (opcional)</label>
          <input id="nomeFantasia" name="nomeFantasia" defaultValue={cliente?.nomeFantasia ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="cnpj">CNPJ</label>
          <input
            id="cnpj"
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
            aria-invalid={Boolean(erros.cnpj)}
          />
          {erro("cnpj")}
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="telefone1">Telefone 1 (opcional)</label>
          <input
            id="telefone1"
            name="telefone1"
            inputMode="tel"
            value={tel1}
            onChange={(e) => setTel1(mascararTelefone(e.target.value))}
            aria-invalid={Boolean(erros.telefone1)}
          />
          {erro("telefone1")}
        </div>
        <div className="campo">
          <label htmlFor="telefone2">Telefone 2 (opcional)</label>
          <input
            id="telefone2"
            name="telefone2"
            inputMode="tel"
            value={tel2}
            onChange={(e) => setTel2(mascararTelefone(e.target.value))}
            aria-invalid={Boolean(erros.telefone2)}
          />
          {erro("telefone2")}
        </div>
      </div>
      <EnderecoCampos valor={cliente?.endereco} erros={erros} bairroObrigatorio={false} />
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
