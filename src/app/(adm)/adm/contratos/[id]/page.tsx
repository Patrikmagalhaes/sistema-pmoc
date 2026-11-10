import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarDataHora, formatarDataIso, ROTULO_CONTRATO, ROTULO_PMOC } from "@/lib/formato";
import { obterContrato } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { ContratoForm } from "../contrato-form";
import { AcoesContrato } from "./acoes";

export const metadata = { title: "Contrato – Sistema PMOC" };

/**
 * TL-112 – Contrato (RF-07, RF-15; FL-06). "Criar PMOC" e "Abrir PMOC" (FL-08, TL-120) entram com a
 * Etapa 4.
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

  return (
    <section className="pagina">
      <p>
        Local:{" "}
        <Link href={`/adm/locais/${c.localId}?aba=contratos`}>
          {c.localNome} ({c.localCodigo})
        </Link>
      </p>
      <div className="titulo-pagina">
        <h1>
          Contrato {formatarDataIso(c.inicio)} a {formatarDataIso(c.fim)}
        </h1>
        <span className={`etiqueta ${c.situacao === "VIGENTE" ? "ok" : "neutra"}`}>
          {ROTULO_CONTRATO[c.situacao]}
        </span>
      </div>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Contrato salvo: {c.meses} meses.
        </div>
      )}
      {cancelado && (
        <div className="alerta erro" role="status">
          Contrato cancelado em {formatarDataIso(c.canceladoEm)}: {c.motivoCancelamento}
        </div>
      )}
      {c.anteriorId && (
        <p>
          Contrato anterior:{" "}
          <Link href={`/adm/contratos/${c.anteriorId}`}>
            {formatarDataIso(c.anteriorInicio)} a {formatarDataIso(c.anteriorFim)}
          </Link>
          {c.renovacaoConfirmadaEm
            ? ` · Renovação confirmada em ${formatarDataHora(c.renovacaoConfirmadaEm)} por ${c.renovacaoConfirmadaPor ?? "—"}`
            : " · Renovação ainda não confirmada"}
        </p>
      )}
      <p className="dica">
        PMOC: {c.estadoPmoc ? (ROTULO_PMOC[c.estadoPmoc] ?? c.estadoPmoc) : "ainda não criado"}.
      </p>

      <ContratoForm
        key={c.rowVersion}
        localId={c.localId}
        contrato={c}
        datasTravadas={c.pmocEmitido}
        somenteLeitura={cancelado}
      />
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
      {c.podeCancelar && c.pmocEmitido && (
        <p className="dica">
          O cancelamento de contrato com PMOC emitido ainda não está disponível.
        </p>
      )}
      {!cancelado && (
        <Excluir
          alvo="contrato"
          id={c.id}
          rowVersion={c.rowVersion}
          nome={`o contrato ${formatarDataIso(c.inicio)} a ${formatarDataIso(c.fim)}`}
          bloqueio={c.podeExcluir ? null : "Exclua antes o PMOC deste contrato."}
          depois={`/adm/locais/${c.localId}?aba=contratos`}
        />
      )}
    </section>
  );
}
