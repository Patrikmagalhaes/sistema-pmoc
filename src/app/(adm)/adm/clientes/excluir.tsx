"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { excluirEquipamentoAction } from "../equipamentos/actions";
import { excluirClienteAction, excluirContratoAction, excluirLocalAction } from "./actions";

const ROTULO = {
  cliente: { botao: "Excluir cliente", feito: "Cliente excluído." },
  local: { botao: "Excluir local", feito: "Local excluído." },
  contrato: { botao: "Excluir contrato", feito: "Contrato excluído." },
  equipamento: { botao: "Excluir equipamento", feito: "Equipamento excluído." },
} as const;

/**
 * "Excluir cliente" (TL-109), "Excluir local" (TL-110), "Excluir" do contrato (TL-112) e do
 * equipamento (TL-111): exclusão lógica com motivo opcional (UF-10), em AlertDialog (doc 08 §3.8).
 * Com filhos vivos, o botão fica desabilitado com a dica do motivo (E-04.7; EL-7).
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
  const r = ROTULO[alvo];

  return (
    <ConfirmDialog
      gatilho={{
        rotulo: r.botao,
        bloqueio,
        icone: <Trash2 size={20} aria-hidden="true" />,
      }}
      titulo={`Excluir ${nome}?`}
      efeito="O registro sai das telas e listas; o histórico fica na auditoria."
      confirmar={{ rotulo: r.botao, carregando: "Excluindo…" }}
      onConfirmar={async (f) => {
        const motivo = String(f.get("motivo") ?? "").trim() || null;
        const entrada = { id, rowVersion, motivo };
        const res =
          alvo === "cliente"
            ? await chamarAcao(excluirClienteAction(entrada))
            : alvo === "local"
              ? await chamarAcao(excluirLocalAction(entrada))
              : alvo === "contrato"
                ? await chamarAcao(excluirContratoAction(entrada))
                : await chamarAcao(excluirEquipamentoAction(entrada));
        if (res.tipo === "conflito")
          return "Este registro foi alterado por outra pessoa. Recarregue a página.";
        if (res.tipo === "erro") return res.mensagem;
        avisar.sucesso(r.feito);
        router.push(depois);
      }}
    >
      <Field id="motivo" label="Motivo" opcional>
        <Textarea name="motivo" rows={2} />
      </Field>
    </ConfirmDialog>
  );
}
