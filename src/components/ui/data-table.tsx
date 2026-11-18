import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Coluna<T> = {
  titulo: string;
  celula: (linha: T) => ReactNode;
  /** Números, datas e TAG: `tabular-nums` (§3.5 Células). */
  numerico?: boolean;
  /** Some no ListCard do celular (máx. 4 informações por card, §3.6). */
  ocultarNoCelular?: boolean;
};

/**
 * DataTable (doc 08 §3.5). Uma única `<table>`: a partir de md é tabela com cabeçalho fixo; abaixo
 * de md cada linha vira ListCard (§3.6) por CSS, sem rolagem horizontal e sem duplicar o conteúdo.
 * A 1ª coluna é o texto principal; com `href`, ela é o link do detalhe e a linha inteira é clicável.
 */
export function DataTable<T>({
  colunas,
  linhas,
  chave,
  href,
  estado,
  acao,
  rotulo,
  vazio,
  rodape,
  embutida = false,
}: {
  /** Dentro de um Card: sem borda e sombra próprias (nunca card dentro de card, §3.6). */
  embutida?: boolean;
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (l: T) => string;
  /** Detalhe da linha: o texto principal vira link e a linha inteira é o alvo. */
  href?: (l: T) => string;
  /** Coluna de estado (StatusBadge), ao lado do título no card do celular. */
  estado?: { titulo: string; celula: (l: T) => ReactNode };
  /** No máx. 1 ação visível por linha (§3.5 Ações por linha). */
  acao?: { titulo: string; celula: (l: T) => ReactNode };
  /** Nome acessível da tabela. */
  rotulo: string;
  vazio?: ReactNode;
  rodape?: ReactNode;
}) {
  const [principal, ...resto] = colunas;
  if (!principal) return null;
  const cel = "px-4 align-middle md:h-12 md:py-2";

  return (
    <div
      className={cn(
        "overflow-hidden bg-surface",
        embutida
          ? "rounded-md border border-border-subtle"
          : "rounded-lg border border-border shadow-1",
      )}
    >
      {linhas.length === 0 ? (
        vazio
      ) : (
        <table
          className="w-full border-collapse text-left text-body max-md:block"
          aria-label={rotulo}
        >
          <thead className="sticky top-0 z-sticky bg-surface-muted max-md:sr-only">
            <tr>
              {[principal, ...resto].map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className="border-b border-border px-4 py-3 text-h5 text-text-label"
                >
                  {c.titulo}
                </th>
              ))}
              {estado && (
                <th
                  scope="col"
                  className="border-b border-border px-4 py-3 text-h5 text-text-label"
                >
                  {estado.titulo}
                </th>
              )}
              {acao && (
                <th
                  scope="col"
                  className="border-b border-border px-4 py-3 text-h5 text-text-label"
                >
                  <span className="sr-only">{acao.titulo}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="max-md:block">
            {linhas.map((l) => (
              <tr
                key={chave(l)}
                className={cn(
                  "relative border-b border-border-subtle last:border-b-0",
                  "max-md:flex max-md:min-h-16 max-md:flex-wrap max-md:items-start max-md:gap-x-2 max-md:gap-y-1 max-md:py-3",
                  href && "max-md:pr-10 hover:bg-surface-muted active:bg-surface-muted",
                )}
              >
                <td className={cn(cel, "font-medium text-text max-md:min-w-0 max-md:flex-1")}>
                  {href ? (
                    <Link
                      href={href(l)}
                      className="text-link after:absolute after:inset-0 max-md:text-text"
                    >
                      {principal.celula(l)}
                    </Link>
                  ) : (
                    principal.celula(l)
                  )}
                </td>
                {resto.map((c) => (
                  <td
                    key={c.titulo}
                    data-label={c.titulo}
                    className={cn(
                      cel,
                      "text-text",
                      "max-md:order-2 max-md:basis-full max-md:text-small max-md:text-text-muted",
                      "max-md:before:content-[attr(data-label)':_']",
                      c.numerico && "tabular-nums",
                      c.ocultarNoCelular && "max-md:hidden",
                    )}
                  >
                    {c.celula(l)}
                  </td>
                ))}
                {estado && (
                  <td className={cn(cel, "max-md:order-1 max-md:shrink-0")}>{estado.celula(l)}</td>
                )}
                {acao && (
                  // A ação fica acima do link esticado da linha.
                  <td
                    className={cn(
                      cel,
                      "relative z-sticky text-right max-md:order-3 max-md:basis-full max-md:text-left",
                    )}
                  >
                    {acao.celula(l)}
                  </td>
                )}
                {href && (
                  <td
                    aria-hidden="true"
                    className="absolute top-1/2 right-3 -translate-y-1/2 md:hidden"
                  >
                    <ChevronRight size={20} className="text-text-muted" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rodape && <div className="border-t border-border-subtle">{rodape}</div>}
    </div>
  );
}
