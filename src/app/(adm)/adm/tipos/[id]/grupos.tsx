"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { ROTULO_SITUACAO } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { incluirGrupoAction, renomearGrupoAction } from "../actions";
import { AcoesItem } from "./acoes-item";

interface Grupo {
  id: string;
  nome: string;
  situacao: "ATIVO" | "INATIVO";
  rowVersion: number;
  emUso: boolean;
}

/** TL-105 – lista editável de grupos (RN-040; E-03.2: tipo ativo mantém ao menos um grupo ativo). */
export function Grupos({ tipoId, grupos }: { tipoId: string; grupos: Grupo[] }) {
  return (
    <>
      {grupos.length === 0 ? (
        <p className="vazio">Inclua o primeiro grupo.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome do grupo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <LinhaGrupo key={`${g.id}-${g.rowVersion}`} grupo={g} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NovoGrupo tipoId={tipoId} />
    </>
  );
}

function LinhaGrupo({ grupo }: { grupo: Grupo }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [nome, setNome] = useState(grupo.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudou = nome.trim() !== grupo.nome;

  async function salvar() {
    if (!nome.trim()) return setErro("Informe o nome do grupo.");
    setEnviando(true);
    const r = await chamarAcao(
      renomearGrupoAction({ id: grupo.id, rowVersion: grupo.rowVersion, nome }),
    );
    setEnviando(false);
    if (r.tipo === "conflito")
      return setErro("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") return setErro(r.campos?.nome ?? r.mensagem);
    setErro(null);
    router.refresh();
  }

  return (
    <tr>
      <td>
        <div className="campo" style={{ margin: 0 }}>
          <input
            aria-label={`Nome do grupo ${grupo.nome}`}
            value={nome}
            aria-invalid={Boolean(erro)}
            onChange={(e) => setNome(e.target.value)}
          />
          {erro && <span className="erro">{erro}</span>}
        </div>
      </td>
      <td>
        <span className={`etiqueta ${grupo.situacao === "ATIVO" ? "ok" : "neutra"}`}>
          {ROTULO_SITUACAO[grupo.situacao]}
        </span>
      </td>
      <td>
        <div className="acoes-linha">
          {mudou && (
            <button type="button" className="botao" disabled={!pronto || enviando} onClick={salvar}>
              {enviando ? "Salvando…" : "Salvar"}
            </button>
          )}
          <AcoesItem
            alvo="grupo"
            id={grupo.id}
            rowVersion={grupo.rowVersion}
            nome={grupo.nome}
            situacao={grupo.situacao}
            emUso={grupo.emUso}
          />
        </div>
      </td>
    </tr>
  );
}

function NovoGrupo({ tipoId }: { tipoId: string }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function incluir(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const nome = String(new FormData(form).get("novo-grupo") ?? "").trim();
    if (!nome) return setErro("Informe o nome do grupo.");
    setEnviando(true);
    const r = await chamarAcao(incluirGrupoAction({ tipoId, nome }));
    setEnviando(false);
    if (r.tipo !== "ok")
      return setErro(r.tipo === "erro" ? (r.campos?.nome ?? r.mensagem) : "Recarregue a página.");
    setErro(null);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={incluir} noValidate className="filtros">
      <div className="campo">
        <label htmlFor="novo-grupo">Novo grupo</label>
        <input
          id="novo-grupo"
          name="novo-grupo"
          placeholder="Ex.: Cassete"
          aria-invalid={Boolean(erro)}
        />
        {erro && <span className="erro">{erro}</span>}
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Incluindo…" : "Incluir grupo"}
      </button>
    </form>
  );
}
