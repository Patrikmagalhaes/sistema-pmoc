import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Card (doc 08 §3.6): agrupa um bloco. Título `h2` + ação opcional à direita. Nunca card dentro de
 * card: dentro, use `Section` sem borda ou divisor.
 */
export function Card({
  titulo,
  descricao,
  acao,
  children,
  className,
  rodape,
  id,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
  rodape?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("rounded-lg border border-border bg-surface shadow-1", className)}
    >
      {(titulo || acao) && (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-4 px-4 pt-4 md:px-6 md:pt-6",
            children === undefined && "pb-4 md:pb-6",
          )}
        >
          <div className="min-w-0">
            {titulo && <h2 className="text-h3 text-text">{titulo}</h2>}
            {descricao && <p className="mt-1 text-small text-text-muted">{descricao}</p>}
          </div>
          {acao && <div className="flex shrink-0 flex-wrap gap-2">{acao}</div>}
        </header>
      )}
      {children !== undefined && <div className="p-4 md:p-6">{children}</div>}
      {rodape && (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle px-4 py-3 md:px-6">
          {rodape}
        </footer>
      )}
    </section>
  );
}

/** Subgrupo dentro de um Card (título `h3`/h4), separado por divisor; espaço de grupo = 24 px. */
export function Fieldset({
  legenda,
  children,
  className,
}: {
  legenda: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-4 border-t border-border-subtle pt-6", className)}
    >
      <legend className="float-left mb-4 w-full text-h4 text-text">{legenda}</legend>
      {children}
    </fieldset>
  );
}
