import { Library, Plus } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { Page, PageHeader } from "@/components/ui/page-header";
import { listarTipos } from "@/modules/biblioteca";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";

export const metadata = { title: "Tipos de equipamento – Sistema PMOC" };
const BASE = "/adm/tipos";

/** TL-104 – Tipos de equipamento (FL-03; RF-08). Template T-LIST com "Mostrar inativos" (UL-03). */
export default async function TiposPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const mostrarInativos = sp.inativos === "1"; // UL-03
  const tipos = await listarTipos(s.ctx, { mostrarInativos }, { db: getDatabase() });
  const novo = (
    <Link href={`${BASE}/novo`} className={buttonClasses({ variant: "primary" })}>
      <Plus size={20} aria-hidden="true" />
      Novo tipo
    </Link>
  );

  return (
    <Page>
      <PageHeader
        titulo="Tipos de equipamento"
        meta={`${tipos.length} ${tipos.length === 1 ? "tipo" : "tipos"}${mostrarInativos ? "" : " ativos"}`}
        acoes={novo}
      />

      <FilterBar
        limparHref={BASE}
        rotuloBotao="Aplicar"
        chips={mostrarInativos ? [{ rotulo: "Mostrando inativos", removerHref: BASE }] : []}
      >
        <Checkbox
          label="Mostrar inativos"
          name="inativos"
          value="1"
          defaultChecked={mostrarInativos}
        />
      </FilterBar>

      <DataTable
        rotulo="Tipos de equipamento"
        linhas={tipos}
        chave={(t) => t.id}
        href={(t) => `${BASE}/${t.id}`}
        colunas={[
          { titulo: "Nome", celula: (t) => t.nome },
          { titulo: "Sigla", celula: (t) => <span className="font-mono">{t.sigla}</span> },
          { titulo: "Grupos ativos", celula: (t) => t.grupos, numerico: true },
          { titulo: "Atividades ativas", celula: (t) => t.atividadesAtivas, numerico: true },
        ]}
        estado={{
          titulo: "Estado",
          celula: (t) => <StatusBadge tipo="situacao" valor={t.situacao} />,
        }}
        vazio={
          // Carga inicial da análise §4 como semente: [A VALIDAR] (RF-08.6).
          <EmptyState
            icone={Library}
            titulo={mostrarInativos ? "Nenhum tipo cadastrado." : "Nenhum tipo ativo."}
            descricao="Os tipos definem os grupos e as atividades padrão dos equipamentos."
            acao={novo}
          />
        }
      />
    </Page>
  );
}
