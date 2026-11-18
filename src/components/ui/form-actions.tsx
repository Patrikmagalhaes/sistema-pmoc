import type { ReactNode } from "react";

/**
 * ActionBar do formulário (doc 08 §3.15, T-FORM 5): fixa no rodapé da tela enquanto o formulário
 * está visível, "Cancelar" à esquerda do "Salvar". No celular, botões empilhados em largura total,
 * primário em cima.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-sticky flex flex-col-reverse gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-2 sm:flex-row sm:justify-end *:w-full sm:*:w-auto">
      {children}
    </div>
  );
}
