import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tom = "info" | "success" | "warning" | "danger";

const estilo: Record<Tom, string> = {
  info: "border-info-border bg-info-bg text-info-text",
  success: "border-success-border bg-success-bg text-success-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
  danger: "border-danger-border bg-danger-bg text-danger-text",
};
const icone = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };

/**
 * Alert em linha (doc 08 §3.10): informação que precisa ficar visível. Ícone + título opcional +
 * texto + ação opcional; `role="alert"` só para erro.
 */
export function Alert({
  tom = "info",
  titulo,
  children,
  acao,
  className,
}: {
  tom?: Tom;
  titulo?: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const Icone = icone[tom];
  return (
    <div
      role={tom === "danger" ? "alert" : "status"}
      data-tom={tom}
      className={cn("flex gap-3 rounded-md border px-4 py-3 text-body", estilo[tom], className)}
    >
      <Icone size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo && <p className="text-body-strong">{titulo}</p>}
        {children && <div>{children}</div>}
        {acao && <div className="mt-2 flex flex-wrap gap-2">{acao}</div>}
      </div>
    </div>
  );
}
