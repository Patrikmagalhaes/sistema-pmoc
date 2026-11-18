import { MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { formatarDataIso, mascararCnpj } from "@/lib/formato";
import { listarUsuarios } from "@/modules/acesso";
import { obterCliente } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { ClienteForm } from "../cliente-form";
import { Excluir } from "../excluir";

export const metadata = { title: "Cliente – Sistema PMOC" };

/**
 * TL-109 – Cliente: abas Dados, Locais e Usuários (FL-04; RF-05, RF-06, RF-02). Template T-DETAIL
 * com Tabs (doc 08 §7.4). A ação primária de cada aba fica no topo da aba.
 */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = getDatabase();
  const r = await obterCliente(s.ctx, id, { db });
  if (!r) notFound();
  const { cliente, locais } = r;
  const ABAS = [
    { id: "dados", rotulo: "Dados" },
    { id: "locais", rotulo: "Locais", contador: locais.length },
    { id: "usuarios", rotulo: "Usuários" },
  ];
  const aba = ABAS.some((a) => a.id === sp.aba) ? String(sp.aba) : "dados";
  const base = `/adm/clientes/${cliente.id}`;

  return (
    <Page largura="form">
      <PageHeader
        migalhas={[{ rotulo: "Clientes", href: "/adm/clientes" }, { rotulo: cliente.razaoSocial }]}
        titulo={cliente.razaoSocial}
        meta={`CNPJ ${mascararCnpj(cliente.cnpj)}`}
        acoes={
          aba === "dados" && (
            <Excluir
              alvo="cliente"
              id={cliente.id}
              rowVersion={cliente.rowVersion}
              nome={cliente.razaoSocial}
              bloqueio={cliente.temLocalVivo ? "Exclua antes os locais deste cliente." : null}
              depois="/adm/clientes"
            />
          )
        }
      />
      {sp.aviso === "criado" && (
        <Alert tom="success">
          Cliente criado. Cadastre agora os locais e os usuários do portal.
        </Alert>
      )}
      <Tabs base={base} ativa={aba} abas={ABAS} />

      {aba === "dados" && <ClienteForm key={cliente.rowVersion} cliente={cliente} />}

      {aba === "locais" && (
        <section aria-label="Locais" className="flex flex-col gap-4">
          {locais.length > 0 && (
            <div className="flex justify-end">
              <NovoLocal clienteId={cliente.id} />
            </div>
          )}
          <DataTable
            rotulo="Locais"
            linhas={locais}
            chave={(l) => l.id}
            href={(l) => `/adm/locais/${l.id}`}
            colunas={[
              { titulo: "Nome", celula: (l) => l.nome },
              { titulo: "Código", celula: (l) => <span className="font-mono">{l.codigo}</span> },
              { titulo: "Cidade/UF", celula: (l) => `${l.cidade}/${l.uf}` },
              {
                titulo: "Contrato vigente até",
                celula: (l) => formatarDataIso(l.vigenteAte),
                numerico: true,
              },
            ]}
            estado={{
              titulo: "PMOC",
              celula: (l) =>
                l.estadoPmoc ? (
                  <StatusBadge tipo="pmoc" valor={l.estadoPmoc} />
                ) : (
                  <span className="text-text-muted">—</span>
                ),
            }}
            vazio={
              <EmptyState
                icone={MapPin}
                titulo="Nenhum local."
                descricao="Cadastre o primeiro local deste cliente."
                acao={<NovoLocal clienteId={cliente.id} />}
              />
            }
          />
        </section>
      )}

      {aba === "usuarios" && <Usuarios clienteId={cliente.id} ctx={s.ctx} db={db} />}
    </Page>
  );
}

function NovoLocal({ clienteId }: { clienteId: string }) {
  return (
    <Link
      href={`/adm/locais/novo?cliente=${clienteId}`}
      className={buttonClasses({ variant: "primary" })}
    >
      <Plus size={20} aria-hidden="true" />
      Novo local
    </Link>
  );
}

/** TL-109 aba Usuários: lista do módulo `acesso` filtrada pelo cliente (FL-04 passos 4–5). */
async function Usuarios({
  clienteId,
  ctx,
  db,
}: {
  clienteId: string;
  ctx: Parameters<typeof listarUsuarios>[0];
  db: ReturnType<typeof getDatabase>;
}) {
  const r = await listarUsuarios(ctx, { clientId: clienteId, perfil: "CLIENTE" }, { db });
  const novo = (
    <Link
      href={`/adm/usuarios/novo?cliente=${clienteId}`}
      className={buttonClasses({ variant: "primary" })}
    >
      <Plus size={20} aria-hidden="true" />
      Novo usuário
    </Link>
  );
  return (
    <section aria-label="Usuários" className="flex flex-col gap-4">
      {r.linhas.length > 0 && <div className="flex justify-end">{novo}</div>}
      <DataTable
        rotulo="Usuários do cliente"
        linhas={r.linhas}
        chave={(u) => u.id}
        href={(u) => `/adm/usuarios/${u.id}`}
        colunas={[
          { titulo: "Nome", celula: (u) => u.nome },
          { titulo: "E-mail", celula: (u) => u.email },
        ]}
        estado={{
          titulo: "Estado",
          celula: (u) => <StatusBadge tipo="situacao" valor={u.situacao} />,
        }}
        vazio={
          <EmptyState
            icone={Users}
            titulo="Nenhum usuário."
            descricao="O cliente não terá acesso ao portal até ter um usuário."
            acao={novo}
          />
        }
        rodape={
          r.total > r.linhas.length && (
            <p className="px-4 py-3 text-small text-text-muted">
              Mostrando {r.linhas.length} de {r.total}.{" "}
              <Link href={`/adm/usuarios?cliente=${clienteId}&situacao=TODOS`}>Ver todos</Link>
            </p>
          )
        }
      />
    </section>
  );
}
