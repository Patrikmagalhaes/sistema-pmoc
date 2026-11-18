import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/cn";

/**
 * Moldura das áreas do cliente (§4.1.2, `content-portal`) e do técnico (§4.1.3, `content-pwa`).
 * Os itens de menu e a barra inferior entram com as telas de cada área (doc 07); por ora só logo,
 * nome da área e menu do usuário.
 */
export function Area({
  titulo,
  nome,
  perfil,
  largura,
  children,
}: {
  titulo: string;
  nome: string;
  perfil: string;
  largura: "portal" | "pwa";
  children: ReactNode;
}) {
  const conteudo = largura === "portal" ? "max-w-content-portal" : "max-w-content-pwa";
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <a
        href="#conteudo"
        className="sr-only z-toast rounded-md bg-surface px-4 py-2 text-link shadow-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-nav border-b border-border bg-surface">
        <div
          className={cn(
            "mx-auto flex h-(--size-topbar) items-center justify-between gap-4 px-4",
            conteudo,
          )}
        >
          {/* "/" leva à tela inicial do perfil (04 §1.1 regra 1). */}
          <Link href="/" className="flex items-center gap-3 no-underline hover:no-underline">
            <Logo />
            <span className="text-body-strong text-text-muted">{titulo}</span>
          </Link>
          <UserMenu nome={nome} perfil={perfil} />
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className={cn("mx-auto w-full flex-1 px-4 py-6 outline-none", conteudo)}
      >
        {children}
      </main>
    </div>
  );
}
