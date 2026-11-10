import Link from "next/link";
import { notFound } from "next/navigation";
import { obterLocal } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { LocalForm } from "../local-form";

export const metadata = { title: "Local – Sistema PMOC" };

/**
 * TL-110 – Local, aba Dados (RF-06; FL-04). As abas Equipamentos (TL-111) e Contratos e PMOC
 * (TL-112) entram com essas telas, ainda na Etapa 3.
 */
export default async function LocalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const l = await obterLocal(s.ctx, id, { db: getDatabase() });
  if (!l) notFound();
  const bloqueio =
    l.temContratoVivo || l.temEquipamentoVivo
      ? "Exclua antes os contratos e os equipamentos deste local."
      : null;

  return (
    <section className="pagina">
      <p>
        Cliente:{" "}
        <Link href={`/adm/clientes/${l.clienteId}?aba=locais`}>{l.clienteRazaoSocial}</Link>
      </p>
      <h1>
        {l.nome} ({l.codigo})
      </h1>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Local criado com o código {l.codigo}.
        </div>
      )}
      <LocalForm key={l.rowVersion} clienteId={l.clienteId} local={l} />
      <Excluir
        alvo="local"
        id={l.id}
        rowVersion={l.rowVersion}
        nome={`${l.nome} (${l.codigo})`}
        bloqueio={bloqueio}
        depois={`/adm/clientes/${l.clienteId}?aba=locais`}
      />
    </section>
  );
}
