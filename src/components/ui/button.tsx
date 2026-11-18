import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botão (doc 08 §3.1). Hierarquia: no máximo um `primary` por tela/diálogo. `destructive` só dentro
 * de confirmação; o gatilho na tela é `destructive-outline`. Para navegar, use `<Link>` com
 * `buttonClasses()` (nunca `<button>`).
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "destructive-outline";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-body-strong no-underline " +
  "transition-colors duration-(--duration-fast) select-none hover:no-underline " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variantes: Record<ButtonVariant, string> = {
  primary:
    "bg-action text-text-on-action hover:bg-action-hover active:bg-action-active " +
    "disabled:bg-disabled-bg disabled:text-text-disabled disabled:border disabled:border-disabled-border",
  secondary:
    "border border-border-input bg-surface text-text-strong hover:bg-surface-muted active:bg-border-subtle " +
    "disabled:bg-disabled-bg disabled:text-text-disabled disabled:border-disabled-border",
  tertiary:
    "bg-transparent text-link hover:bg-action-subtle active:bg-action-strong-bg disabled:text-text-disabled disabled:bg-transparent",
  destructive:
    "bg-danger-solid text-text-on-action hover:bg-danger-text active:bg-danger-text " +
    "disabled:bg-disabled-bg disabled:text-text-disabled",
  "destructive-outline":
    "border border-danger-solid bg-surface text-danger-text hover:bg-danger-bg active:bg-danger-bg " +
    "disabled:bg-disabled-bg disabled:text-text-disabled disabled:border-disabled-border",
};

/** `md` é 48 px no celular e 40 px a partir de md (§3.1 Responsivo). */
const tamanhos: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-12 px-4 md:h-10",
  lg: "h-12 px-4",
  xl: "h-16 px-6",
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variantes[variant], tamanhos[size], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** UF-06: spinner + texto no gerúndio (passado pelo chamador) + desabilitado. */
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
