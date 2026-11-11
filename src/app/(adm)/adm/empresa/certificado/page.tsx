import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { CERTIFICADO_MAX, EXTENSOES_CERTIFICADO, obterConfiguracao } from "@/modules/empresa";
import { empresaDeps } from "@/server/arquivos";
import { exigirArea } from "@/server/auth/sessao";
import { classeCertificado, EstadoCertificado, rotuloCertificado } from "../certificado-resumo";
import { CertificadoForm } from "./certificado-form";

export const metadata = { title: "Certificado do RT – Sistema PMOC" };

/**
 * TL-103 – Certificado do RT (RF-04.4; FL-02 passos 4–6). Mostra só titular, série, emissor e validade;
 * nunca baixa o arquivo nem mostra a senha (RN-121).
 */
export default async function CertificadoPage() {
  const s = await exigirArea(["ADM"]);
  const c = await obterConfiguracao(s.ctx, empresaDeps());
  if (!c) notFound();
  const atual = c.certificadoAtual;
  const todos = [...(atual ? [atual] : []), ...c.historico];

  return (
    <section className="pagina">
      <p>
        <Link href="/adm/empresa">← Empresa e RT</Link>
      </p>
      <h1>Certificado do RT</h1>
      {atual && atual.estado !== "VALIDO" && (
        // TL-103 estados A_VENCER / VENCIDO (RN-114)
        <div className={`alerta ${classeCertificado(atual.estado)}`} role="status">
          {atual.estado === "VENCIDO"
            ? `Certificado vencido em ${formatarData(atual.validoAte)}. Envie um novo para emitir PMOCs.`
            : `${rotuloCertificado(atual)} (${formatarData(atual.validoAte)}).`}
        </div>
      )}
      {!c.rt ? (
        <p className="vazio">Cadastre o responsável técnico antes do certificado.</p>
      ) : (
        <CertificadoForm tamanhoMax={CERTIFICADO_MAX} extensoes={EXTENSOES_CERTIFICADO} />
      )}

      <div className="secao">
        <h2>Certificados enviados</h2>
        {todos.length === 0 ? (
          <p className="vazio">
            Nenhum certificado enviado. Sem certificado o PMOC não pode ser emitido.
          </p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Titular</th>
                  <th>Nº de série</th>
                  <th>Emissor</th>
                  <th>Válido de</th>
                  <th>Válido até</th>
                  <th>Estado</th>
                  <th>Enviado em</th>
                  <th>Enviado por</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.titular}
                      {x.atual && <span className="etiqueta neutra"> atual</span>}
                    </td>
                    <td>{x.serie}</td>
                    <td>{x.emissor ?? "—"}</td>
                    <td>{formatarData(x.validoDe)}</td>
                    <td>{formatarData(x.validoAte)}</td>
                    <td>
                      <EstadoCertificado c={x} />
                    </td>
                    <td>{formatarDataHora(x.enviadoEm)}</td>
                    <td>{x.enviadoPor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
