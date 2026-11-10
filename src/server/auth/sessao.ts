import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { type Perfil, resolverSessao, type SessaoResolvida } from "@/modules/acesso";
import { HEADER_ROTA } from "@/proxy";
import { getAuth } from ".";

/** Uma leitura de sessão por requisição (React `cache`), compartilhada por layouts e páginas. */
export const sessaoAtual = cache(async (): Promise<SessaoResolvida> => {
  const h = await headers(); // antes de tudo: marca a rota como dinâmica (sem pré-renderização)
  const { deps, ipHeaders } = getAuth();
  return resolverSessao(h, deps, { ipHeaders });
});

/** Tela inicial de cada perfil (04 §1.1 regra 1; RF-01.4). */
export const INICIO: Record<Perfil, string> = {
  ADM: "/adm",
  CLIENTE: "/cliente",
  TECNICO: "/tecnico",
};

/** Retorno permitido após o login: só caminho relativo do próprio sistema. */
export function retornoSeguro(v: string | null | undefined): string | null {
  return v?.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

async function paraLogin(): Promise<never> {
  const rota = retornoSeguro((await headers()).get(HEADER_ROTA));
  redirect(rota ? `/login?voltar=${encodeURIComponent(rota)}` : "/login");
}

/**
 * Guarda de área (04 §1.1): sem sessão → TL-001 com retorno; ADM sem segundo fator → TL-004 (RN-194);
 * perfil de outra área → 403 `SEM_ACESSO` (CA-01.3). A permissão de cada ação continua no serviço (`can`).
 */
export async function exigirArea(perfis: readonly Perfil[]) {
  const s = await sessaoAtual();
  if (s.estado === "ANONIMO") return paraLogin();
  if (s.estado === "SEGUNDO_FATOR_PENDENTE") redirect("/conta/segundo-fator");
  if (!perfis.includes(s.usuario.perfil)) forbidden();
  return s;
}

/** Qualquer usuário logado, inclusive ADM ainda sem segundo fator (só TL-004 e "Sair"). */
export async function exigirLogin() {
  const s = await sessaoAtual();
  if (s.estado === "ANONIMO") return paraLogin();
  return s;
}
