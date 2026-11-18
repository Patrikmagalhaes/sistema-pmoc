import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/**
 * Template T-AUTH (doc 08 §4.3, §4.1.4): logo centralizado → Card de 400 px com `h1` e formulário
 * de 1 coluna. Sem navegação de área. `largo` = `content-form` (TL-004).
 */
export function AuthCard({
  titulo,
  descricao,
  largo = false,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-page px-4 py-8">
      <Logo />
      <div
        className={cn(
          "w-full rounded-lg border border-border bg-surface p-6 shadow-1 md:p-8",
          largo ? "max-w-content-form" : "max-w-content-auth",
        )}
      >
        <h1 className="text-h2 text-text">{titulo}</h1>
        {descricao && <p className="mt-2 text-body text-text-muted">{descricao}</p>}
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}
