import { ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tag } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { CERTIFICADO_MAX, EXTENSOES_CERTIFICADO, obterConfiguracao } from "@/modules/empresa";
import { empresaDeps } from "@/server/arquivos";
import { exigirArea } from "@/server/auth/sessao";
import { EstadoCertificado, rotuloCertificado } from "../certificado-resumo";
import { CertificadoForm } from "./certificado-form";

export const metadata = { title: "Certificado do RT – Sistema PMOC" };

/**
 * TL-103 – Certificado do RT (RF-04.4; FL-02 passos 4–6). Template T-FORM. Mostra só titular, série,
 * emissor e validade; nunca baixa o arquivo nem mostra a senha (RN-121).
 */
export default async function CertificadoPage() {
  const s = await exigirArea(["ADM"]);
  const c = await obterConfiguracao(s.ctx, empresaDeps());
  if (!c) notFound();
  const atual = c.certificadoAtual;
  const todos = [...(atual ? [atual] : []), ...c.historico];

  return (
    <Page>
      <PageHeader
        migalhas={[
          { rotulo: "Empresa e RT", href: "/adm/empresa" },
          { rotulo: "Certificado do RT" },
        ]}
        titulo="Certificado do RT"
        estado={atual && <EstadoCertificado c={atual} />}
      />
      {atual && atual.estado !== "VALIDO" && (
        // TL-103 estados A_VENCER / VENCIDO (RN-114)
        <Alert tom={atual.estado === "VENCIDO" ? "danger" : "warning"}>
          {atual.estado === "VENCIDO"
            ? `Certificado vencido em ${formatarData(atual.validoAte)}. Envie um novo para emitir PMOCs.`
            : `${rotuloCertificado(atual)} (${formatarData(atual.validoAte)}).`}
        </Alert>
      )}

      <div className="max-w-content-form">
        {!c.rt ? (
          <Card>
            <EmptyState
              icone={UserRound}
              titulo="Cadastre o responsável técnico antes do certificado."
              acao={
                <Link href="/adm/empresa" className={buttonClasses({ variant: "primary" })}>
                  Ir para Empresa e RT
                </Link>
              }
            />
          </Card>
        ) : (
          <CertificadoForm tamanhoMax={CERTIFICADO_MAX} extensoes={EXTENSOES_CERTIFICADO} />
        )}
      </div>

      <section aria-labelledby="enviados" className="flex flex-col gap-4">
        <h2 id="enviados" className="text-h2 text-text">
          Certificados enviados
        </h2>
        <DataTable
          rotulo="Certificados enviados"
          linhas={todos}
          chave={(x) => x.id}
          colunas={[
            {
              titulo: "Titular",
              celula: (x) => (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {x.titular}
                  {x.atual && <Tag>atual</Tag>}
                </span>
              ),
            },
            { titulo: "Nº de série", celula: (x) => <span className="font-mono">{x.serie}</span> },
            { titulo: "Emissor", celula: (x) => x.emissor ?? "—", ocultarNoCelular: true },
            {
              titulo: "Validade",
              celula: (x) => `${formatarData(x.validoDe)} a ${formatarData(x.validoAte)}`,
              numerico: true,
            },
            {
              titulo: "Enviado",
              celula: (x) => `${formatarDataHora(x.enviadoEm)} · ${x.enviadoPor ?? "—"}`,
              numerico: true,
              ocultarNoCelular: true,
            },
          ]}
          estado={{ titulo: "Estado", celula: (x) => <EstadoCertificado c={x} /> }}
          vazio={
            <EmptyState
              icone={ShieldCheck}
              titulo="Nenhum certificado enviado."
              descricao="Sem certificado o PMOC não pode ser emitido."
            />
          }
        />
      </section>
    </Page>
  );
}
