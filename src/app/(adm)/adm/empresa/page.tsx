import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarData } from "@/lib/formato";
import { obterConfiguracao } from "@/modules/empresa";
import { empresaDeps } from "@/server/arquivos";
import { exigirArea } from "@/server/auth/sessao";
import { EstadoCertificado } from "./certificado-resumo";
import { EmpresaForm } from "./empresa-form";
import { RtForm } from "./rt-form";

export const metadata = { title: "Empresa e RT – Sistema PMOC" };

/** TL-102 – Empresa executora e RT (RF-04; FL-02). Registros únicos: sem "Nova empresa" nem "Excluir" (CA-04.1). */
export default async function EmpresaPage() {
  const s = await exigirArea(["ADM"]);
  const c = await obterConfiguracao(s.ctx, empresaDeps());
  if (!c) notFound();

  return (
    <section className="pagina">
      <h1>{c.empresa ? "Empresa executora e RT" : "Configure a empresa executora"}</h1>
      {c.houveEmissao && (
        // E-02.7 (RF-04.5)
        <div className="alerta aviso" role="status">
          Alterações não mudam PMOCs já emitidos; valem para novas emissões.
        </div>
      )}

      <div className="secao">
        <h2>Empresa</h2>
        <EmpresaForm key={c.empresa?.rowVersion ?? 0} empresa={c.empresa} />
      </div>

      <div className="secao">
        <h2>Responsável técnico</h2>
        <RtForm key={c.rt?.rowVersion ?? 0} rt={c.rt} />
        <h3>Certificado e-CPF</h3>
        {c.certificadoAtual ? (
          <p>
            {c.certificadoAtual.titular} · válido até {formatarData(c.certificadoAtual.validoAte)}{" "}
            <EstadoCertificado c={c.certificadoAtual} />
          </p>
        ) : (
          <p className="dica">
            Nenhum certificado enviado. Sem certificado o PMOC não pode ser emitido.
          </p>
        )}
        <p>
          <Link
            className="botao secundario"
            style={{ width: "auto" }}
            href="/adm/empresa/certificado"
          >
            Gerenciar certificado
          </Link>
        </p>
      </div>
    </section>
  );
}
