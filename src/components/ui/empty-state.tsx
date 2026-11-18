import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** EmptyState (doc 08 §3.11): ícone 48 px → título → frase → ação primária se o perfil puder. */
export function EmptyState({
  titulo,
  descricao,
  acao,
  icone: Icone = Inbox,
}: {
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  icone?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <Icone size={48} strokeWidth={1.5} className="text-text-muted" aria-hidden="true" />
      <p className="text-h3 text-text">{titulo}</p>
      {descricao && <p className="max-w-prose text-body text-text-muted">{descricao}</p>}
      {acao && <div className="mt-2 flex flex-wrap justify-center gap-2">{acao}</div>}
    </div>
  );
}
