"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHidratado } from "@/lib/use-hidratado";
import { inativarUsuarioAction, reativarUsuarioAction, reenviarLinkAction } from "../actions";

type Acao = "inativar" | "reativar" | "reenviar";

/** TL-107: ações sobre o usuário. Não existe "Excluir" (RN-141). */
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
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function executar(acao: Acao) {
    setEnviando(acao);
    setMsg(null);
    try {
      const r =
        acao === "inativar"
          ? await inativarUsuarioAction({ id, rowVersion })
          : acao === "reativar"
            ? await reativarUsuarioAction({ id, rowVersion })
            : await reenviarLinkAction({ id });
      if (r?.serverError === "SESSAO_EXPIRADA") {
        window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const d = r?.data;
      if (!d)
        return setMsg({ tipo: "erro", texto: r?.serverError ?? "Não foi possível concluir." });
      if (!d.ok) return setMsg({ tipo: "erro", texto: d.mensagem });
      setConfirmando(false);
      setMsg({
        tipo: "ok",
        texto:
          acao === "reenviar"
            ? "Link enviado. Ele vale por 72 horas."
            : acao === "inativar"
              ? "Usuário inativado. As sessões dele foram encerradas."
              : "Usuário reativado.",
      });
      router.refresh();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(null);
    }
  }

  const desabilitado = !pronto || enviando !== null;

  return (
    <div className="acoes">
      {msg && (
        <div className={`alerta ${msg.tipo}`} role="status">
          {msg.texto}
        </div>
      )}
      {confirmando ? (
        // UF-09: confirmação que diz o efeito.
        <div className="confirmacao" role="dialog" aria-labelledby="confirmar-inativar">
          <p id="confirmar-inativar">
            Inativar <strong>{nome}</strong>? O usuário perde o acesso na hora (as sessões abertas
            são encerradas) e deixa de receber notificações. Os registros e assinaturas anteriores
            permanecem.
          </p>
          <div className="linha">
            <button
              type="button"
              className="botao perigo"
              disabled={desabilitado}
              onClick={() => executar("inativar")}
            >
              {enviando === "inativar" ? "Inativando…" : "Confirmar inativação"}
            </button>
            <button
              type="button"
              className="botao secundario"
              onClick={() => setConfirmando(false)}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="linha">
          {situacao === "ATIVO" && (
            <button
              type="button"
              className="botao secundario"
              disabled={desabilitado}
              onClick={() => executar("reenviar")}
            >
              {enviando === "reenviar" ? "Enviando…" : "Reenviar link de senha"}
            </button>
          )}
          {situacao === "ATIVO" && (
            <button
              type="button"
              className="botao secundario perigo"
              disabled={desabilitado || proprio}
              title={proprio ? "Você não pode inativar o próprio usuário." : undefined}
              onClick={() => setConfirmando(true)}
            >
              Inativar
            </button>
          )}
          {situacao === "INATIVO" && (
            <button
              type="button"
              className="botao secundario"
              disabled={desabilitado}
              onClick={() => executar("reativar")}
            >
              {enviando === "reativar" ? "Reativando…" : "Reativar"}
            </button>
          )}
        </div>
      )}
      {proprio && situacao === "ATIVO" && (
        <p className="dica">Você não pode inativar o próprio usuário.</p>
      )}
    </div>
  );
}
