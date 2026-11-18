import { AlertCircle, ChevronDown } from "lucide-react";
import {
  Children,
  cloneElement,
  type InputHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * `FormField` (doc 08 §3.2): único jeito de montar campo. Rótulo acima → controle → ajuda → erro.
 * Liga `aria-describedby` e `aria-invalid` no controle filho automaticamente (§3.0.1 erro).
 */
export function Field({
  id,
  label,
  opcional = false,
  dica,
  erro,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  /** Marca "(opcional)" ao lado do rótulo (§3.2: padrão do sistema). */
  opcional?: boolean;
  dica?: ReactNode;
  erro?: string | null;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const ids = [dica ? `${id}-dica` : null, erro ? `${id}-erro` : null].filter(Boolean).join(" ");
  const filho = Children.only(children);
  const controle = isValidElement(filho)
    ? cloneElement(filho, {
        id,
        "aria-invalid": erro ? true : undefined,
        "aria-describedby": ids || undefined,
      })
    : filho;
  return (
    <div data-slot="campo" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-body-strong text-text-label">
        {label}
        {opcional && <span className="font-normal text-text-muted"> (opcional)</span>}
      </label>
      {controle}
      {dica && (
        <p id={`${id}-dica`} className="text-small text-text-muted">
          {dica}
        </p>
      )}
      <FieldError id={`${id}-erro`} erro={erro} />
    </div>
  );
}

/** Mensagem de erro de campo (§3.0.1): ícone + texto, ligada por `aria-describedby`. */
export function FieldError({ id, erro }: { id?: string; erro?: string | null }) {
  if (!erro) return null;
  return (
    <p
      id={id}
      data-slot="erro-campo"
      className="flex items-start gap-1 text-small text-danger-text"
    >
      <AlertCircle size={16} className="mt-px shrink-0" aria-hidden="true" />
      {erro}
    </p>
  );
}

const controleBase =
  "w-full min-w-0 rounded-md border border-border-input bg-surface px-3 text-body text-text " +
  "transition-colors duration-(--duration-fast) " +
  "focus-visible:border-action focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring " +
  "aria-invalid:border-2 aria-invalid:border-danger-solid " +
  "read-only:bg-surface-muted read-only:focus-visible:border-border-input " +
  "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controleBase, "h-12 md:h-10", className)} {...props} />;
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea rows={rows} className={cn(controleBase, "resize-y py-2", className)} {...props} />
  );
}

/**
 * Campo de arquivo (FileUpload, doc 08 §3.12): `<input type="file">` nativo (acessível, rótulo
 * ligado) com o botão "Escolher arquivo" no estilo do botão secundário.
 */
export function FileInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="file"
      className={cn(
        "block w-full min-w-0 cursor-pointer rounded-md border border-dashed border-border-input bg-surface p-2 text-body text-text-muted",
        "file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-border-input file:bg-surface file:px-4 file:text-body-strong file:text-text-strong hover:file:bg-surface-muted",
        "aria-invalid:border-2 aria-invalid:border-solid aria-invalid:border-danger-solid",
        className,
      )}
      {...props}
    />
  );
}

/** `<select>` nativo estilizado (§3.3; teclado e roda do sistema no celular). */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        className={cn(controleBase, "h-12 appearance-none pr-10 md:h-10", "read-only:bg-surface")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={20}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
}

/** Caixa de seleção com rótulo clicável à direita (§3.3); alvo de 44 px. */
export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 text-body text-text has-disabled:cursor-not-allowed has-disabled:text-text-disabled",
        className,
      )}
    >
      <input type="checkbox" className="size-5 shrink-0 rounded-sm accent-action" {...props} />
      {label}
    </label>
  );
}

/** Grupo de campos lado a lado só para pares curtos (§3.2 Responsivo): 1 coluna no celular. */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}
