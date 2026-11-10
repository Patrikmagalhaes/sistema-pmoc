"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { alterarSituacaoAction, excluirAction } from "../actions";

type Alvo = "tipo" | "grupo" | "atividade";

const EFEITO: Record<Alvo, { inativar: string; excluir: string }> = {
  tipo: {
    inativar: "O tipo some dos novos PMOCs e equipamentos; os PMOCs existentes não mudam.",
    excluir: "O tipo, os grupos e as atividades dele saem da biblioteca.",
  },
  grupo: {
    inativar: "O grupo deixa de aparecer para novos equipamentos.",
    excluir: "O grupo sai da biblioteca.",
  },
  atividade: {
    inativar: "A atividade não entra em novos PMOCs; os PMOCs existentes não mudam.",
    excluir: "A atividade sai da biblioteca.",
  },
};

/**
 * TL-105: Inativar / Reativar / Excluir (RN-044; EL-4). Com uso, só "Inativar"; ações que tiram de uso
 * pedem confirmação dizendo o efeito (UF-09).
 */
export function AcoesItem({
  alvo,
  id,
  rowVersion,
  nome,
  situacao,
  emUso,
  aoExcluir,
  motivoSemExcluir,
}: {
  alvo: Alvo;
  id: string;
  rowVersion: number;
  nome: string;
  situacao: "ATIVO" | "INATIVO";
  emUso: boolean;
  /** Para onde ir depois de excluir (o tipo excluído não tem mais página). */
  aoExcluir?: string;
  /** Excluir desabilitado com a dica do motivo (EL-7, como E-04.7). */
  motivoSemExcluir?: string;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [confirmar, setConfirmar] = useState<"inativar" | "excluir" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: "inativar" | "reativar" | "excluir") {
    setEnviando(true);
    setErro(null);
    const r =
      acao === "excluir"
        ? await chamarAcao(excluirAction({ alvo, id, rowVersion }))
        : await chamarAcao(
            alterarSituacaoAction({
              alvo,
              id,
              rowVersion,
              situacao: acao === "inativar" ? "INATIVO" : "ATIVO",
            }),
          );
    setEnviando(false);
    if (r.tipo === "conflito")
      return setErro("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") return setErro(r.mensagem);
    setConfirmar(null);
    if (acao === "excluir" && aoExcluir) router.push(aoExcluir);
    else router.refresh();
  }

  const desab = !pronto || enviando;

  if (confirmar) {
    return (
      <div className="confirmacao" role="dialog" aria-label={`Confirmar ${confirmar}`}>
        <p>
          {confirmar === "inativar" ? "Inativar" : "Excluir"} <strong>{nome}</strong>?{" "}
          {EFEITO[alvo][confirmar]}
        </p>
        {erro && <p className="alerta erro">{erro}</p>}
        <div className="linha">
          <button
            type="button"
            className="botao perigo"
            disabled={desab}
            onClick={() => executar(confirmar)}
          >
            {enviando
              ? "Aguarde…"
              : confirmar === "inativar"
                ? "Confirmar inativação"
                : "Confirmar exclusão"}
          </button>
          <button type="button" className="botao secundario" onClick={() => setConfirmar(null)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acoes-linha">
      {situacao === "ATIVO" ? (
        <button
          type="button"
          className="botao secundario"
          disabled={desab}
          onClick={() => setConfirmar("inativar")}
        >
          Inativar
        </button>
      ) : (
        <button
          type="button"
          className="botao secundario"
          disabled={desab}
          onClick={() => executar("reativar")}
        >
          {enviando ? "Reativando…" : "Reativar"}
        </button>
      )}
      {!emUso && (
        <button
          type="button"
          className="botao secundario perigo"
          disabled={desab || Boolean(motivoSemExcluir)}
          title={motivoSemExcluir}
          onClick={() => setConfirmar("excluir")}
        >
          Excluir
        </button>
      )}
      {!emUso && motivoSemExcluir && <span className="dica">{motivoSemExcluir}</span>}
      {erro && (
        <span className="erro" role="status">
          {erro}
        </span>
      )}
    </div>
  );
}
