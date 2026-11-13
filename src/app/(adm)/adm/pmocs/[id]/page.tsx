import Link from "next/link";
import { notFound } from "next/navigation";
import { Abas } from "@/components/abas";
import { formatarDataIso, ROTULO_PMOC } from "@/lib/formato";
import {
  PERIODICIDADES,
  ROTULO_NATUREZA,
  ROTULO_PERIODICIDADE,
  UNIDADE_MAX,
} from "@/modules/biblioteca";
import { obterPmoc, type PmocCompleto } from "@/modules/pmoc";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
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
 * TL-120 – PMOC (RF-10, RF-11; FL-08 passos 4–6). Abas Plano e Cronograma; a emissão (TL-121),
 * as versões e a ficha chegam com a emissão.
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
    <section className="pagina">
      <p>
        Cliente: <Link href={`/adm/clientes/${p.clienteId}`}>{p.clienteRazaoSocial}</Link> · Local:{" "}
        <Link href={`/adm/locais/${p.localId}?aba=contratos`}>
          {p.localNome} ({p.localCodigo})
        </Link>
      </p>
      <div className="titulo-pagina">
        <h1>PMOC{th ? ` ${th}` : ""}</h1>
        <span className={`etiqueta ${p.situacao === "RASCUNHO" ? "neutra" : "ok"}`}>
          {ROTULO_PMOC[p.situacao]}
        </span>
      </div>
      <p>
        Vigência:{" "}
        <Link href={`/adm/contratos/${p.contratoId}`}>
          {formatarDataIso(p.inicio)} a {formatarDataIso(p.fim)}
        </Link>{" "}
        ({p.meses} meses) · Versão atual:{" "}
        {p.versaoAtual ? `v${p.versaoAtual}` : "ainda não emitido"}
      </p>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          PMOC criado em rascunho. Confira o plano e o cronograma.
        </div>
      )}
      {p.situacao === "HISTORICO" && (
        <div className="alerta" role="status">
          PMOC histórico: somente leitura.
        </div>
      )}
      <Abas base={`/adm/pmocs/${p.id}`} ativa={aba} abas={ABAS} />

      {aba === "plano" &&
        (p.tipos.length === 0 ? (
          <p className="vazio">
            Cadastre equipamentos no{" "}
            <Link href={`/adm/locais/${p.localId}?aba=equipamentos`}>local</Link> para montar o
            plano.
          </p>
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

      {aba === "versoes" && <p className="vazio">Ainda não emitido.</p>}
      {aba === "ficha" && <p className="vazio">A ficha aparece após a emissão.</p>}
    </section>
  );
}

/** "08/26" para a coluna do mês (UI). */
const mesAno = (referencia: string) => `${referencia.slice(5, 7)}/${referencia.slice(2, 4)}`;

/**
 * Aba Cronograma: grade por tipo, linhas = atividades, colunas = meses 1..N; "•" prevista, "Ø" não
 * (UI). Em `RASCUNHO` é pré-visualização (DM-05). Tipo sem equipamento `ATIVO` não entra (RN-023).
 */
function Cronograma({ p }: { p: PmocCompleto }) {
  const tipos = p.tipos.filter((t) => t.equipamentosAtivos > 0 && t.atividades.length > 0);
  const fora = p.tipos.filter((t) => t.equipamentosAtivos === 0 && t.atividades.length > 0);
  return (
    <div className="secao">
      <p className="dica">
        {p.ocorrenciasPrevistas} ocorrências previstas (equipamento × atividade × mês).
        {p.situacao === "RASCUNHO" && " Pré-visualização: nada é gravado até a emissão."}
      </p>
      {tipos.length === 0 && <p className="vazio">Nenhuma atividade prevista.</p>}
      {tipos.map((t) => (
        <div key={t.id} className="secao">
          <h2>
            {t.nome} ({t.equipamentosAtivos}{" "}
            {t.equipamentosAtivos === 1 ? "equipamento" : "equipamentos"})
          </h2>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Atividade</th>
                  {p.calendario.map((m) => (
                    <th key={m.indice} title={`Mês ${m.indice}`} style={{ textAlign: "center" }}>
                      {mesAno(m.referencia)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.atividades.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.titulo} ({a.periodicidade})
                    </td>
                    {p.calendario.map((m) => (
                      <td key={m.indice} style={{ textAlign: "center" }}>
                        {a.previstos.includes(m.indice) ? "•" : "Ø"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {fora.length > 0 && (
        <p className="dica">
          Sem equipamento ativo, fora do cronograma: {fora.map((t) => t.nome).join(", ")}.
        </p>
      )}
    </div>
  );
}
