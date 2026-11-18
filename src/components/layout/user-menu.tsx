"use client";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** UserMenu (doc 08 §3.9): avatar + nome; "Minha conta" (TL-005) e "Sair". Esc e clique fora fecham. */
export function UserMenu({ nome, perfil }: { nome: string; perfil: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={`Menu do usuário: ${nome}`}
        onClick={() => setAberto((a) => !a)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-body text-text hover:bg-surface-muted"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-action-strong-bg text-small font-semibold text-action-strong-text"
        >
          {iniciais(nome)}
        </span>
        <span className="hidden max-w-48 truncate md:inline">{nome}</span>
        <ChevronDown size={16} className="text-text-muted" aria-hidden="true" />
      </button>
      <div
        id={id}
        hidden={!aberto}
        className="absolute top-full right-0 z-dropdown mt-2 w-64 rounded-md border border-border bg-surface py-2 shadow-2"
      >
        <div className="border-b border-border-subtle px-4 pb-2">
          <p className="truncate text-body-strong text-text">{nome}</p>
          <p className="text-small text-text-muted">{perfil}</p>
        </div>
        <Link
          href="/conta"
          onClick={() => setAberto(false)}
          className={cn(item, "text-text no-underline hover:no-underline")}
        >
          <UserRound size={20} aria-hidden="true" />
          Minha conta
        </Link>
        <button
          type="button"
          className={cn(item, "w-full text-text")}
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/login");
          }}
        >
          <LogOut size={20} aria-hidden="true" />
          Sair
        </button>
      </div>
    </div>
  );
}

const item = "flex min-h-11 items-center gap-3 px-4 text-body hover:bg-surface-muted";
