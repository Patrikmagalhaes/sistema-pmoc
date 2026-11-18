import { FileQuestion, ShieldX } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

/**
 * `ForbiddenState` / `NotFoundState` (doc 08 §3.11; 04 §1.2): textos fixos, botão para a tela
 * inicial do perfil. Não revela se o recurso existe (RN-162).
 */
export function EstadoTela({ tipo }: { tipo: "SEM_ACESSO" | "NAO_ENCONTRADO" }) {
  const semAcesso = tipo === "SEM_ACESSO";
  const Icone = semAcesso ? ShieldX : FileQuestion;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-page px-4 py-8">
      <Logo />
      <div className="flex w-full max-w-content-auth flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center shadow-1">
        <Icone size={48} strokeWidth={1.5} className="text-text-muted" aria-hidden="true" />
        <h1 className="text-h3 text-text">
          {semAcesso ? "Você não tem acesso a esta página." : "Não encontrado ou sem acesso."}
        </h1>
        {/* "/" leva à tela inicial do perfil (ou ao login). */}
        <Link href="/" className={buttonClasses({ variant: "primary", className: "w-full" })}>
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
