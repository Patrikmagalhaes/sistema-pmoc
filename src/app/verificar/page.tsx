import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { normalizarCodigo } from "@/modules/pmoc";
import { CODIGO_INVALIDO, FormularioVerificar } from "./formulario";

export const metadata: Metadata = {
  title: "Verificar documento – Sistema PMOC",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";

/**
 * TL-007 – Verificar documento (pública, sem login; RN-187; 06 INT-14; decisões B7 a, R2 2.8 b).
 * Recebe o código digitado; no formato certo, abre o resultado em `/verificar/{codigo}`.
 */
export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const digitado = typeof sp.codigo === "string" ? sp.codigo : undefined;
  const codigo = digitado === undefined ? null : normalizarCodigo(digitado);
  if (codigo) redirect(`/verificar/${codigo}`);

  return (
    <AuthCard
      titulo="Verificar documento"
      descricao="Confira se um PDF foi emitido por este sistema pelo código impresso no rodapé."
    >
      <FormularioVerificar
        valor={digitado}
        erro={digitado === undefined ? null : CODIGO_INVALIDO}
      />
    </AuthCard>
  );
}
