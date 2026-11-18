"use client";
import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** `ConflictAlert` (doc 08 §3.15; UF-07): o registro mudou desde que a tela abriu; nada é sobrescrito. */
export function Conflito() {
  return (
    <Alert
      tom="warning"
      titulo="Este registro foi alterado por outra pessoa."
      acao={
        <Button
          icon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={() => window.location.reload()}
        >
          Recarregar
        </Button>
      }
    >
      Recarregue para ver a versão atual antes de salvar.
    </Alert>
  );
}
