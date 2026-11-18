import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./button";

/**
 * Paginação no servidor (doc 08 §3.5; UL-01): "Mostrando {a}–{b} de {total}", Anterior, números
 * (máx. 5 visíveis) e Próxima. Mantém os filtros (a URL vem do chamador).
 */
export function Pagination({
  pagina,
  porPagina,
  total,
  url,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  url: (p: number) => string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const a = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const b = Math.min(total, pagina * porPagina);
  const inicio = Math.max(1, Math.min(pagina - 2, paginas - 4));
  const numeros = Array.from({ length: Math.min(5, paginas) }, (_, i) => inicio + i);
  const passo = buttonClasses({ variant: "tertiary", size: "sm" });

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
      <p className="text-small text-text-muted tabular-nums">
        Mostrando {a}–{b} de {total}
      </p>
      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1">
          {pagina > 1 && (
            <Link href={url(pagina - 1)} className={passo}>
              <ChevronLeft size={16} aria-hidden="true" />
              Anterior
            </Link>
          )}
          <span className="hidden items-center gap-1 sm:flex">
            {numeros.map((n) => (
              <Link
                key={n}
                href={url(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={cn(passo, "min-w-9 tabular-nums", n === pagina && "bg-action-subtle")}
              >
                {n}
              </Link>
            ))}
          </span>
          <span className="text-small text-text-muted sm:hidden">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={url(pagina + 1)} className={passo}>
              Próxima
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
