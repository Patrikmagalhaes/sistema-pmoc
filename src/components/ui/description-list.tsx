import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * DescriptionList (doc 08 §3.15): pares rótulo/valor em detalhes e campos somente leitura (§7.2).
 * 2 colunas a partir de md; valor vazio mostra "—" (RNF-07).
 */
export function DescriptionList({
  itens,
  className,
}: {
  itens: { rotulo: string; valor: ReactNode; ajuda?: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2", className)}>
      {itens.map((i) => (
        <div key={i.rotulo} className="flex min-w-0 flex-col gap-1">
          <dt className="text-small text-text-muted">{i.rotulo}</dt>
          <dd className="text-body break-words text-text">
            {i.valor === null || i.valor === undefined || i.valor === "" ? "—" : i.valor}
          </dd>
          {i.ajuda && <dd className="text-small text-text-muted">{i.ajuda}</dd>}
        </div>
      ))}
    </dl>
  );
}
