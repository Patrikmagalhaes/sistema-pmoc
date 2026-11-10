"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { cancelarContratoAction, confirmarRenovacaoAction } from "../../clientes/actions";

/** TL-112: Renovar, Confirmar renovação (RN-192) e Cancelar contrato (RN-144). */
export function AcoesContrato({
  id,
  rowVersion,
  localId,
  inicio,
  fim,
  podeRenovar,
  podeConfirmarRenovacao,
  podeCancelar,
  temPmoc,
}: {
  id: string;
  rowVersion: number;
  localId: string;
  inicio: string;
  fim: string;
  podeRenovar: boolean;
  podeConfirmarRenovacao: boolean;
  podeCancelar: boolean;
  temPmoc: boolean;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [aberto, setAberto] = useState<"confirmar" | "cancelar" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);

  const conflito = "Este registro foi alterado por outra pessoa. Recarregue a página.";

  async function confirmarRenovacao() {
    setEnviando(true);
    setErro(null);
    const r = await chamarAcao(confirmarRenovacaoAction({ id, rowVersion }));
    setEnviando(false);
    if (r.tipo === "conflito") return setErro(conflito);
    if (r.tipo === "erro") return setErro(r.mensagem);
    setAberto(null);
    router.refresh();
  }

  async function cancelar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const data = String(f.get("data") ?? "");
    const motivo = String(f.get("motivo") ?? "").trim();
    const e: Record<string, string> = {};
    if (!data) e.data = "Informe a data de cancelamento.";
    else if (data < inicio || data > fim)
      e.data = "A data fica entre o início e o fim do contrato.";
    if (!motivo) e.motivo = "Informe o motivo do cancelamento."; // RN-144: obrigatório
    setErros(e);
    setErro(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const r = await chamarAcao(cancelarContratoAction({ id, rowVersion, data, motivo }));
    setEnviando(false);
    if (r.tipo === "conflito") return setErro(conflito);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setErro(r.mensagem);
    }
    setAberto(null);
    router.refresh();
  }

  if (aberto === "confirmar") {
    return (
      <div className="confirmacao" role="dialog" aria-labelledby="confirmar-renovacao">
        <p id="confirmar-renovacao">
          Confirmar a renovação? O PMOC do contrato anterior passa a <strong>Histórico</strong>{" "}
          agora. As visitas que restam do contrato anterior continuam válidas e podem ser
          registradas.
        </p>
        {erro && <p className="alerta erro">{erro}</p>}
        <div className="linha">
          <button
            type="button"
            className="botao"
            disabled={!pronto || enviando}
            onClick={confirmarRenovacao}
          >
            {enviando ? "Confirmando…" : "Confirmar renovação"}
          </button>
          <button type="button" className="botao secundario" onClick={() => setAberto(null)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (aberto === "cancelar") {
    return (
      <form
        onSubmit={cancelar}
        noValidate
        className="confirmacao"
        role="dialog"
        aria-labelledby="confirmar-cancelamento"
      >
        <p id="confirmar-cancelamento">
          Cancelar o contrato? O cancelamento é definitivo: o contrato fica somente leitura
          {temPmoc ? " e o PMOC passa a Histórico" : ""}. Nenhuma visita ou ocorrência é afetada,
          porque o PMOC ainda não foi emitido.
        </p>
        <div className="grade">
          <div className="campo">
            <label htmlFor="data">Data de cancelamento</label>
            <input
              id="data"
              name="data"
              type="date"
              min={inicio}
              max={fim}
              aria-invalid={Boolean(erros.data)}
            />
            {erros.data && <span className="erro">{erros.data}</span>}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="motivo">Motivo</label>
          <textarea id="motivo" name="motivo" rows={2} aria-invalid={Boolean(erros.motivo)} />
          {erros.motivo && <span className="erro">{erros.motivo}</span>}
        </div>
        {erro && !Object.keys(erros).length && <p className="alerta erro">{erro}</p>}
        <div className="linha">
          <button type="submit" className="botao perigo" disabled={!pronto || enviando}>
            {enviando ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
          <button type="button" className="botao secundario" onClick={() => setAberto(null)}>
            Voltar
          </button>
        </div>
      </form>
    );
  }

  if (!podeRenovar && !podeConfirmarRenovacao && !podeCancelar) return null;
  return (
    <div className="acoes">
      <div className="linha">
        {podeRenovar && (
          <Link
            className="botao secundario"
            style={{ width: "auto" }}
            href={`/adm/contratos/novo?local=${localId}&anterior=${id}`}
          >
            Renovar
          </Link>
        )}
        {podeConfirmarRenovacao && (
          <button
            type="button"
            className="botao secundario"
            style={{ width: "auto" }}
            disabled={!pronto}
            onClick={() => setAberto("confirmar")}
          >
            Confirmar renovação
          </button>
        )}
        {podeCancelar && (
          <button
            type="button"
            className="botao secundario perigo"
            style={{ width: "auto" }}
            disabled={!pronto}
            onClick={() => setAberto("cancelar")}
          >
            Cancelar contrato
          </button>
        )}
      </div>
    </div>
  );
}
