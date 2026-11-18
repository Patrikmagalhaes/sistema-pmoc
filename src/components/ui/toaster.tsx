"use client";
import { Toaster as Sonner, toast } from "sonner";

/**
 * Toast (doc 08 §3.10, sonner): resultado de ação concluída. Topo à direita no desktop, topo em
 * largura total no celular; máx. 3 empilhados.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      visibleToasts={3}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !shadow-2 !font-sans !text-body !items-start !gap-3 !px-4 !py-3",
          success: "!border-success-border !bg-success-bg !text-success-text",
          error: "!border-danger-border !bg-danger-bg !text-danger-text",
          closeButton: "!bg-surface !border-border !text-text-muted",
        },
      }}
    />
  );
}

/** Sucesso some em 5 s; erro não some sozinho (§3.10). */
export const avisar = {
  sucesso: (texto: string) => toast.success(texto, { duration: 5000 }),
  erro: (texto: string) => toast.error(texto, { duration: Number.POSITIVE_INFINITY }),
};
