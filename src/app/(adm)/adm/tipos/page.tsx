import Link from "next/link";
import { ROTULO_SITUACAO } from "@/lib/formato";
import { listarTipos } from "@/modules/biblioteca";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";

export const metadata = { title: "Tipos de equipamento – Sistema PMOC" };

/** TL-104 – Tipos de equipamento (FL-03; RF-08). */
export default async function TiposPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const mostrarInativos = sp.inativos === "1"; // UL-03
  const tipos = await listarTipos(s.ctx, { mostrarInativos }, { db: getDatabase() });

  return (
    <section className="pagina">
      <div className="titulo-pagina">
        <h1>Tipos de equipamento</h1>
        <Link className="botao" href="/adm/tipos/novo">
          Novo tipo
        </Link>
      </div>

      <form className="filtros" method="get">
        <label className="caixa">
          <input type="checkbox" name="inativos" value="1" defaultChecked={mostrarInativos} />
          Mostrar inativos
        </label>
        <button className="botao secundario" type="submit">
          Aplicar
        </button>
      </form>

      {tipos.length === 0 ? (
        <div className="vazio">
          {/* Carga inicial da análise §4 como semente: [A VALIDAR] (RF-08.6). */}
          <p>{mostrarInativos ? "Nenhum tipo cadastrado." : "Nenhum tipo ativo."}</p>
          <Link className="botao" href="/adm/tipos/novo">
            Novo tipo
          </Link>
        </div>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Sigla</th>
                <th>Grupos ativos</th>
                <th>Atividades ativas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/adm/tipos/${t.id}`}>{t.nome}</Link>
                  </td>
                  <td>{t.sigla}</td>
                  <td>{t.grupos}</td>
                  <td>{t.atividadesAtivas}</td>
                  <td>
                    <span className={`etiqueta ${t.situacao === "ATIVO" ? "ok" : "neutra"}`}>
                      {ROTULO_SITUACAO[t.situacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
