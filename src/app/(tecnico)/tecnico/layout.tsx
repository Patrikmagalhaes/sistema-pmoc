import type { ReactNode } from "react";
import { Area } from "@/components/area";
import { ROTULO_PERFIL } from "@/lib/formato";
import { exigirArea } from "@/server/auth/sessao";

export const runtime = "nodejs";

/** Área App do técnico: só TECNICO (04 §1.1; CA-01.3). Moldura do doc 08 §4.1.3. */
export default async function Layout({ children }: { children: ReactNode }) {
  const s = await exigirArea(["TECNICO"]);
  return (
    <Area titulo="Visitas" nome={s.usuario.nome} perfil={ROTULO_PERFIL.TECNICO} largura="pwa">
      {children}
    </Area>
  );
}
