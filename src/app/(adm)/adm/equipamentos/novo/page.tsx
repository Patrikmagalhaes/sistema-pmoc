import Link from "next/link";
import { notFound } from "next/navigation";
import { prepararNovoEquipamento, UNIDADE_MAX, UNIDADE_PADRAO } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { EquipamentoForm } from "../equipamento-form";

export const metadata = { title: "Novo equipamento – Sistema PMOC" };

/** TL-111 vazio (FL-07 criar), aberto da aba Equipamentos do local (`?local=`). */
export default async function NovoEquipamentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const n = await prepararNovoEquipamento(s.ctx, typeof sp.local === "string" ? sp.local : "", {
    db: getDatabase(),
  });
  if (!n) notFound();

  return (
    <section className="pagina">
      <p>
        <Link href={`/adm/locais/${n.local.id}?aba=equipamentos`}>
          ← {n.local.nome} ({n.local.codigo})
        </Link>
      </p>
      <h1>Novo equipamento</h1>
      {n.bloqueio ? (
        <div className="alerta erro" role="status">
          {n.bloqueio}
        </div>
      ) : n.tipos.length === 0 ? (
        <div className="vazio">
          <p>Cadastre um tipo de equipamento antes.</p>
          <Link className="botao" href="/adm/tipos/novo">
            Novo tipo
          </Link>
        </div>
      ) : (
        <EquipamentoForm
          localId={n.local.id}
          tipos={n.tipos}
          unidadePadrao={UNIDADE_PADRAO}
          unidadeMax={UNIDADE_MAX}
        />
      )}
    </section>
  );
}
