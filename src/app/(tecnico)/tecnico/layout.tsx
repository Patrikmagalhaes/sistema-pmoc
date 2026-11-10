import type { ReactNode } from "react";
import { Area } from "@/components/area";
import { exigirArea } from "@/server/auth/sessao";

export const runtime = "nodejs";

/** Área App do técnico: só TECNICO (04 §1.1; CA-01.3). */
export default async function Layout({ children }: { children: ReactNode }) {
  const s = await exigirArea(["TECNICO"]);
  return (
    <Area titulo="App do técnico" nome={s.usuario.nome}>
      {children}
    </Area>
  );
}
