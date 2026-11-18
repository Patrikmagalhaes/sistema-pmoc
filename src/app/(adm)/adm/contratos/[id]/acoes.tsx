"use client";
import { Ban, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { cancelarContratoAction, confirmarRenovacaoAction } from "../../clientes/actions";

const CONFLITO = "Este registro foi alterado por outra pessoa. Recarregue a página.";

/** TL-112: Renovar, Confirmar renovação (RN-192) e Cancelar contrato (RN-144), no PageHeader. */
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
  const [erros, setErros] = useState<Record<string, string | undefined>>({});

  if (!podeRenovar && !podeConfirmarRenovacao && !podeCancelar) return null;
  return (
    <>
      {podeRenovar && (
        <Link
          href={`/adm/contratos/novo?local=${localId}&anterior=${id}`}
          className={buttonClasses({ variant: "secondary" })}
        >
          <RefreshCw size={20} aria-hidden="true" />
          Renovar
        </Link>
      )}
      {podeConfirmarRenovacao && (
        <ConfirmDialog
          destrutiva={false}
          gatilho={{
            rotulo: "Confirmar renovação",
            icone: <CheckCircle2 size={20} aria-hidden="true" />,
          }}
          titulo="Confirmar a renovação?"
          efeito={
            <>
              O PMOC do contrato anterior passa a <strong>Histórico</strong> agora. As visitas que
              restam do contrato anterior continuam válidas e podem ser registradas.
            </>
          }
          confirmar={{ rotulo: "Confirmar renovação", carregando: "Confirmando…" }}
          onConfirmar={async () => {
            const r = await chamarAcao(confirmarRenovacaoAction({ id, rowVersion }));
            if (r.tipo === "conflito") return CONFLITO;
            if (r.tipo === "erro") return r.mensagem;
            avisar.sucesso("Renovação confirmada.");
            router.refresh();
          }}
        />
      )}
      {podeCancelar && (
        <ConfirmDialog
          gatilho={{ rotulo: "Cancelar contrato", icone: <Ban size={20} aria-hidden="true" /> }}
          titulo="Cancelar o contrato?"
          efeito={`O cancelamento é definitivo: o contrato fica somente leitura${
            temPmoc ? " e o PMOC passa a Histórico" : ""
          }. Nenhuma visita ou ocorrência é afetada, porque o PMOC ainda não foi emitido.`}
          confirmar={{ rotulo: "Cancelar contrato", carregando: "Cancelando…" }}
          onConfirmar={async (f) => {
            const data = String(f.get("data") ?? "");
            const motivo = String(f.get("motivo") ?? "").trim();
            const e: Record<string, string> = {};
            if (!data) e.data = "Informe a data de cancelamento.";
            else if (data < inicio || data > fim)
              e.data = "A data fica entre o início e o fim do contrato.";
            if (!motivo) e.motivo = "Informe o motivo do cancelamento."; // RN-144: obrigatório
            setErros(e);
            if (Object.keys(e).length) return false;
            const r = await chamarAcao(cancelarContratoAction({ id, rowVersion, data, motivo }));
            if (r.tipo === "conflito") return CONFLITO;
            if (r.tipo === "erro") {
              if (r.campos) {
                setErros(r.campos);
                return false;
              }
              return r.mensagem;
            }
            avisar.sucesso("Contrato cancelado.");
            router.refresh();
          }}
        >
          <Field id="data" label="Data de cancelamento" erro={erros.data}>
            <Input name="data" type="date" min={inicio} max={fim} className="tabular-nums" />
          </Field>
          <Field id="motivo" label="Motivo" erro={erros.motivo}>
            <Textarea name="motivo" rows={2} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
