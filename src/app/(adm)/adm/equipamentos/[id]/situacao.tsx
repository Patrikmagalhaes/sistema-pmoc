"use client";
import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { alterarSituacaoEquipamentoAction } from "../actions";

const CONFLITO = "Este registro foi alterado por outra pessoa. Recarregue a página.";

/**
 * TL-111 "Inativar" (RN-152), com confirmação (FE-H5.1), e "Reativar" [A VALIDAR], sem confirmação
 * (doc 08 §5.3).
 */
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
  const [enviando, setEnviando] = useState(false);

  const alterar = async (nova: "ATIVO" | "INATIVO") => {
    const r = await chamarAcao(
      alterarSituacaoEquipamentoAction({ id, rowVersion, situacao: nova }),
    );
    if (r.tipo === "conflito") return CONFLITO;
    if (r.tipo === "erro") return r.mensagem;
    avisar.sucesso(nova === "INATIVO" ? "Equipamento inativado." : "Equipamento reativado.");
    router.refresh();
    return null;
  };

  if (situacao === "ATIVO") {
    return (
      <ConfirmDialog
        gatilho={{ rotulo: "Inativar", bloqueio, icone: <Ban size={20} aria-hidden="true" /> }}
        titulo="Inativar o equipamento?"
        efeito="Ele deixa de entrar em novos PMOCs, ocorrências e visitas; o histórico continua. A TAG não é reaproveitada."
        confirmar={{ rotulo: "Inativar equipamento", carregando: "Inativando…" }}
        onConfirmar={() => alterar("INATIVO")}
      />
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        icon={<RotateCcw size={20} aria-hidden="true" />}
        disabled={!pronto || Boolean(bloqueio)}
        loading={enviando}
        title={bloqueio ?? undefined}
        onClick={async () => {
          setEnviando(true);
          const erro = await alterar("ATIVO");
          setEnviando(false);
          if (erro) avisar.erro(erro);
        }}
      >
        {enviando ? "Reativando…" : "Reativar"}
      </Button>
      {bloqueio && <p className="max-w-prose text-small text-text-muted">{bloqueio}</p>}
    </div>
  );
}
