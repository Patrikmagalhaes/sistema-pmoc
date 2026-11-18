import { notFound } from "next/navigation";
import { Page, PageHeader } from "@/components/ui/page-header";
import { obterCliente } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { LocalForm } from "../local-form";

export const metadata = { title: "Novo local – Sistema PMOC" };

/** TL-110 vazio (FL-04 passo 3), aberto da aba Locais do cliente (`?cliente=`). Template T-FORM. */
export default async function NovoLocalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const r = await obterCliente(s.ctx, typeof sp.cliente === "string" ? sp.cliente : "", {
    db: getDatabase(),
  });
  if (!r) notFound();
  return (
    <Page largura="form">
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          { rotulo: r.cliente.razaoSocial, href: `/adm/clientes/${r.cliente.id}?aba=locais` },
          { rotulo: "Novo local" },
        ]}
        titulo="Novo local"
      />
      <LocalForm clienteId={r.cliente.id} />
    </Page>
  );
}
