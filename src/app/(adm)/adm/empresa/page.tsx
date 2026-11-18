import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarData } from "@/lib/formato";
import { obterConfiguracao } from "@/modules/empresa";
import { empresaDeps } from "@/server/arquivos";
import { exigirArea } from "@/server/auth/sessao";
import { EstadoCertificado } from "./certificado-resumo";
import { EmpresaForm } from "./empresa-form";
import { RtForm } from "./rt-form";

export const metadata = { title: "Empresa e RT – Sistema PMOC" };

/**
 * TL-102 – Empresa executora e RT (RF-04; FL-02). Registros únicos: sem "Nova empresa" nem "Excluir"
 * (CA-04.1). Template T-FORM com duas seções, cada uma com seu botão (doc 08 §7.4), e o resumo do
 * certificado do RT (TL-103).
 */
export default async function EmpresaPage() {
  const s = await exigirArea(["ADM"]);
  const c = await obterConfiguracao(s.ctx, empresaDeps());
  if (!c) notFound();
  const cert = c.certificadoAtual;

  return (
    <Page largura="form">
      <PageHeader
        titulo={c.empresa ? "Empresa executora e RT" : "Configure a empresa executora"}
        meta="Empresa, responsável técnico e certificado usados na emissão do PMOC."
      />
      {c.houveEmissao && (
        // E-02.7 (RF-04.5)
        <Alert tom="warning">
          Alterações não mudam PMOCs já emitidos; valem para novas emissões.
        </Alert>
      )}
      {cert && cert.estado !== "VALIDO" && (
        // FE-H1.3: certificado a vencer / vencido como Alert.
        <Alert
          tom={cert.estado === "VENCIDO" ? "danger" : "warning"}
          acao={
            <Link href="/adm/empresa/certificado" className={buttonClasses({ size: "sm" })}>
              Gerenciar certificado
            </Link>
          }
        >
          {cert.estado === "VENCIDO"
            ? `Certificado do RT vencido em ${formatarData(cert.validoAte)}. Envie um novo para emitir PMOCs.`
            : `O certificado do RT vence em ${formatarData(cert.validoAte)}.`}
        </Alert>
      )}

      <EmpresaForm key={c.empresa?.rowVersion ?? 0} empresa={c.empresa} />
      <RtForm key={c.rt?.rowVersion ?? 0} rt={c.rt} />

      <Card
        titulo="Certificado do RT (e-CPF)"
        acao={
          <Link href="/adm/empresa/certificado" className={buttonClasses({ variant: "secondary" })}>
            <ShieldCheck size={20} aria-hidden="true" />
            Gerenciar certificado
          </Link>
        }
      >
        {cert ? (
          <DescriptionList
            itens={[
              { rotulo: "Titular", valor: cert.titular },
              { rotulo: "Válido até", valor: formatarData(cert.validoAte) },
              { rotulo: "Estado", valor: <EstadoCertificado c={cert} /> },
            ]}
          />
        ) : (
          <p className="text-body text-text-muted">
            Nenhum certificado enviado. Sem certificado o PMOC não pode ser emitido.
          </p>
        )}
      </Card>
    </Page>
  );
}
