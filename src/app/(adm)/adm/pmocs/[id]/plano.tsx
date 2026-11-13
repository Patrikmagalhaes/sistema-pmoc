"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { chamarAcao, type Desfecho } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import type { TipoNoPlano } from "@/modules/pmoc";
import {
  alterarPeriodicidadeAction,
  incluirDaBibliotecaAction,
  incluirNovaAction,
  removerAtividadeAction,
  restaurarAtividadeAction,
} from "../actions";

type Periodicidade = "MM" | "MB" | "MT" | "MS" | "MA";
type Natureza = "VERIFICACAO" | "MEDICAO";

/** Rótulos vêm do servidor (módulo `biblioteca`), para não duplicar o enum aqui. */
export interface RotulosPlano {
  periodicidades: { valor: Periodicidade; rotulo: string }[];
  periodicidade: Record<Periodicidade, string>;
  natureza: Record<Natureza, string>;
  unidadeMax: number;
}

const CONFLITO = "Este registro foi alterado por outra pessoa. Recarregue a página.";

/** Mensagem da tela para o desfecho da action (UF-02, UF-07); `null` = deu certo. */
const falha = (r: Desfecho<{ ok: true } | { ok: false; codigo: string; mensagem: string }>) =>
  r.tipo === "conflito" ? CONFLITO : r.tipo === "erro" ? r.mensagem : null;

/**
 * TL-120 aba Plano: uma tabela por tipo, atividades na ordem da RN-051. Periodicidade vale para
 * todos os equipamentos do tipo neste PMOC (RN-026); remover e incluir atividade (RF-10.3).
 */
export function Plano({
  pmocId,
  tipos,
  podeAlterar,
  rotulos,
}: {
  pmocId: string;
  tipos: TipoNoPlano[];
  podeAlterar: boolean;
  rotulos: RotulosPlano;
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <div className="secao">
      {aviso && (
        <div className={`alerta ${aviso.ok ? "ok" : "erro"}`} role="status">
          {aviso.texto}
        </div>
      )}
      {podeAlterar && (
        <p className="dica">
          A periodicidade vale para todos os equipamentos do tipo neste PMOC. A biblioteca não muda.
        </p>
      )}
      {tipos.map((t) => (
        <BlocoTipo
          key={t.id}
          pmocId={pmocId}
          tipo={t}
          podeAlterar={podeAlterar}
          rotulos={rotulos}
          avisar={setAviso}
        />
      ))}
    </div>
  );
}

type Avisar = (a: { ok: boolean; texto: string } | null) => void;

function BlocoTipo({
  pmocId,
  tipo,
  podeAlterar,
  rotulos,
  avisar,
}: {
  pmocId: string;
  tipo: TipoNoPlano;
  podeAlterar: boolean;
  rotulos: RotulosPlano;
  avisar: Avisar;
}) {
  const [incluindo, setIncluindo] = useState(false);
  return (
    <div className="secao">
      <h2>
        {tipo.nome} ({tipo.equipamentosAtivos}{" "}
        {tipo.equipamentosAtivos === 1 ? "equipamento ativo" : "equipamentos ativos"})
      </h2>
      {tipo.atividades.length === 0 ? (
        <p className="vazio">Nenhuma atividade deste tipo no plano.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Natureza</th>
                <th>Exige foto</th>
                <th>Periodicidade</th>
                {podeAlterar && <th />}
              </tr>
            </thead>
            <tbody>
              {tipo.atividades.map((a) => (
                <LinhaAtividade
                  key={`${a.id}-${a.rowVersion}`}
                  atividade={a}
                  podeAlterar={podeAlterar}
                  rotulos={rotulos}
                  avisar={avisar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {podeAlterar &&
        (incluindo ? (
          <Incluir
            pmocId={pmocId}
            tipo={tipo}
            rotulos={rotulos}
            avisar={avisar}
            fechar={() => setIncluindo(false)}
          />
        ) : (
          <p>
            <button
              type="button"
              className="botao secundario"
              style={{ width: "auto" }}
              onClick={() => {
                avisar(null);
                setIncluindo(true);
              }}
            >
              Incluir atividade
            </button>
          </p>
        ))}
    </div>
  );
}

function LinhaAtividade({
  atividade: a,
  podeAlterar,
  rotulos,
  avisar,
}: {
  atividade: TipoNoPlano["atividades"][number];
  podeAlterar: boolean;
  rotulos: RotulosPlano;
  avisar: Avisar;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function mudar(periodicidade: Periodicidade) {
    setEnviando(true);
    avisar(null);
    const r = await chamarAcao(
      alterarPeriodicidadeAction({ id: a.id, rowVersion: a.rowVersion, periodicidade }),
    );
    setEnviando(false);
    const erro = falha(r);
    if (erro) return avisar({ ok: false, texto: erro });
    avisar({ ok: true, texto: `"${a.titulo}" passou a ${rotulos.periodicidade[periodicidade]}.` });
    router.refresh(); // RN-006: o cronograma de pré-visualização é recalculado na leitura
  }

  async function remover() {
    setEnviando(true);
    avisar(null);
    const r = await chamarAcao(removerAtividadeAction({ id: a.id, rowVersion: a.rowVersion }));
    setEnviando(false);
    setConfirmando(false);
    const erro = falha(r);
    if (erro) return avisar({ ok: false, texto: erro });
    avisar({ ok: true, texto: `"${a.titulo}" saiu do plano.` });
    router.refresh();
  }

  return (
    <tr>
      <td>{a.titulo}</td>
      <td>
        {rotulos.natureza[a.natureza]}
        {a.unidade ? ` (${a.unidade})` : ""}
      </td>
      <td>{a.exigeFoto ? "Sim" : "Não"}</td>
      <td>
        {podeAlterar ? (
          <select
            aria-label={`Periodicidade de ${a.titulo}`}
            defaultValue={a.periodicidade}
            disabled={!pronto || enviando}
            onChange={(e) => mudar(e.target.value as Periodicidade)}
          >
            {rotulos.periodicidades.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        ) : (
          rotulos.periodicidade[a.periodicidade]
        )}
      </td>
      {podeAlterar && (
        <td>
          {confirmando ? (
            <div className="acoes-linha">
              <button
                type="button"
                className="botao"
                disabled={!pronto || enviando}
                onClick={remover}
              >
                {enviando ? "Removendo…" : "Remover do plano"}
              </button>
              <button
                type="button"
                className="botao secundario"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="botao secundario"
              disabled={!pronto || enviando}
              onClick={() => setConfirmando(true)}
            >
              Remover
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * "Incluir atividade" (RF-10.3 [A VALIDAR]): volta uma removida pela mesma linha (RN-184), inclui uma
 * da biblioteca com a periodicidade padrão, ou cria uma nova só deste PMOC.
 */
function Incluir({
  pmocId,
  tipo,
  rotulos,
  avisar,
  fechar,
}: {
  pmocId: string;
  tipo: TipoNoPlano;
  rotulos: RotulosPlano;
  avisar: Avisar;
  fechar: () => void;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState(false);
  const [natureza, setNatureza] = useState<Natureza | "">("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [geral, setGeral] = useState<string | null>(null);

  async function feito(
    p: Promise<Desfecho<{ ok: true } | { ok: false; codigo: string; mensagem: string }>>,
    titulo: string,
  ) {
    setEnviando(true);
    setGeral(null);
    const r = await p;
    setEnviando(false);
    const erro = falha(r);
    if (erro) {
      if (r.tipo === "erro" && r.campos) setErros(r.campos);
      return setGeral(erro);
    }
    avisar({ ok: true, texto: `"${titulo}" entrou no plano.` });
    fechar();
    router.refresh();
  }

  async function criar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const d = {
      titulo: String(f.get("titulo") ?? "").trim(),
      periodicidade: String(f.get("periodicidade") ?? ""),
      natureza: String(f.get("natureza") ?? ""),
      unidade: natureza === "MEDICAO" ? String(f.get("unidade") ?? "").trim() : null,
      exigeFoto: f.get("exigeFoto") === "on",
    };
    const e: Record<string, string> = {};
    if (!d.titulo) e.titulo = "Informe o título.";
    if (!d.periodicidade) e.periodicidade = "Escolha a periodicidade.";
    if (!d.natureza) e.natureza = "Escolha a natureza.";
    if (d.natureza === "MEDICAO" && !d.unidade) e.unidade = "Informe a unidade da medição.";
    setErros(e);
    if (Object.keys(e).length) return;
    await feito(chamarAcao(incluirNovaAction({ pmocId, tipoId: tipo.id, ...d })), d.titulo);
  }

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);
  const pre = `nova-${tipo.id}`;

  return (
    <div className="cartao">
      <h3>Incluir atividade em {tipo.nome}</h3>
      {geral && (
        <div className="alerta erro" role="status">
          {geral}
        </div>
      )}
      {tipo.removidas.length > 0 && (
        <>
          <p>Removidas deste plano:</p>
          <ul>
            {tipo.removidas.map((a) => (
              <li key={a.id}>
                {a.titulo} ({rotulos.periodicidade[a.periodicidade]}){" "}
                <button
                  type="button"
                  className="botao secundario"
                  style={{ width: "auto" }}
                  disabled={!pronto || enviando}
                  onClick={() =>
                    feito(
                      chamarAcao(restaurarAtividadeAction({ id: a.id, rowVersion: a.rowVersion })),
                      a.titulo,
                    )
                  }
                >
                  Voltar ao plano
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {tipo.disponiveis.length > 0 && (
        <>
          <p>Da biblioteca:</p>
          <ul>
            {tipo.disponiveis.map((m) => (
              <li key={m.id}>
                {m.titulo} ({rotulos.periodicidade[m.periodicidade]}){" "}
                <button
                  type="button"
                  className="botao secundario"
                  style={{ width: "auto" }}
                  disabled={!pronto || enviando}
                  onClick={() =>
                    feito(
                      chamarAcao(incluirDaBibliotecaAction({ pmocId, modeloId: m.id })),
                      m.titulo,
                    )
                  }
                >
                  Incluir
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>Nova atividade só deste PMOC:</p>
      <form onSubmit={criar} noValidate className="formulario" style={{ maxWidth: 720 }}>
        <div className="campo">
          <label htmlFor={`${pre}-titulo`}>Título</label>
          <input id={`${pre}-titulo`} name="titulo" aria-invalid={Boolean(erros.titulo)} />
          {erro("titulo")}
        </div>
        <div className="grade">
          <div className="campo">
            <label htmlFor={`${pre}-periodicidade`}>Periodicidade</label>
            <select
              id={`${pre}-periodicidade`}
              name="periodicidade"
              defaultValue=""
              aria-invalid={Boolean(erros.periodicidade)}
            >
              <option value="">Escolha</option>
              {rotulos.periodicidades.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
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
              maxLength={rotulos.unidadeMax}
              disabled={natureza !== "MEDICAO"}
              placeholder={natureza === "MEDICAO" ? "Ex.: V, A, psi" : "Só para medição"}
              aria-invalid={Boolean(erros.unidade)}
            />
            {erro("unidade")}
          </div>
        </div>
        <div className="campo">
          <label className="caixa">
            <input type="checkbox" name="exigeFoto" />
            Exige foto
          </label>
        </div>
        <div className="linha">
          <button className="botao" type="submit" disabled={!pronto || enviando}>
            {enviando ? "Incluindo…" : "Incluir nova atividade"}
          </button>
          <button type="button" className="botao secundario" onClick={fechar}>
            Fechar
          </button>
        </div>
      </form>
    </div>
  );
}
