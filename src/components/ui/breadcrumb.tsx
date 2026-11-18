import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export type Migalha = { rotulo: string; href?: string };

/**
 * Breadcrumb (doc 08 §3.9): do 2º nível em diante. O último item é a página atual, sem link.
 * Abaixo de md mostra só "‹ {pai}".
 */
export function Breadcrumb({ itens }: { itens: Migalha[] }) {
  if (itens.length === 0) return null;
  const pai = [...itens].reverse().find((i) => i.href);
  return (
    <nav aria-label="Você está em" className="text-small">
      {pai?.href && (
        <Link
          href={pai.href}
          className="inline-flex min-h-11 items-center gap-1 text-link md:hidden"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {pai.rotulo}
        </Link>
      )}
      <ol className="hidden flex-wrap items-center gap-1 text-text-muted md:flex">
        {itens.map((i, n) => (
          <li key={i.href ?? i.rotulo} className="flex items-center gap-1">
            {n > 0 && (
              <ChevronRight size={16} className="text-icon-decorative" aria-hidden="true" />
            )}
            {i.href ? (
              <Link href={i.href} className="text-link">
                {i.rotulo}
              </Link>
            ) : (
              <span aria-current="page" className="text-text">
                {i.rotulo}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
