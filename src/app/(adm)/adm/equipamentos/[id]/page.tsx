import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarData, ROTULO_SITUACAO } from "@/lib/formato";
import { obterEquipamento, UNIDADE_MAX, UNIDADE_PADRAO } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { EquipamentoForm } from "../equipamento-form";
import { SituacaoEquipamento } from "./situacao";

export const metadata = { title: "Equipamento – Sistema PMOC" };

/**
 * TL-111 – Equipamento (RF-09; FL-07). Os diálogos de impacto no cronograma (RN-067, RN-068) chegam
 * com o PMOC (Etapa 4); até lá, local com PMOC não inclui, inativa, reativa nem exclui equipamento.
 */
export default async function EquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const e = await obterEquipamento(s.ctx, id, { db: getDatabase() });
  if (!e) notFound();

  return (
    <section className="pagina">
      <p>
        Local:{" "}
        <Link href={`/adm/locais/${e.localId}?aba=equipamentos`}>
          {e.localNome} ({e.localCodigo})
        </Link>
      </p>
      <div className="titulo-pagina">
        <h1>{e.tag}</h1>
        <span className={`etiqueta ${e.situacao === "ATIVO" ? "ok" : "neutra"}`}>
          {ROTULO_SITUACAO[e.situacao]}
        </span>
      </div>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Equipamento criado com a TAG {e.tag}.
        </div>
      )}
      {e.situacao === "INATIVO" && (
        <p className="dica">Inativo desde {formatarData(e.inativadoEm)}.</p>
      )}

      <EquipamentoForm
        key={e.rowVersion}
        localId={e.localId}
        equipamento={e}
        unidadePadrao={UNIDADE_PADRAO}
        unidadeMax={UNIDADE_MAX}
      />
      <SituacaoEquipamento
        id={e.id}
        rowVersion={e.rowVersion}
        situacao={e.situacao}
        bloqueio={e.bloqueio}
      />
      {/* E-07.5: com registro, só "Inativar". */}
      {e.podeExcluir && (
        <Excluir
          alvo="equipamento"
          id={e.id}
          rowVersion={e.rowVersion}
          nome={e.tag}
          bloqueio={e.bloqueio}
          depois={`/adm/locais/${e.localId}?aba=equipamentos`}
        />
      )}
    </section>
  );
}
