import { FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { FilterBar, urlCom } from "@/components/ui/filter-bar";
import { Page, PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { formatarDataIso } from "@/lib/formato";
import { listarContratosDoLocal, obterLocal } from "@/modules/clientes";
import { listarEquipamentosDoLocal } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import type { RequestContext } from "@/server/context";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { LocalForm } from "../local-form";

export const metadata = { title: "Local – Sistema PMOC" };

const ABAS = [
  { id: "dados", rotulo: "Dados" },
  { id: "equipamentos", rotulo: "Equipamentos" },
  { id: "contratos", rotulo: "Contratos e PMOC" },
];

/**
 * TL-110 – Local: abas Dados, Equipamentos e Contratos e PMOC (RF-06, RF-07, RF-09; FL-04, FL-06,
 * FL-07). Template T-DETAIL com Tabs (doc 08 §7.4).
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
  const deps = { db: getDatabase() };
  const l = await obterLocal(s.ctx, id, deps);
  if (!l) notFound();
  const aba = ABAS.some((a) => a.id === sp.aba) ? String(sp.aba) : "dados";
  const bloqueio =
    l.temContratoVivo || l.temEquipamentoVivo
      ? "Exclua antes os contratos e os equipamentos deste local."
      : null;

  return (
    <Page largura={aba === "dados" ? "form" : "wide"}>
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          { rotulo: l.clienteRazaoSocial, href: `/adm/clientes/${l.clienteId}?aba=locais` },
          { rotulo: l.nome },
        ]}
        titulo={l.nome}
        meta={
          <>
            Local <span className="font-mono">{l.codigo}</span> · {l.clienteRazaoSocial}
          </>
        }
        acoes={
          aba === "dados" && (
            <Excluir
              alvo="local"
              id={l.id}
              rowVersion={l.rowVersion}
              nome={`${l.nome} (${l.codigo})`}
              bloqueio={bloqueio}
              depois={`/adm/clientes/${l.clienteId}?aba=locais`}
            />
          )
        }
      />
      {sp.aviso === "criado" && <Alert tom="success">Local criado com o código {l.codigo}.</Alert>}
      <Tabs base={`/adm/locais/${l.id}`} ativa={aba} abas={ABAS} />

      {aba === "dados" && <LocalForm key={l.rowVersion} clienteId={l.clienteId} local={l} />}

      {aba === "equipamentos" && (
        <Equipamentos
          ctx={s.ctx}
          localId={l.id}
          tipoId={typeof sp.tipo === "string" ? sp.tipo : null}
          mostrarInativos={sp.inativos === "1"}
        />
      )}

      {aba === "contratos" && (
        <Contratos localId={l.id} contratos={await listarContratosDoLocal(s.ctx, l.id, deps)} />
      )}
    </Page>
  );
}

/** Aba Equipamentos (FL-07 passo 1): filtro por tipo e "Mostrar inativos" (UL-03), por TAG. */
async function Equipamentos({
  ctx,
  localId,
  tipoId,
  mostrarInativos,
}: {
  ctx: RequestContext;
  localId: string;
  tipoId: string | null;
  mostrarInativos: boolean;
}) {
  const r = await listarEquipamentosDoLocal(
    ctx,
    localId,
    { tipoId, mostrarInativos },
    { db: getDatabase() },
  );
  const lista = r?.equipamentos ?? [];
  const base = `/adm/locais/${localId}`;
  const atuais = { aba: "equipamentos", tipo: tipoId, inativos: mostrarInativos ? "1" : null };
  const chips = [
    tipoId && {
      rotulo: `Tipo: ${r?.tipos.find((t) => t.id === tipoId)?.nome ?? "—"}`,
      removerHref: urlCom(base, atuais, { tipo: null }),
    },
    mostrarInativos && {
      rotulo: "Mostrando inativos",
      removerHref: urlCom(base, atuais, { inativos: null }),
    },
  ].filter((c): c is { rotulo: string; removerHref: string } => Boolean(c));
  const novo = (
    <Link
      href={`/adm/equipamentos/novo?local=${localId}`}
      className={buttonClasses({ variant: "primary" })}
    >
      <Plus size={20} aria-hidden="true" />
      Novo equipamento
    </Link>
  );

  return (
    <section aria-label="Equipamentos" className="flex flex-col gap-4">
      <div className="flex justify-end">{novo}</div>
      <FilterBar
        ocultos={{ aba: "equipamentos" }}
        limparHref={`${base}?aba=equipamentos`}
        chips={chips}
        rotuloBotao="Aplicar"
      >
        <Field id="tipo" label="Tipo" className="md:w-64">
          <Select name="tipo" defaultValue={tipoId ?? ""}>
            <option value="">Todos</option>
            {r?.tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          label="Mostrar inativos"
          name="inativos"
          value="1"
          defaultChecked={mostrarInativos}
        />
      </FilterBar>
      <DataTable
        rotulo="Equipamentos do local"
        linhas={lista}
        chave={(e) => e.id}
        href={(e) => `/adm/equipamentos/${e.id}`}
        colunas={[
          { titulo: "TAG", celula: (e) => <span className="font-mono">{e.tag}</span> },
          { titulo: "Tipo", celula: (e) => e.tipo },
          { titulo: "Grupo", celula: (e) => e.grupo, ocultarNoCelular: true },
          { titulo: "Ambiente", celula: (e) => e.ambiente },
          { titulo: "Marca", celula: (e) => e.marca ?? "—", ocultarNoCelular: true },
          { titulo: "Modelo", celula: (e) => e.modelo ?? "—", ocultarNoCelular: true },
        ]}
        estado={{
          titulo: "Estado",
          celula: (e) => <StatusBadge tipo="situacao" valor={e.situacao} />,
        }}
        vazio={
          chips.length > 0 ? (
            <EmptyState icone={Search} titulo="Nenhum resultado para os filtros." />
          ) : (
            <EmptyState
              titulo="Nenhum equipamento."
              descricao="Cadastre os equipamentos deste local para montar o PMOC."
            />
          )
        }
      />
    </section>
  );
}

function Contratos({
  localId,
  contratos,
}: {
  localId: string;
  contratos: Awaited<ReturnType<typeof listarContratosDoLocal>>;
}) {
  const lista = contratos ?? [];
  const novo = (
    <Link
      href={`/adm/contratos/novo?local=${localId}`}
      className={buttonClasses({ variant: "primary" })}
    >
      <Plus size={20} aria-hidden="true" />
      Novo contrato
    </Link>
  );
  return (
    <section aria-label="Contratos e PMOC" className="flex flex-col gap-4">
      {lista.length > 0 && <div className="flex justify-end">{novo}</div>}
      <DataTable
        rotulo="Contratos do local"
        linhas={lista}
        chave={(c) => c.id}
        href={(c) => `/adm/contratos/${c.id}`}
        colunas={[
          {
            titulo: "Vigência",
            celula: (c) => `${formatarDataIso(c.inicio)} a ${formatarDataIso(c.fim)}`,
            numerico: true,
          },
          { titulo: "Meses", celula: (c) => c.meses, numerico: true, ocultarNoCelular: true },
          { titulo: "Nº da ART", celula: (c) => c.art },
          {
            titulo: "TH-revisão",
            celula: (c) => [c.th, c.revisao].filter(Boolean).join("-") || "—",
            ocultarNoCelular: true,
          },
          {
            titulo: "Contrato",
            celula: (c) => <StatusBadge tipo="contrato" valor={c.situacao} />,
          },
        ]}
        estado={{
          titulo: "PMOC",
          celula: (c) =>
            c.estadoPmoc ? (
              <StatusBadge tipo="pmoc" valor={c.estadoPmoc} />
            ) : (
              <span className="text-text-muted">—</span>
            ),
        }}
        vazio={
          <EmptyState
            icone={FileText}
            titulo="Nenhum contrato."
            descricao="Cadastre o contrato para criar o PMOC."
            acao={novo}
          />
        }
      />
    </section>
  );
}
