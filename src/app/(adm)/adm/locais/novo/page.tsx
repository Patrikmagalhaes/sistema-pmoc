import Link from "next/link";
import { notFound } from "next/navigation";
import { obterCliente } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { LocalForm } from "../local-form";

export const metadata = { title: "Novo local – Sistema PMOC" };

/** TL-110 vazio (FL-04 passo 3), aberto da aba Locais do cliente (`?cliente=`). */
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
    <section className="pagina">
      <p>
        <Link href={`/adm/clientes/${r.cliente.id}?aba=locais`}>← {r.cliente.razaoSocial}</Link>
      </p>
      <h1>Novo local</h1>
      <LocalForm clienteId={r.cliente.id} />
    </section>
  );
}
