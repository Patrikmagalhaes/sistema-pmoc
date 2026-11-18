import { Building2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { FilterBar, urlCom } from "@/components/ui/filter-bar";
import { Page, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { mascararCnpj } from "@/lib/formato";
import { listarClientes } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";

export const metadata = { title: "Clientes – Sistema PMOC" };

type SP = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const BASE = "/adm/clientes";

/** TL-108 – Clientes (FL-04; RF-05). Template T-LIST (doc 08 §4.3). */
export default async function ClientesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const busca = um(sp.busca) ?? null;
  const r = await listarClientes(
    s.ctx,
    { busca, pagina: um(sp.pagina) ?? null },
    { db: getDatabase() },
  );
  const novo = (
    <Link href={`${BASE}/novo`} className={buttonClasses({ variant: "primary" })}>
      <Plus size={20} aria-hidden="true" />
      Novo cliente
    </Link>
  );

  return (
    <Page>
      <PageHeader
        titulo="Clientes"
        meta={`${r.total} ${r.total === 1 ? "cliente" : "clientes"}`}
        acoes={novo}
      />

      <FilterBar
        limparHref={BASE}
        chips={busca ? [{ rotulo: `Busca: ${busca}`, removerHref: BASE }] : []}
      >
        <Field id="busca" label="Buscar" className="md:w-96">
          <Input
            name="busca"
            type="search"
            defaultValue={busca ?? ""}
            placeholder="Razão social, nome fantasia ou CNPJ"
          />
        </Field>
      </FilterBar>

      <DataTable
        rotulo="Clientes"
        linhas={r.linhas}
        chave={(c) => c.id}
        href={(c) => `${BASE}/${c.id}`}
        colunas={[
          { titulo: "Razão social", celula: (c) => c.razaoSocial },
          { titulo: "Nome fantasia", celula: (c) => c.nomeFantasia ?? "—", ocultarNoCelular: true },
          { titulo: "CNPJ", celula: (c) => mascararCnpj(c.cnpj), numerico: true },
          { titulo: "Cidade/UF", celula: (c) => `${c.cidade}/${c.uf}` },
          { titulo: "Locais", celula: (c) => c.locais, numerico: true },
        ]}
        vazio={
          busca ? (
            <EmptyState
              icone={Search}
              titulo="Nenhum resultado para os filtros."
              acao={
                <Link href={BASE} className={buttonClasses({ variant: "secondary" })}>
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EmptyState
              icone={Building2}
              titulo="Nenhum cliente cadastrado."
              descricao="Cadastre o cliente; depois, os locais, os equipamentos e o contrato."
              acao={novo}
            />
          )
        }
        rodape={
          r.total > 0 && (
            <Pagination
              pagina={r.pagina}
              porPagina={r.porPagina}
              total={r.total}
              url={(p) => urlCom(BASE, { busca }, { pagina: String(p) })}
            />
          )
        }
      />
    </Page>
  );
}
