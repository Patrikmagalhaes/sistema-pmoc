import Link from "next/link";
import { notFound } from "next/navigation";
import { ROTULO_SITUACAO } from "@/lib/formato";
import {
  obterTipo,
  ROTULO_NATUREZA,
  ROTULO_PERIODICIDADE,
  UNIDADE_MAX,
} from "@/modules/biblioteca";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { TipoForm } from "../tipo-form";
import { AcoesItem } from "./acoes-item";
import { Atividades } from "./atividades";
import { Grupos } from "./grupos";

export const metadata = { title: "Tipo de equipamento – Sistema PMOC" };

/** TL-105 – Tipo de equipamento: dados, grupos e atividades padrão (FL-03; RF-08). */
export default async function TipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await obterTipo(s.ctx, id, { db: getDatabase() });
  if (!r) notFound();
  const { tipo, grupos, atividades } = r;

  return (
    <section className="pagina">
      <p>
        <Link href="/adm/tipos">← Tipos de equipamento</Link>
      </p>
      <div className="titulo-pagina">
        <h1>
          {tipo.nome} ({tipo.sigla})
        </h1>
        <span className={`etiqueta ${tipo.situacao === "ATIVO" ? "ok" : "neutra"}`}>
          {ROTULO_SITUACAO[tipo.situacao]}
        </span>
      </div>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Tipo criado. Agora inclua as atividades padrão.
        </div>
      )}
      <p className="dica">
        A biblioteca é o padrão: alterações aqui não mudam PMOCs já criados (RF-08.5).
      </p>

      <TipoForm key={tipo.rowVersion} tipo={tipo} />
      <div className="acoes">
        <AcoesItem
          alvo="tipo"
          id={tipo.id}
          rowVersion={tipo.rowVersion}
          nome={tipo.nome}
          situacao={tipo.situacao}
          emUso={tipo.emUso}
          aoExcluir="/adm/tipos"
        />
        {tipo.emUso && (
          <p className="dica">
            Este tipo já foi usado (PMOC ou equipamento): só pode ser inativado.
          </p>
        )}
      </div>

      <div className="secao">
        <h2>Grupos permitidos</h2>
        <Grupos tipoId={tipo.id} grupos={grupos} />
      </div>

      <div className="secao">
        <h2>Atividades padrão</h2>
        <Atividades
          tipoId={tipo.id}
          atividades={atividades}
          rotulos={{
            periodicidade: ROTULO_PERIODICIDADE,
            natureza: ROTULO_NATUREZA,
            unidadeMax: UNIDADE_MAX,
          }}
        />
      </div>
    </section>
  );
}
