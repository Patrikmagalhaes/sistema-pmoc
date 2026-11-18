import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarDataIso } from "@/lib/formato";
import { obterLocal, sugestaoDeRenovacao } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { ContratoForm } from "../contrato-form";

export const metadata = { title: "Novo contrato – Sistema PMOC" };

/**
 * TL-112 vazio (FL-06 criar), aberto da aba Contratos do local (`?local=`). Com `&anterior=`, é a
 * renovação (FL-06 renovar passo 2): início sugerido no dia seguinte ao fim do anterior.
 */
export default async function NovoContratoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const deps = { db: getDatabase() };
  const local = await obterLocal(s.ctx, typeof sp.local === "string" ? sp.local : "", deps);
  if (!local) notFound();
  const renovacao =
    typeof sp.anterior === "string" ? await sugestaoDeRenovacao(s.ctx, sp.anterior, deps) : null;
  if (typeof sp.anterior === "string" && (!renovacao || renovacao.localId !== local.id)) notFound();
  const titulo = renovacao ? "Renovar contrato" : "Novo contrato";

  return (
    <Page largura="form">
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          {
            rotulo: `${local.nome} (${local.codigo})`,
            href: `/adm/locais/${local.id}?aba=contratos`,
          },
          { rotulo: titulo },
        ]}
        titulo={titulo}
      />
      {renovacao && (
        <Alert tom="info">
          Renovação do contrato anterior. Início sugerido: {formatarDataIso(renovacao.inicio)}.
          Salvar não confirma a renovação: use "Confirmar renovação" no contrato novo.
        </Alert>
      )}
      <ContratoForm
        localId={local.id}
        anteriorId={renovacao?.anteriorId}
        inicioSugerido={renovacao?.inicio}
      />
    </Page>
  );
}
