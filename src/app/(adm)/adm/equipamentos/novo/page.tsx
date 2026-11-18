import { Library } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page-header";
import { prepararNovoEquipamento, UNIDADE_MAX, UNIDADE_PADRAO } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { EquipamentoForm } from "../equipamento-form";

export const metadata = { title: "Novo equipamento – Sistema PMOC" };

/** TL-111 vazio (FL-07 criar), aberto da aba Equipamentos do local (`?local=`). Template T-FORM. */
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
    <Page largura="form">
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          {
            rotulo: `${n.local.nome} (${n.local.codigo})`,
            href: `/adm/locais/${n.local.id}?aba=equipamentos`,
          },
          { rotulo: "Novo equipamento" },
        ]}
        titulo="Novo equipamento"
      />
      {n.bloqueio ? (
        <Alert tom="danger">{n.bloqueio}</Alert>
      ) : n.tipos.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-1">
          <EmptyState
            icone={Library}
            titulo="Cadastre um tipo de equipamento antes."
            acao={
              <Link href="/adm/tipos/novo" className={buttonClasses({ variant: "primary" })}>
                Novo tipo
              </Link>
            }
          />
        </div>
      ) : (
        <EquipamentoForm
          localId={n.local.id}
          tipos={n.tipos}
          unidadePadrao={UNIDADE_PADRAO}
          unidadeMax={UNIDADE_MAX}
        />
      )}
    </Page>
  );
}
