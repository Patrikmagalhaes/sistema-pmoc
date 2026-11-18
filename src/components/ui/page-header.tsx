import type { ReactNode } from "react";
import { Breadcrumb, type Migalha } from "./breadcrumb";

/**
 * PageHeader (doc 08 §3.15): Breadcrumb → `h1` + StatusBadge → metadados → ações à direita
 * (primária + secundárias). Uma `h1` por tela.
 */
export function PageHeader({
  titulo,
  migalhas,
  estado,
  meta,
  acoes,
}: {
  titulo: ReactNode;
  migalhas?: Migalha[];
  estado?: ReactNode;
  meta?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {migalhas && <Breadcrumb itens={migalhas} />}
      {/* Com muitas ações, elas descem para a linha de baixo em vez de espremer o título. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 grow basis-80 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1 break-words text-text">{titulo}</h1>
            {estado}
          </div>
          {meta && <div className="text-small text-text-muted">{meta}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-start gap-2">{acoes}</div>}
      </div>
    </header>
  );
}

/** Corpo de página: largura do template (§2.7) e espaço de seção (32 px). */
export function Page({
  largura = "wide",
  children,
}: {
  largura?: "wide" | "form";
  children: ReactNode;
}) {
  return (
    <div
      className={
        largura === "form"
          ? "mx-auto flex w-full max-w-content-form flex-col gap-6"
          : "mx-auto flex w-full max-w-content-wide flex-col gap-6"
      }
    >
      {children}
    </div>
  );
}
