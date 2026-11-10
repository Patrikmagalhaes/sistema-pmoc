"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useHidratado } from "@/lib/use-hidratado";
import { redefinirSegundoFatorAction } from "../actions";

/**
 * TL-107 "Redefinir segundo fator" (SEG-17; RN-194): para o ADM que perdeu o aplicativo e os códigos
 * de recuperação. Motivo obrigatório (UF-10: exceção de segurança), gravado no `audit_log`.
 */
export function RedefinirSegundoFator({
  id,
  nome,
  motivoMax,
}: {
  id: string;
  nome: string;
  motivoMax: number;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "").trim();
    setMsg(null);
    if (!motivo) return setErroMotivo("Informe o motivo.");
    setErroMotivo(null);
    setEnviando(true);
    try {
      const r = await redefinirSegundoFatorAction({ id, motivo });
      if (r?.serverError === "SESSAO_EXPIRADA") {
        window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const d = r?.data;
      if (!d)
        return setMsg({ tipo: "erro", texto: r?.serverError ?? "Não foi possível concluir." });
      if (!d.ok) {
        if (d.campos?.motivo) return setErroMotivo(d.campos.motivo);
        return setMsg({ tipo: "erro", texto: d.mensagem });
      }
      setAberto(false);
      setMsg({
        tipo: "ok",
        texto:
          "Segundo fator redefinido. As sessões foram encerradas; no próximo login o usuário configura o aplicativo de novo.",
      });
      router.refresh();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="acoes">
      {msg && (
        <div className={`alerta ${msg.tipo}`} role="status">
          {msg.texto}
        </div>
      )}
      {aberto ? (
        <form
          onSubmit={confirmar}
          noValidate
          className="confirmacao"
          role="dialog"
          aria-labelledby="confirmar-redefinir"
        >
          <p id="confirmar-redefinir">
            Redefinir o segundo fator de <strong>{nome}</strong>? O aplicativo autenticador e os
            códigos de recuperação atuais deixam de valer, as sessões abertas são encerradas e, no
            próximo login, o usuário precisa configurar o aplicativo de novo.
          </p>
          <div className="campo">
            <label htmlFor="motivo">Motivo</label>
            <textarea
              id="motivo"
              name="motivo"
              rows={3}
              maxLength={motivoMax}
              aria-invalid={Boolean(erroMotivo)}
            />
            {erroMotivo ? (
              <span className="erro">{erroMotivo}</span>
            ) : (
              <span className="dica">Fica registrado na auditoria.</span>
            )}
          </div>
          <div className="linha">
            <button type="submit" className="botao perigo" disabled={!pronto || enviando}>
              {enviando ? "Redefinindo…" : "Confirmar redefinição"}
            </button>
            <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
              Voltar
            </button>
          </div>
        </form>
      ) : (
        <div className="linha">
          <button
            type="button"
            className="botao secundario"
            disabled={!pronto}
            onClick={() => setAberto(true)}
          >
            Redefinir segundo fator
          </button>
        </div>
      )}
    </div>
  );
}
