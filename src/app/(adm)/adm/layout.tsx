import type { ReactNode } from "react";
import { AdmShell } from "@/components/layout/adm-shell";
import { ROTULO_PERFIL } from "@/lib/formato";
import { exigirArea } from "@/server/auth/sessao";

export const runtime = "nodejs";

/** Área Administração: só ADM (04 §1.1; CA-01.3). Moldura do doc 08 §4.1.1. */
export default async function Layout({ children }: { children: ReactNode }) {
  const s = await exigirArea(["ADM"]);
  return (
    <AdmShell nome={s.usuario.nome} perfil={ROTULO_PERFIL.ADM}>
      {children}
    </AdmShell>
  );
}
