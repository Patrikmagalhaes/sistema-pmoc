"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { alterarSituacaoEquipamentoAction } from "../actions";

/** TL-111 "Inativar" (RN-152) e "Reativar" [A VALIDAR], com confirmação. */
export function SituacaoEquipamento({
  id,
  rowVersion,
  situacao,
  bloqueio,
}: {
  id: string;
  rowVersion: number;
  situacao: "ATIVO" | "INATIVO";
  /** Motivo de não poder mudar; `null` = pode. */
  bloqueio: string | null;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inativar = situacao === "ATIVO";
  const rotulo = inativar ? "Inativar" : "Reativar";

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    const r = await chamarAcao(
      alterarSituacaoEquipamentoAction({
        id,
        rowVersion,
        situacao: inativar ? "INATIVO" : "ATIVO",
      }),
    );
    setEnviando(false);
    if (r.tipo === "conflito")
      return setErro("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") return setErro(r.mensagem);
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <div className="acoes">
        <div className="linha">
          <button
            type="button"
            className="botao secundario"
            style={{ width: "auto" }}
            disabled={!pronto || Boolean(bloqueio)}
            title={bloqueio ?? undefined}
            onClick={() => setAberto(true)}
          >
            {rotulo}
          </button>
        </div>
        {bloqueio && <p className="dica">{bloqueio}</p>}
      </div>
    );
  }

  return (
    <div className="confirmacao" role="dialog" aria-labelledby="confirmar-situacao">
      <p id="confirmar-situacao">
        {inativar
          ? "Inativar o equipamento? Ele deixa de entrar em novos PMOCs, ocorrências e visitas; o histórico continua. A TAG não é reaproveitada."
          : "Reativar o equipamento? Ele volta a entrar nos novos PMOCs."}
      </p>
      {erro && <p className="alerta erro">{erro}</p>}
      <div className="linha">
        <button type="button" className="botao" disabled={!pronto || enviando} onClick={confirmar}>
          {enviando ? "Salvando…" : `Confirmar: ${rotulo.toLowerCase()}`}
        </button>
        <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
          Voltar
        </button>
      </div>
    </div>
  );
}
