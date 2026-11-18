import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CLASSE_TOM, ESTADOS, type TipoEstado, type TomEstado } from "./map";

/**
 * StatusBadge (doc 08 §3.7): único componente de estado. Ícone + texto + cor (nunca só cor).
 * `n` preenche "{n}" do rótulo (ex.: "Vence em {n} dias").
 */
export function StatusBadge<K extends TipoEstado>({
  tipo,
  valor,
  n,
  tamanho = "md",
  className,
}: {
  tipo: K;
  valor: (keyof (typeof ESTADOS)[K] & string) | (string & {});
  n?: number;
  tamanho?: "md" | "lg";
  className?: string;
}) {
  const e = (
    ESTADOS[tipo] as Record<string, { rotulo: string; tom: TomEstado; icone: LucideIcon }>
  )[valor];
  if (!e) return null;
  let rotulo = e.rotulo;
  if (n !== undefined) rotulo = rotulo.replace("{n} dias", n === 1 ? "1 dia" : `${n} dias`);
  return (
    <Selo tom={e.tom} icone={e.icone} rotulo={rotulo} tamanho={tamanho} className={className} />
  );
}

/** Tag (§3.7): etiqueta de informação, não de estado (ex.: "atual", "Requer corretiva"). */
export function Tag({
  children,
  tom = "neutral",
  className,
}: {
  children: string;
  tom?: "neutral" | "warning";
  className?: string;
}) {
  return <Selo tom={tom} rotulo={children} className={className} />;
}

function Selo({
  tom,
  icone: Icone,
  rotulo,
  tamanho = "md",
  className,
}: {
  tom: TomEstado;
  icone?: LucideIcon;
  rotulo: string;
  tamanho?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      data-slot="estado"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border px-2 align-middle font-medium",
        tamanho === "lg" ? "min-h-8 py-1 text-body" : "min-h-6 py-0.5 text-small",
        CLASSE_TOM[tom],
        className,
      )}
    >
      {Icone && <Icone size={16} className="shrink-0" aria-hidden="true" />}
      <span>{rotulo}</span>
    </span>
  );
}
