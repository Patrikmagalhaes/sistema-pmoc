import Link from "next/link";
import type { ReactNode } from "react";
import { BotaoSair } from "./botao-sair";

/** Moldura provisória das áreas (04 §1.1). Menu e notificações entram com as telas de cada etapa. */
export function Area({
  titulo,
  nome,
  menu = [],
  children,
}: {
  titulo: string;
  nome: string;
  menu?: { href: string; rotulo: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "12px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <strong>{titulo}</strong>
          <nav className="menu">
            {menu.map((m) => (
              <Link key={m.href} href={m.href}>
                {m.rotulo}
              </Link>
            ))}
          </nav>
        </span>
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>{nome}</span>
          <BotaoSair />
        </span>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </>
  );
}
