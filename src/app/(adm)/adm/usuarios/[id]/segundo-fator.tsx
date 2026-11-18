"use client";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
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
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);

  return (
    <ConfirmDialog
      gatilho={{
        rotulo: "Redefinir segundo fator",
        variant: "secondary",
        icone: <KeyRound size={20} aria-hidden="true" />,
      }}
      titulo={`Redefinir o segundo fator de ${nome}?`}
      efeito="O aplicativo autenticador e os códigos de recuperação atuais deixam de valer, as sessões abertas são encerradas e, no próximo login, o usuário precisa configurar o aplicativo de novo."
      confirmar={{ rotulo: "Redefinir segundo fator", carregando: "Redefinindo…" }}
      onConfirmar={async (f) => {
        const motivo = String(f.get("motivo") ?? "").trim();
        if (!motivo) {
          setErroMotivo("Informe o motivo.");
          return false;
        }
        setErroMotivo(null);
        try {
          const r = await redefinirSegundoFatorAction({ id, motivo });
          if (r?.serverError === "SESSAO_EXPIRADA") {
            window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          const d = r?.data;
          if (!d) return r?.serverError ?? "Não foi possível concluir.";
          if (!d.ok) {
            if (d.campos?.motivo) {
              setErroMotivo(d.campos.motivo);
              return false;
            }
            return d.mensagem;
          }
          avisar.sucesso(
            "Segundo fator redefinido. As sessões foram encerradas; no próximo login o usuário configura o aplicativo de novo.",
          );
          router.refresh();
        } catch {
          return "Não foi possível concluir. Verifique a conexão e tente novamente.";
        }
      }}
    >
      <Field
        id="motivo-2fa"
        label="Motivo"
        erro={erroMotivo}
        dica={erroMotivo ? undefined : "Fica registrado na auditoria."}
      >
        <Textarea name="motivo" rows={3} maxLength={motivoMax} />
      </Field>
    </ConfirmDialog>
  );
}
