"use client";
import { Ban, Mail, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { avisar } from "@/components/ui/toaster";
import { useHidratado } from "@/lib/use-hidratado";
import { inativarUsuarioAction, reativarUsuarioAction, reenviarLinkAction } from "../actions";

type Acao = "inativar" | "reativar" | "reenviar";

const FEITO: Record<Acao, string> = {
  reenviar: "Link enviado. Ele vale por 72 horas.",
  inativar: "Usuário inativado. As sessões dele foram encerradas.",
  reativar: "Usuário reativado.",
};

/**
 * TL-107: ações sobre o usuário, no PageHeader. Não existe "Excluir" (RN-141). "Inativar" pede
 * confirmação (FE-H5.1); "Reativar" e "Reenviar link" não.
 */
export function AcoesUsuario({
  id,
  rowVersion,
  nome,
  situacao,
  proprio,
}: {
  id: string;
  rowVersion: number;
  nome: string;
  situacao: "ATIVO" | "INATIVO";
  proprio: boolean;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState<Acao | null>(null);

  /** Devolve a mensagem de erro, ou `null` em sucesso. */
  async function executar(acao: Acao): Promise<string | null> {
    try {
      const r =
        acao === "inativar"
          ? await inativarUsuarioAction({ id, rowVersion })
          : acao === "reativar"
            ? await reativarUsuarioAction({ id, rowVersion })
            : await reenviarLinkAction({ id });
      if (r?.serverError === "SESSAO_EXPIRADA") {
        window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
        return null;
      }
      const d = r?.data;
      if (!d) return r?.serverError ?? "Não foi possível concluir.";
      if (!d.ok) return d.mensagem;
      avisar.sucesso(FEITO[acao]);
      router.refresh();
      return null;
    } catch {
      return "Não foi possível concluir. Verifique a conexão e tente novamente.";
    }
  }

  async function direto(acao: Acao) {
    setEnviando(acao);
    const erro = await executar(acao);
    setEnviando(null);
    if (erro) avisar.erro(erro);
  }

  if (situacao === "INATIVO") {
    return (
      <Button
        icon={<RotateCcw size={20} aria-hidden="true" />}
        disabled={!pronto}
        loading={enviando === "reativar"}
        onClick={() => direto("reativar")}
      >
        {enviando === "reativar" ? "Reativando…" : "Reativar"}
      </Button>
    );
  }

  return (
    <>
      <Button
        icon={<Mail size={20} aria-hidden="true" />}
        disabled={!pronto || enviando !== null}
        loading={enviando === "reenviar"}
        onClick={() => direto("reenviar")}
      >
        {enviando === "reenviar" ? "Enviando…" : "Reenviar link de senha"}
      </Button>
      {/* UF-09: confirmação que diz o efeito. */}
      <ConfirmDialog
        gatilho={{
          rotulo: "Inativar",
          icone: <Ban size={20} aria-hidden="true" />,
          bloqueio: proprio ? "Você não pode inativar o próprio usuário." : null,
        }}
        titulo={`Inativar ${nome}?`}
        efeito="O usuário perde o acesso na hora (as sessões abertas são encerradas) e deixa de receber notificações. Os registros e assinaturas anteriores permanecem."
        confirmar={{ rotulo: "Inativar usuário", carregando: "Inativando…" }}
        onConfirmar={() => executar("inativar")}
      />
    </>
  );
}
