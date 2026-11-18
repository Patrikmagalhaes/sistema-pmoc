import { Fan, FileClock, History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { formatarDataIso } from "@/lib/formato";
import {
  PERIODICIDADES,
  ROTULO_NATUREZA,
  ROTULO_PERIODICIDADE,
  UNIDADE_MAX,
} from "@/modules/biblioteca";
import { obterPmoc, type PmocCompleto } from "@/modules/pmoc";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { EmitirPmoc } from "./emitir";
import { Plano } from "./plano";

export const metadata = { title: "PMOC – Sistema PMOC" };

const ABAS = [
  { id: "plano", rotulo: "Plano" },
  { id: "cronograma", rotulo: "Cronograma" },
  { id: "versoes", rotulo: "Versões e assinaturas" },
  { id: "ficha", rotulo: "Ficha histórico" },
];

/** RN-010: `{TH}-{revisão}`; só TH imprime só o TH; sem TH não mostra nada. */
const thRevisao = (th: string | null, revisao: string | null) =>
  th ? [th, revisao].filter(Boolean).join("-") : null;

/**
 * TL-120 – PMOC (RF-10, RF-11; FL-08 passos 4–6). Template T-DETAIL com Tabs (doc 08 §7.3): Plano e
 * Cronograma; a emissão (TL-121), as versões e a ficha chegam com a emissão.
 */
export default async function PmocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await obterPmoc(s.ctx, id, { db: getDatabase() });
  if (!p) notFound();
  const aba = ABAS.some((a) => a.id === sp.aba) ? String(sp.aba) : "plano";
  const th = thRevisao(p.th, p.revisao);

  return (
    <Page>
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          { rotulo: p.clienteRazaoSocial, href: `/adm/clientes/${p.clienteId}?aba=locais` },
          {
            rotulo: `${p.localNome} (${p.localCodigo})`,
            href: `/adm/locais/${p.localId}?aba=contratos`,
          },
          { rotulo: `PMOC${th ? ` ${th}` : ""}` },
        ]}
        titulo={`PMOC${th ? ` ${th}` : ""}`}
        estado={<StatusBadge tipo="pmoc" valor={p.situacao} tamanho="lg" />}
        acoes={
          p.podeAlterarPlano && (
            <EmitirPmoc
              pmocId={p.id}
              contratoId={p.contratoId}
              localId={p.localId}
              bloqueio={
                p.situacaoContrato === "ENCERRADO" || p.situacaoContrato === "CANCELADO"
                  ? "Contrato encerrado não emite PMOC."
                  : null
              }
            />
          )
        }
        meta={
          <span className="flex flex-wrap gap-x-2">
            <span>
              {p.clienteRazaoSocial} · {p.localNome} ({p.localCodigo})
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Vigência{" "}
              <Link href={`/adm/contratos/${p.contratoId}`}>
                {formatarDataIso(p.inicio)} a {formatarDataIso(p.fim)}
              </Link>{" "}
              ({p.meses} meses)
            </span>
            <span aria-hidden="true">·</span>
            <span>Versão {p.versaoAtual ? `v${p.versaoAtual}` : "ainda não emitida"}</span>
          </span>
        }
      />
      {sp.aviso === "criado" && (
        <Alert tom="success">PMOC criado em rascunho. Confira o plano e o cronograma.</Alert>
      )}
      {p.situacao === "HISTORICO" && <Alert tom="info">PMOC histórico: somente leitura.</Alert>}
      <Tabs base={`/adm/pmocs/${p.id}`} ativa={aba} abas={ABAS} />

      {aba === "plano" &&
        (p.tipos.length === 0 ? (
          <Card>
            <EmptyState
              icone={Fan}
              titulo="Nenhum equipamento no local."
              descricao="Cadastre equipamentos no local para montar o plano."
              acao={
                <Link
                  href={`/adm/locais/${p.localId}?aba=equipamentos`}
                  className={buttonClasses({ variant: "primary" })}
                >
                  Ir para os equipamentos
                </Link>
              }
            />
          </Card>
        ) : (
          <Plano
            pmocId={p.id}
            tipos={p.tipos}
            podeAlterar={p.podeAlterarPlano}
            rotulos={{
              periodicidades: PERIODICIDADES.map((v) => ({
                valor: v,
                rotulo: ROTULO_PERIODICIDADE[v],
              })),
              periodicidade: ROTULO_PERIODICIDADE,
              natureza: ROTULO_NATUREZA,
              unidadeMax: UNIDADE_MAX,
            }}
          />
        ))}

      {aba === "cronograma" && <Cronograma p={p} />}

      {aba === "versoes" && (
        <Card>
          <EmptyState icone={FileClock} titulo="Ainda não emitido." />
        </Card>
      )}
      {aba === "ficha" && (
        <Card>
          <EmptyState icone={History} titulo="A ficha aparece após a emissão." />
        </Card>
      )}
    </Page>
  );
}

/** "08/26" para a coluna do mês (UI). */
const mesAno = (referencia: string) => `${referencia.slice(5, 7)}/${referencia.slice(2, 4)}`;

/**
 * Aba Cronograma (doc 08 §7.3): grade por tipo, linhas = atividades, colunas = meses 1..N; "•"
 * prevista, "Ø" não prevista, legenda sempre visível. Rola na horizontal dentro do próprio
 * componente, com a coluna "Atividade" fixa à esquerda. Em `RASCUNHO` é pré-visualização (DM-05).
 * Tipo sem equipamento `ATIVO` não entra (RN-023).
 */
function Cronograma({ p }: { p: PmocCompleto }) {
  const tipos = p.tipos.filter((t) => t.equipamentosAtivos > 0 && t.atividades.length > 0);
  const fora = p.tipos.filter((t) => t.equipamentosAtivos === 0 && t.atividades.length > 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-text">
          <span className="font-semibold tabular-nums">{p.ocorrenciasPrevistas}</span> ocorrências
          previstas (equipamento × atividade × mês).
        </p>
        <dl className="flex gap-4 text-small text-text-muted" aria-label="Legenda">
          <div className="flex items-center gap-1">
            <dt className="font-semibold text-action">•</dt>
            <dd>Prevista</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-text-hint">Ø</dt>
            <dd>Não prevista</dd>
          </div>
        </dl>
      </div>
      {p.situacao === "RASCUNHO" && (
        <Alert tom="info">Pré-visualização: nada é gravado até a emissão.</Alert>
      )}
      {tipos.length === 0 && (
        <Card>
          <EmptyState titulo="Nenhuma atividade prevista." />
        </Card>
      )}
      {tipos.map((t) => (
        <Card
          key={t.id}
          titulo={t.nome}
          descricao={`${t.equipamentosAtivos} ${t.equipamentosAtivos === 1 ? "equipamento" : "equipamentos"}`}
        >
          <div className="overflow-x-auto rounded-md border border-border-subtle">
            <table
              className="w-full border-collapse text-body"
              aria-label={`Cronograma de ${t.nome}`}
            >
              <thead className="bg-surface-muted">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-sticky min-w-56 border-b border-r border-border bg-surface-muted px-4 py-3 text-left text-h5 text-text-label"
                  >
                    Atividade
                  </th>
                  {p.calendario.map((m) => (
                    <th
                      key={m.indice}
                      scope="col"
                      title={`Mês ${m.indice}`}
                      className="border-b border-border px-2 py-3 text-center text-h5 font-semibold whitespace-nowrap text-text-label tabular-nums"
                    >
                      {mesAno(m.referencia)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.atividades.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border-subtle last:border-b-0 hover:bg-surface-muted"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-sticky border-r border-border bg-surface px-4 py-2 text-left font-normal text-text"
                    >
                      {a.titulo}{" "}
                      <span className="text-small text-text-muted">({a.periodicidade})</span>
                    </th>
                    {p.calendario.map((m) => {
                      const prevista = a.previstos.includes(m.indice);
                      return (
                        <td
                          key={m.indice}
                          className={
                            prevista
                              ? "px-2 py-2 text-center font-semibold text-action"
                              : "px-2 py-2 text-center text-text-hint"
                          }
                        >
                          <span aria-hidden="true">{prevista ? "•" : "Ø"}</span>
                          <span className="sr-only">{prevista ? "Prevista" : "Não prevista"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {fora.length > 0 && (
        <p className="text-small text-text-muted">
          Sem equipamento ativo, fora do cronograma: {fora.map((t) => t.nome).join(", ")}.
        </p>
      )}
    </div>
  );
}
