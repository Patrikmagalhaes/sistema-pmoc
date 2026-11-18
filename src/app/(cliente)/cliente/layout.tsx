import type { ReactNode } from "react";
import { Area } from "@/components/area";
import { ROTULO_PERFIL } from "@/lib/formato";
import { exigirArea } from "@/server/auth/sessao";

export const runtime = "nodejs";

/** Área Portal do cliente: só CLIENTE (04 §1.1; CA-01.3). Moldura do doc 08 §4.1.2. */
export default async function Layout({ children }: { children: ReactNode }) {
  const s = await exigirArea(["CLIENTE"]);
  return (
    <Area
      titulo="Portal do cliente"
      nome={s.usuario.nome}
      perfil={ROTULO_PERFIL.CLIENTE}
      largura="portal"
    >
      {children}
    </Area>
  );
}
