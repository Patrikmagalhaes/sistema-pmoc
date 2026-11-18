import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { FilterBar, urlCom } from "@/components/ui/filter-bar";
import { Page, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatarDataHora, ROTULO_PERFIL } from "@/lib/formato";
import { listarUsuarios } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";

export const metadata = { title: "Usuários – Sistema PMOC" };

type SP = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const BASE = "/adm/usuarios";
const ROTULO_FILTRO_SITUACAO: Record<string, string> = {
  ATIVO: "Ativos",
  INATIVO: "Inativos",
  TODOS: "Todos",
};

/** TL-106 – Usuários (04 §4.2; FL-04, FL-05). Template T-LIST (doc 08 §4.3). */
export default async function UsuariosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const deps = getAuth().deps;
  // UL-03: inativos só com o filtro; "todos" mostra os dois estados.
  const situacaoUrl = um(sp.situacao) ?? "ATIVO";
  const filtro = {
    perfil: um(sp.perfil) ?? null,
    situacao: situacaoUrl === "TODOS" ? null : situacaoUrl,
    clientId: um(sp.cliente) ?? null,
    busca: um(sp.busca) ?? null,
    pagina: um(sp.pagina) ?? null,
  };
  const [r, clientes] = await Promise.all([
    listarUsuarios(s.ctx, filtro, deps),
    listarClientesParaSelecao(s.ctx, deps),
  ]);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.razaoSocial]));

  // Parâmetros atuais da URL (UL-02), sem a página.
  const atuais = {
    busca: filtro.busca,
    perfil: filtro.perfil,
    situacao: situacaoUrl === "ATIVO" ? null : situacaoUrl,
    cliente: filtro.clientId,
  };
  const sem = (k: keyof typeof atuais) => urlCom(BASE, atuais, { [k]: null });
  const chips = [
    filtro.busca && { rotulo: `Busca: ${filtro.busca}`, removerHref: sem("busca") },
    filtro.perfil && {
      rotulo: `Perfil: ${ROTULO_PERFIL[filtro.perfil as keyof typeof ROTULO_PERFIL] ?? filtro.perfil}`,
      removerHref: sem("perfil"),
    },
    situacaoUrl !== "ATIVO" && {
      rotulo: `Estado: ${ROTULO_FILTRO_SITUACAO[situacaoUrl] ?? situacaoUrl}`,
      removerHref: sem("situacao"),
    },
    filtro.clientId && {
      rotulo: `Cliente: ${nomeCliente.get(filtro.clientId) ?? "—"}`,
      removerHref: sem("cliente"),
    },
  ].filter((c): c is { rotulo: string; removerHref: string } => Boolean(c));

  const novo = (
    <Link href={`${BASE}/novo`} className={buttonClasses({ variant: "primary" })}>
      <Plus size={20} aria-hidden="true" />
      Novo usuário
    </Link>
  );

  return (
    <Page>
      <PageHeader
        titulo="Usuários"
        meta={`${r.total} ${r.total === 1 ? "usuário" : "usuários"}`}
        acoes={novo}
      />

      <FilterBar limparHref={BASE} chips={chips}>
        <Field id="busca" label="Buscar" className="md:w-72">
          <Input
            name="busca"
            type="search"
            defaultValue={filtro.busca ?? ""}
            placeholder="Nome ou e-mail"
          />
        </Field>
        <Field id="perfil" label="Perfil" className="md:w-44">
          <Select name="perfil" defaultValue={filtro.perfil ?? ""}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_PERFIL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="situacao" label="Estado" className="md:w-36">
          <Select name="situacao" defaultValue={situacaoUrl}>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
            <option value="TODOS">Todos</option>
          </Select>
        </Field>
        <Field id="cliente" label="Cliente" className="md:w-56">
          <Select name="cliente" defaultValue={filtro.clientId ?? ""}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <DataTable
        rotulo="Usuários"
        linhas={r.linhas}
        chave={(u) => u.id}
        href={(u) => `${BASE}/${u.id}`}
        colunas={[
          { titulo: "Nome", celula: (u) => u.nome },
          { titulo: "E-mail", celula: (u) => u.email },
          { titulo: "Perfil", celula: (u) => ROTULO_PERFIL[u.perfil] },
          {
            titulo: "Cliente",
            celula: (u) => (u.clientId ? (nomeCliente.get(u.clientId) ?? "—") : "—"),
            ocultarNoCelular: true,
          },
          {
            titulo: "Último login",
            celula: (u) => formatarDataHora(u.ultimoLogin),
            numerico: true,
            ocultarNoCelular: true,
          },
        ]}
        estado={{
          titulo: "Estado",
          celula: (u) => <StatusBadge tipo="situacao" valor={u.situacao} />,
        }}
        vazio={
          chips.length > 0 ? (
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
            <EmptyState icone={Users} titulo="Nenhum usuário cadastrado." acao={novo} />
          )
        }
        rodape={
          r.total > 0 && (
            <Pagination
              pagina={r.pagina}
              porPagina={r.porPagina}
              total={r.total}
              url={(p) => urlCom(BASE, atuais, { pagina: String(p) })}
            />
          )
        }
      />
    </Page>
  );
}
