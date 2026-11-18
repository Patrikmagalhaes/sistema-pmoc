import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "./button";

/**
 * Barra de filtros (doc 08 §3.5; UL-02): campos em linha, filtros na URL (GET), "Filtrar" e
 * "Limpar filtros" (com filtro ativo), e chips removíveis dos filtros ativos.
 */
export function FilterBar({
  children,
  ocultos,
  chips = [],
  limparHref,
  rotuloBotao = "Filtrar",
}: {
  children: ReactNode;
  /** Parâmetros da URL a manter (ex.: `aba`). */
  ocultos?: Record<string, string>;
  chips?: { rotulo: string; removerHref: string }[];
  limparHref: string;
  rotuloBotao?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        aria-label="Filtros"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-1 md:flex-row md:flex-wrap md:items-end"
      >
        {ocultos &&
          Object.entries(ocultos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        {children}
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            {rotuloBotao}
          </button>
          {chips.length > 0 && (
            <Link href={limparHref} className={buttonClasses({ variant: "tertiary" })}>
              Limpar filtros
            </Link>
          )}
        </div>
      </form>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {chips.map((c) => (
            <li key={c.rotulo}>
              <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-action-border bg-action-subtle py-0.5 pr-1 pl-3 text-small text-action">
                {c.rotulo}
                <Link
                  href={c.removerHref}
                  aria-label={`Remover filtro ${c.rotulo}`}
                  className="inline-flex size-7 items-center justify-center rounded-full text-action hover:bg-action-strong-bg"
                >
                  <X size={16} aria-hidden="true" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** URL da lista com parâmetros trocados ou removidos (`null`), para chips e paginação. */
export function urlCom(
  base: string,
  atuais: Record<string, string | null | undefined>,
  mudar: Record<string, string | null> = {},
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atuais, ...mudar })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
