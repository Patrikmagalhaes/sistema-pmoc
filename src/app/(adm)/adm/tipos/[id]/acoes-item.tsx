"use client";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { avisar } from "@/components/ui/toaster";
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

const NOME: Record<Alvo, string> = { tipo: "tipo", grupo: "grupo", atividade: "atividade" };

/**
 * TL-105: Inativar / Reativar / Excluir (RN-044; EL-4). Com uso, só "Inativar"; Inativar e Excluir
 * pedem confirmação dizendo o efeito (UF-09, FE-H5.1); Reativar não (doc 08 §5.3).
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
  compacto = false,
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
  /** Dentro de linha de tabela: botões `sm`, alinhados ao início. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [reativando, setReativando] = useState(false);
  const tamanho = compacto ? "sm" : "md";
  const alinhar = compacto ? "inicio" : "fim";

  async function executar(acao: "inativar" | "reativar" | "excluir") {
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
    if (r.tipo === "conflito")
      return "Este registro foi alterado por outra pessoa. Recarregue a página.";
    if (r.tipo === "erro") return r.mensagem;
    if (acao === "excluir" && aoExcluir) router.push(aoExcluir);
    else router.refresh();
    return null;
  }

  return (
    <div
      className={
        compacto
          ? "flex flex-wrap items-start gap-2 md:flex-nowrap"
          : "flex flex-wrap items-start gap-2"
      }
    >
      {situacao === "ATIVO" ? (
        <ConfirmDialog
          gatilho={{
            rotulo: "Inativar",
            variant: "secondary",
            tamanho,
            alinhar,
            icone: compacto ? undefined : <Ban size={20} aria-hidden="true" />,
          }}
          titulo={`Inativar ${nome}?`}
          efeito={EFEITO[alvo].inativar}
          confirmar={{ rotulo: `Inativar ${NOME[alvo]}`, carregando: "Inativando…" }}
          onConfirmar={() => executar("inativar")}
        />
      ) : (
        <Button
          size={tamanho}
          icon={compacto ? undefined : <RotateCcw size={20} aria-hidden="true" />}
          disabled={!pronto}
          loading={reativando}
          onClick={async () => {
            setReativando(true);
            const erro = await executar("reativar");
            setReativando(false);
            if (erro) avisar.erro(erro);
          }}
        >
          {reativando ? "Reativando…" : "Reativar"}
        </Button>
      )}
      {!emUso && (
        <ConfirmDialog
          gatilho={{
            rotulo: "Excluir",
            tamanho,
            alinhar,
            bloqueio: motivoSemExcluir ?? null,
            icone: compacto ? undefined : <Trash2 size={20} aria-hidden="true" />,
          }}
          titulo={`Excluir ${nome}?`}
          efeito={EFEITO[alvo].excluir}
          confirmar={{ rotulo: `Excluir ${NOME[alvo]}`, carregando: "Excluindo…" }}
          onConfirmar={() => executar("excluir")}
        />
      )}
    </div>
  );
}
