"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarTipoAction, criarTipoAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface TipoEditavel {
  id: string;
  rowVersion: number;
  nome: string;
  plural: string | null;
  sigla: string;
  siglaTravada: boolean;
}

const SIGLA = /^[A-Z]{2,5}$/; // E-03.1 [A VALIDAR: formato]

/** TL-105 – dados do tipo. Na criação inclui os grupos (RN-040: ao menos um). */
export function TipoForm({ tipo }: { tipo?: TipoEditavel }) {
  const novo = !tipo;
  const router = useRouter();
  const pronto = useHidratado();
  const [grupos, setGrupos] = useState<{ chave: number; nome: string }[]>([{ chave: 0, nome: "" }]);
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const nome = String(f.get("nome") ?? "").trim();
    const plural = String(f.get("plural") ?? "").trim();
    const sigla = String(f.get("sigla") ?? "")
      .trim()
      .toUpperCase();
    const gs = grupos.map((g) => g.nome.trim()).filter(Boolean);
    const e: Erros = {};
    if (!nome) e.nome = "Informe o nome.";
    if (!SIGLA.test(sigla)) e.sigla = "A sigla tem de 2 a 5 letras, sem números.";
    if (novo && gs.length === 0) e.grupos = "Inclua ao menos um grupo."; // E-03.2
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (
        form.elements.namedItem(primeiro === "grupos" ? "grupo-0" : primeiro) as HTMLElement | null
      )?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarTipoAction({ nome, plural, sigla, grupos: gs }))
      : await chamarAcao(
          atualizarTipoAction({ id: tipo.id, rowVersion: tipo.rowVersion, nome, plural, sigla }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/tipos/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    setGeral({ tipo: "ok", texto: "Dados salvos." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={salvar} noValidate className="formulario">
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="campo">
        <label htmlFor="nome">Nome</label>
        <input id="nome" name="nome" defaultValue={tipo?.nome} aria-invalid={Boolean(erros.nome)} />
        {erro("nome")}
      </div>
      <div className="campo">
        <label htmlFor="plural">Plural (opcional)</label>
        <input id="plural" name="plural" defaultValue={tipo?.plural ?? ""} />
        <span className="dica">Usado no PMOC ("2 (dois) Splits"). Em branco, repete o nome.</span>
      </div>
      <div className="campo">
        <label htmlFor="sigla">Sigla</label>
        <input
          id="sigla"
          name="sigla"
          defaultValue={tipo?.sigla}
          maxLength={5}
          readOnly={tipo?.siglaTravada}
          style={{ textTransform: "uppercase" }}
          aria-invalid={Boolean(erros.sigla)}
        />
        {erro("sigla") ??
          (tipo?.siglaTravada ? (
            <span className="dica">A sigla compõe as TAGs e não pode mudar.</span>
          ) : (
            <span className="dica">2 a 5 letras; vai na TAG do equipamento (ex.: SPL).</span>
          ))}
      </div>
      {novo && (
        <fieldset className="campo">
          <legend>Grupos permitidos</legend>
          {grupos.map((g, i) => (
            <div className="linha" key={g.chave}>
              <input
                name={`grupo-${i}`}
                aria-label={`Grupo ${i + 1}`}
                value={g.nome}
                placeholder="Ex.: Hi-Wall"
                aria-invalid={Boolean(erros.grupos)}
                onChange={(e) =>
                  setGrupos(
                    grupos.map((x) => (x.chave === g.chave ? { ...x, nome: e.target.value } : x)),
                  )
                }
              />
              {grupos.length > 1 && (
                <button
                  type="button"
                  className="botao secundario"
                  style={{ width: "auto" }}
                  onClick={() => setGrupos(grupos.filter((x) => x.chave !== g.chave))}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="botao secundario"
            style={{ width: "auto" }}
            onClick={() =>
              setGrupos([
                ...grupos,
                { chave: Math.max(...grupos.map((x) => x.chave)) + 1, nome: "" },
              ])
            }
          >
            Incluir grupo
          </button>
          {erro("grupos")}
        </fieldset>
      )}
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

/** UF-07. */
export function Conflito() {
  return (
    <div className="alerta erro" role="status">
      Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.{" "}
      <button type="button" className="botao secundario" onClick={() => window.location.reload()}>
        Recarregar
      </button>
    </div>
  );
}
