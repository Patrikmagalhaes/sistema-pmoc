"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { excluirEquipamentoAction } from "../equipamentos/actions";
import { excluirClienteAction, excluirContratoAction, excluirLocalAction } from "./actions";

/**
 * "Excluir cliente" (TL-109), "Excluir local" (TL-110), "Excluir" do contrato (TL-112) e do
 * equipamento (TL-111): exclusão lógica com motivo opcional (UF-10). Com filhos vivos, o botão fica
 * desabilitado com a dica do motivo (E-04.7; EL-7).
 */
export function Excluir({
  alvo,
  id,
  rowVersion,
  nome,
  bloqueio,
  depois,
}: {
  alvo: "cliente" | "local" | "contrato" | "equipamento";
  id: string;
  rowVersion: number;
  nome: string;
  /** Motivo de não poder excluir; `null` = pode. */
  bloqueio: string | null;
  /** Para onde ir depois de excluir. */
  depois: string;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const motivo = String(new FormData(ev.currentTarget).get("motivo") ?? "").trim() || null;
    setEnviando(true);
    const entrada = { id, rowVersion, motivo };
    const r =
      alvo === "cliente"
        ? await chamarAcao(excluirClienteAction(entrada))
        : alvo === "local"
          ? await chamarAcao(excluirLocalAction(entrada))
          : alvo === "contrato"
            ? await chamarAcao(excluirContratoAction(entrada))
            : await chamarAcao(excluirEquipamentoAction(entrada));
    setEnviando(false);
    if (r.tipo === "conflito")
      return setErro("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") return setErro(r.mensagem);
    router.push(depois);
  }

  if (!aberto) {
    return (
      <div className="acoes">
        <div className="linha">
          <button
            type="button"
            className="botao secundario perigo"
            style={{ width: "auto" }}
            disabled={!pronto || Boolean(bloqueio)}
            title={bloqueio ?? undefined}
            onClick={() => setAberto(true)}
          >
            Excluir {alvo}
          </button>
        </div>
        {bloqueio && <p className="dica">{bloqueio}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={confirmar}
      noValidate
      className="confirmacao"
      role="dialog"
      aria-labelledby="confirmar-excluir"
    >
      <p id="confirmar-excluir">
        Excluir <strong>{nome}</strong>? O registro sai das telas e listas; o histórico fica na
        auditoria.
      </p>
      <div className="campo">
        <label htmlFor="motivo">Motivo (opcional)</label>
        <textarea id="motivo" name="motivo" rows={2} />
      </div>
      {erro && (
        <div className="alerta erro" role="status">
          {erro}
        </div>
      )}
      <div className="linha">
        <button type="submit" className="botao perigo" disabled={!pronto || enviando}>
          {enviando ? "Excluindo…" : "Confirmar exclusão"}
        </button>
        <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
          Voltar
        </button>
      </div>
    </form>
  );
}
