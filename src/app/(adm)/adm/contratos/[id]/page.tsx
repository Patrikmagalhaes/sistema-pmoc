import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarDataHora, formatarDataIso } from "@/lib/formato";
import { obterContrato } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { ContratoForm } from "../contrato-form";
import { AcoesContrato } from "./acoes";
import { CriarPmoc } from "./criar-pmoc";

export const metadata = { title: "Contrato – Sistema PMOC" };

/**
 * TL-112 – Contrato (RF-07, RF-15; FL-06). Template T-FORM com o estado no cabeçalho (doc 08 §7.3).
 * "Criar PMOC" e "Abrir PMOC" levam à TL-120 (FL-08).
 */
export default async function ContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await obterContrato(s.ctx, id, { db: getDatabase() });
  if (!c) notFound();
  const cancelado = c.situacao === "CANCELADO";
  const vigencia = `${formatarDataIso(c.inicio)} a ${formatarDataIso(c.fim)}`;

  return (
    <Page largura="form">
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          {
            rotulo: `${c.localNome} (${c.localCodigo})`,
            href: `/adm/locais/${c.localId}?aba=contratos`,
          },
          { rotulo: `Contrato ${vigencia}` },
        ]}
        titulo={`Contrato ${vigencia}`}
        estado={<StatusBadge tipo="contrato" valor={c.situacao} tamanho="lg" />}
        meta={`${c.localNome} (${c.localCodigo})`}
        acoes={
          <>
            <AcoesContrato
              id={c.id}
              rowVersion={c.rowVersion}
              localId={c.localId}
              inicio={c.inicio}
              fim={c.fim}
              podeRenovar={c.podeRenovar}
              podeConfirmarRenovacao={c.podeConfirmarRenovacao}
              podeCancelar={c.podeCancelar && !c.pmocEmitido}
              temPmoc={c.temPmoc}
            />
            {!cancelado && (
              <Excluir
                alvo="contrato"
                id={c.id}
                rowVersion={c.rowVersion}
                nome={`o contrato ${vigencia}`}
                bloqueio={c.podeExcluir ? null : "Exclua antes o PMOC deste contrato."}
                depois={`/adm/locais/${c.localId}?aba=contratos`}
              />
            )}
          </>
        }
      />

      {sp.aviso === "criado" && <Alert tom="success">Contrato salvo: {c.meses} meses.</Alert>}
      {cancelado && (
        <Alert tom="warning" titulo="Contrato cancelado">
          Contrato cancelado em {formatarDataIso(c.canceladoEm)}: {c.motivoCancelamento}
        </Alert>
      )}
      {c.podeCancelar && c.pmocEmitido && (
        <Alert tom="info">
          O cancelamento de contrato com PMOC emitido ainda não está disponível.
        </Alert>
      )}

      <Card
        titulo="PMOC"
        acao={
          c.pmocId ? (
            <Link
              href={`/adm/pmocs/${c.pmocId}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              <FileText size={20} aria-hidden="true" />
              Abrir PMOC
            </Link>
          ) : (
            c.podeCriarPmoc && <CriarPmoc contratoId={c.id} anteriorTemPmoc={c.anteriorTemPmoc} />
          )
        }
      >
        <DescriptionList
          itens={[
            {
              rotulo: "Estado do PMOC",
              valor: c.estadoPmoc ? (
                <StatusBadge tipo="pmoc" valor={c.estadoPmoc} />
              ) : (
                "Ainda não criado"
              ),
            },
          ]}
        />
      </Card>

      {c.anteriorId && (
        <Card titulo="Renovação">
          <DescriptionList
            itens={[
              {
                rotulo: "Contrato anterior",
                valor: (
                  <Link href={`/adm/contratos/${c.anteriorId}`}>
                    {formatarDataIso(c.anteriorInicio)} a {formatarDataIso(c.anteriorFim)}
                  </Link>
                ),
              },
              {
                rotulo: "Confirmação",
                valor: c.renovacaoConfirmadaEm
                  ? `Renovação confirmada em ${formatarDataHora(c.renovacaoConfirmadaEm)} por ${c.renovacaoConfirmadaPor ?? "—"}`
                  : "Renovação ainda não confirmada",
              },
            ]}
          />
        </Card>
      )}

      <ContratoForm
        key={c.rowVersion}
        localId={c.localId}
        contrato={c}
        datasTravadas={c.pmocEmitido}
        somenteLeitura={cancelado}
      />
    </Page>
  );
}
