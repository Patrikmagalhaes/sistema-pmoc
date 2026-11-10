"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { ROTULO_SITUACAO } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarAtividadeAction, incluirAtividadeAction } from "../actions";
import { AcoesItem } from "./acoes-item";

type Periodicidade = "MM" | "MB" | "MT" | "MS" | "MA";
type Natureza = "VERIFICACAO" | "MEDICAO";

interface Atividade {
  id: string;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
  ordem: number;
  situacao: "ATIVO" | "INATIVO";
  rowVersion: number;
  emUso: boolean;
}

/** Rótulos vêm do servidor (módulo `biblioteca`), para não duplicar o enum aqui. */
export interface Rotulos {
  periodicidade: Record<Periodicidade, string>;
  natureza: Record<Natureza, string>;
  unidadeMax: number;
}

/** TL-105 – atividades padrão, na ordem periodicidade → ordem de exibição (RN-051). */
export function Atividades({
  tipoId,
  atividades,
  rotulos,
}: {
  tipoId: string;
  atividades: Atividade[];
  rotulos: Rotulos;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <>
      {aviso && (
        <div className="alerta ok" role="status">
          {aviso}
        </div>
      )}
      {atividades.length === 0 ? (
        <p className="vazio">Inclua a primeira atividade.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Periodicidade</th>
                <th>Ordem</th>
                <th>Título</th>
                <th>Natureza</th>
                <th>Exige foto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {atividades.map((a) => (
                <Fragment key={`${a.id}-${a.rowVersion}`}>
                  <tr>
                    <td>{rotulos.periodicidade[a.periodicidade]}</td>
                    <td>{a.ordem}</td>
                    <td>{a.titulo}</td>
                    <td>
                      {rotulos.natureza[a.natureza]}
                      {a.unidade ? ` (${a.unidade})` : ""}
                    </td>
                    <td>{a.exigeFoto ? "Sim" : "Não"}</td>
                    <td>
                      <span className={`etiqueta ${a.situacao === "ATIVO" ? "ok" : "neutra"}`}>
                        {ROTULO_SITUACAO[a.situacao]}
                      </span>
                    </td>
                    <td>
                      <div className="acoes-linha">
                        <button
                          type="button"
                          className="botao secundario"
                          onClick={() => setEditando(editando === a.id ? null : a.id)}
                        >
                          {editando === a.id ? "Fechar" : "Editar"}
                        </button>
                        <AcoesItem
                          alvo="atividade"
                          id={a.id}
                          rowVersion={a.rowVersion}
                          nome={a.titulo}
                          situacao={a.situacao}
                          emUso={a.emUso}
                        />
                      </div>
                    </td>
                  </tr>
                  {editando === a.id && (
                    <tr>
                      <td colSpan={7}>
                        <AtividadeForm
                          tipoId={tipoId}
                          atividade={a}
                          rotulos={rotulos}
                          aoSalvar={(mudouPeriodicidade) => {
                            setEditando(null);
                            // E-03.5: a biblioteca é padrão; PMOCs já criados têm a cópia deles.
                            setAviso(
                              mudouPeriodicidade
                                ? "Atividade salva. A nova periodicidade não altera PMOCs já criados."
                                : "Atividade salva.",
                            );
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando === "nova" ? (
        <AtividadeForm
          tipoId={tipoId}
          rotulos={rotulos}
          aoSalvar={() => {
            setEditando(null);
            setAviso("Atividade incluída.");
          }}
          aoCancelar={() => setEditando(null)}
        />
      ) : (
        <p>
          <button
            type="button"
            className="botao secundario"
            style={{ width: "auto" }}
            onClick={() => {
              setAviso(null);
              setEditando("nova");
            }}
          >
            Nova atividade
          </button>
        </p>
      )}
    </>
  );
}

function AtividadeForm({
  tipoId,
  atividade,
  rotulos,
  aoSalvar,
  aoCancelar,
}: {
  tipoId: string;
  atividade?: Atividade;
  rotulos: Rotulos;
  aoSalvar: (mudouPeriodicidade: boolean) => void;
  aoCancelar?: () => void;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [natureza, setNatureza] = useState<Natureza | "">(atividade?.natureza ?? "");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pre = atividade ? `at-${atividade.id}` : "at-nova";

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const d = {
      titulo: String(f.get("titulo") ?? "").trim(),
      periodicidade: String(f.get("periodicidade") ?? ""),
      natureza: String(f.get("natureza") ?? ""),
      unidade: natureza === "MEDICAO" ? String(f.get("unidade") ?? "").trim() : null,
      exigeFoto: f.get("exigeFoto") === "on",
      ordem: String(f.get("ordem") ?? "").trim(),
    };
    const e: Record<string, string> = {};
    if (!d.titulo) e.titulo = "Informe o título.";
    if (!d.periodicidade) e.periodicidade = "Escolha a periodicidade.";
    if (!d.natureza) e.natureza = "Escolha a natureza.";
    if (d.natureza === "MEDICAO" && !d.unidade) e.unidade = "Informe a unidade da medição."; // E-03.3
    if (!/^-?\d+$/.test(d.ordem)) e.ordem = "A ordem é um número inteiro.";
    setErros(e);
    setGeral(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const dados = d as typeof d & { periodicidade: Periodicidade; natureza: Natureza };
    const r = atividade
      ? await chamarAcao(
          atualizarAtividadeAction({
            id: atividade.id,
            rowVersion: atividade.rowVersion,
            ...dados,
          }),
        )
      : await chamarAcao(incluirAtividadeAction({ tipoId, ...dados }));
    setEnviando(false);
    if (r.tipo === "conflito")
      return setGeral("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    aoSalvar(Boolean((r.dados as { periodicidadeMudou?: boolean }).periodicidadeMudou));
    router.refresh();
  }

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className="alerta erro" role="status">
          {geral}
        </div>
      )}
      <div className="campo">
        <label htmlFor={`${pre}-titulo`}>Título</label>
        <input
          id={`${pre}-titulo`}
          name="titulo"
          defaultValue={atividade?.titulo}
          aria-invalid={Boolean(erros.titulo)}
        />
        {erro("titulo")}
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor={`${pre}-periodicidade`}>Periodicidade padrão</label>
          <select
            id={`${pre}-periodicidade`}
            name="periodicidade"
            defaultValue={atividade?.periodicidade ?? ""}
            aria-invalid={Boolean(erros.periodicidade)}
          >
            <option value="">Escolha</option>
            {Object.entries(rotulos.periodicidade).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {erro("periodicidade")}
        </div>
        <div className="campo">
          <label htmlFor={`${pre}-natureza`}>Natureza</label>
          <select
            id={`${pre}-natureza`}
            name="natureza"
            value={natureza}
            onChange={(e) => setNatureza(e.target.value as Natureza)}
            aria-invalid={Boolean(erros.natureza)}
          >
            <option value="">Escolha</option>
            {Object.entries(rotulos.natureza).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {erro("natureza")}
        </div>
        <div className="campo">
          <label htmlFor={`${pre}-unidade`}>Unidade</label>
          <input
            id={`${pre}-unidade`}
            name="unidade"
            defaultValue={atividade?.unidade ?? ""}
            maxLength={rotulos.unidadeMax}
            disabled={natureza !== "MEDICAO"}
            placeholder={natureza === "MEDICAO" ? "Ex.: V, A, psi" : "Só para medição"}
            aria-invalid={Boolean(erros.unidade)}
          />
          {erro("unidade")}
        </div>
        <div className="campo">
          <label htmlFor={`${pre}-ordem`}>Ordem</label>
          <input
            id={`${pre}-ordem`}
            name="ordem"
            inputMode="numeric"
            defaultValue={atividade?.ordem ?? 1}
            aria-invalid={Boolean(erros.ordem)}
          />
          {erro("ordem")}
        </div>
      </div>
      <div className="campo">
        <label className="caixa">
          <input type="checkbox" name="exigeFoto" defaultChecked={atividade?.exigeFoto ?? false} />
          Exige foto
        </label>
        <span className="dica">
          A ocorrência só é finalizada com ao menos 1 foto do equipamento na visita (RN-185).
        </span>
      </div>
      <div className="linha">
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          {enviando ? "Salvando…" : atividade ? "Salvar atividade" : "Incluir atividade"}
        </button>
        {aoCancelar && (
          <button type="button" className="botao secundario" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
