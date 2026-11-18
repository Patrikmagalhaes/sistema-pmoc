import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Tabs por URL (`?aba=`, doc 08 §3.9): dividem conteúdo da mesma entidade; a página renderiza só a
 * ativa. Abaixo de md a lista rola na horizontal, sem quebrar.
 */
export function Tabs({
  base,
  ativa,
  abas,
  rotulo = "Seções",
}: {
  base: string;
  ativa: string;
  abas: { id: string; rotulo: string; contador?: number }[];
  rotulo?: string;
}) {
  return (
    <nav aria-label={rotulo} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {abas.map((a) => {
          const atual = a.id === ativa;
          return (
            <li key={a.id}>
              <Link
                href={`${base}${base.includes("?") ? "&" : "?"}aba=${a.id}`}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-body-strong no-underline hover:no-underline",
                  atual
                    ? "border-action text-action"
                    : "border-transparent text-text-muted hover:border-border hover:text-text",
                )}
              >
                {a.rotulo}
                {a.contador !== undefined && (
                  <span className="rounded-full bg-surface-muted px-2 text-caption text-text-label tabular-nums">
                    {a.contador}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
