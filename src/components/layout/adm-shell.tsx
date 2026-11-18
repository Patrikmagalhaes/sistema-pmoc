"use client";
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Menu,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { VERSAO_APP } from "@/lib/versao-app";
import { UserMenu } from "./user-menu";

type Item = { href: string; rotulo: string; icone: LucideIcon; exato?: boolean };
type Grupo = { titulo?: string; itens: Item[] };

/**
 * Menu do ADM (doc 08 §4.2.1), na ordem e nos grupos do doc. Só entram as telas que já existem
 * (Agenda TL-130 e Pedidos de titular TL-140 chegam nas etapas delas, doc 07). Local, equipamento,
 * contrato e PMOC não têm item: a entrada é por contexto (Cliente › Local).
 */
const MENU: Grupo[] = [
  {
    itens: [{ href: "/adm", rotulo: "Painel de pendências", icone: LayoutDashboard, exato: true }],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/adm/clientes", rotulo: "Clientes", icone: Building2 },
      { href: "/adm/tipos", rotulo: "Tipos de equipamento", icone: Library },
      { href: "/adm/usuarios", rotulo: "Usuários", icone: Users },
    ],
  },
  {
    titulo: "Configuração",
    itens: [{ href: "/adm/empresa", rotulo: "Empresa e RT", icone: Briefcase }],
  },
];

/** Telas sem item próprio acendem o item de onde se chega a elas (Cliente › Local › …). */
const CONTEXTO: [RegExp, string][] = [
  [/^\/adm\/(locais|equipamentos|contratos|pmocs)/, "/adm/clientes"],
];

function ativo(pathname: string, i: Item) {
  if (i.exato) return pathname === i.href;
  if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return true;
  return CONTEXTO.some(([re, alvo]) => alvo === i.href && re.test(pathname));
}

/**
 * Moldura da área ADM (doc 08 §4.1.1): sidebar fixa de 256 px a partir de lg, recolhida em 64 px
 * (só ícones) entre md e lg, gaveta abaixo de md; topbar de 56 px com menu do usuário; link
 * "Pular para o conteúdo"; rodapé com a versão.
 */
export function AdmShell({
  nome,
  perfil,
  children,
}: {
  nome: string;
  perfil: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [gaveta, setGaveta] = useState(false);

  // Fecha a gaveta ao navegar e com Esc.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage à troca de rota.
  useEffect(() => setGaveta(false), [pathname]);
  useEffect(() => {
    if (!gaveta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setGaveta(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [gaveta]);

  const nav = (compacta: boolean) => (
    <nav aria-label="Menu principal" className="flex flex-col gap-6 px-3 py-4">
      {MENU.map((g, n) => (
        <div key={g.titulo ?? n} className="flex flex-col gap-1">
          {g.titulo && (
            <p
              className={cn(
                "px-3 pb-1 text-h6 text-text-muted",
                compacta && "md:sr-only lg:not-sr-only",
              )}
            >
              {g.titulo}
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {g.itens.map((i) => {
              const atual = ativo(pathname, i);
              const Icone = i.icone;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={atual ? "page" : undefined}
                    title={compacta ? i.rotulo : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-body-strong no-underline hover:no-underline",
                      atual
                        ? "bg-action-subtle text-action before:absolute before:inset-y-1 before:left-0 before:w-0.75 before:rounded-full before:bg-action"
                        : "text-text-label hover:bg-surface-muted hover:text-text",
                      compacta && "md:justify-center lg:justify-start",
                    )}
                  >
                    <Icone size={20} className="shrink-0" aria-hidden="true" />
                    <span className={cn(compacta && "md:sr-only lg:not-sr-only")}>{i.rotulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-page">
      <a
        href="#conteudo"
        className="sr-only z-toast rounded-md bg-surface px-4 py-2 text-link shadow-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar: md recolhida (64 px), lg completa (256 px) */}
      <aside className="fixed inset-y-0 left-0 z-nav hidden w-(--size-sidebar-collapsed) flex-col border-r border-border bg-surface md:flex lg:w-(--size-sidebar)">
        <div className="flex h-(--size-topbar) shrink-0 items-center border-b border-border-subtle px-4 md:justify-center lg:justify-start lg:px-6">
          <Link
            href="/adm"
            className="no-underline hover:no-underline"
            aria-label={`${APP_NAME} – início`}
          >
            <Logo className="lg:hidden" compacto />
            <Logo className="hidden lg:inline-flex" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">{nav(true)}</div>
      </aside>

      {/* Gaveta (< md) */}
      {gaveta && (
        <div className="fixed inset-0 z-modal md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-overlay"
            onClick={() => setGaveta(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-(--size-sidebar) max-w-full flex-col bg-surface shadow-3">
            <div className="flex h-(--size-topbar) items-center justify-between border-b border-border-subtle px-4">
              <Logo />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setGaveta(false)}
                className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav(false)}</div>
          </aside>
        </div>
      )}

      <div className="flex min-h-dvh flex-col md:pl-(--size-sidebar-collapsed) lg:pl-(--size-sidebar)">
        <header className="sticky top-0 z-nav flex h-(--size-topbar) shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={gaveta}
              onClick={() => setGaveta(true)}
              className="-ml-2 inline-flex size-11 items-center justify-center rounded-md text-text-label hover:bg-surface-muted md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <Link href="/adm" className="no-underline hover:no-underline md:hidden">
              <Logo />
            </Link>
          </div>
          <UserMenu nome={nome} perfil={perfil} />
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className="flex-1 px-4 py-6 outline-none md:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>

        <footer className="flex h-10 items-center px-4 text-caption text-text-muted md:px-6 lg:px-8">
          {APP_NAME} · versão {VERSAO_APP}
        </footer>
      </div>
    </div>
  );
}
