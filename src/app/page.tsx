import { redirect } from "next/navigation";
import { INICIO, sessaoAtual } from "@/server/auth/sessao";

export const runtime = "nodejs";

/** Raiz: leva cada perfil à sua tela inicial (04 §1.1 regra 1). */
export default async function Inicio() {
  const s = await sessaoAtual();
  if (s.estado === "ANONIMO") redirect("/login");
  if (s.estado === "SEGUNDO_FATOR_PENDENTE") redirect("/conta/segundo-fator");
  redirect(INICIO[s.usuario.perfil]);
}
