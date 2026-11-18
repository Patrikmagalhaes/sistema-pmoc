import { Snowflake } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";

/** Logo provisório [A VALIDAR] (doc 08 §2.9): ícone + nome do sistema. */
export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-action", className)}>
      <Snowflake size={20} aria-hidden="true" />
      <span className={cn("text-h3", compacto && "sr-only")}>{APP_NAME}</span>
    </span>
  );
}
