import Link from "next/link";
import { mascararCnpj } from "@/lib/formato";
import { listarClientes } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";

export const metadata = { title: "Clientes – Sistema PMOC" };

type SP = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** TL-108 – Clientes (FL-04; RF-05). */
export default async function ClientesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const busca = um(sp.busca) ?? null;
  const r = await listarClientes(
    s.ctx,
    { busca, pagina: um(sp.pagina) ?? null },
    { db: getDatabase() },
  );
  const paginas = Math.max(1, Math.ceil(r.total / r.porPagina));
  const urlPagina = (p: number) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    q.set("pagina", String(p));
    return `/adm/clientes?${q}`;
  };

  return (
    <section className="pagina">
      <div className="titulo-pagina">
        <h1>Clientes</h1>
        <Link className="botao" href="/adm/clientes/novo">
          Novo cliente
        </Link>
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="busca">Buscar</label>
          <input
            id="busca"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Razão social, nome fantasia ou CNPJ"
          />
        </div>
        <button className="botao" type="submit">
          Filtrar
        </button>
      </form>

      {r.linhas.length === 0 ? (
        <div className="vazio">
          {busca ? (
            <>
              <p>Nenhum resultado para a busca.</p>
              <Link href="/adm/clientes">Limpar busca</Link>
            </>
          ) : (
            <>
              <p>Nenhum cliente cadastrado.</p>
              <Link className="botao" href="/adm/clientes/novo">
                Novo cliente
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Cidade/UF</th>
                <th>Locais</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/adm/clientes/${c.id}`}>{c.razaoSocial}</Link>
                  </td>
                  <td>{c.nomeFantasia ?? "—"}</td>
                  <td>{mascararCnpj(c.cnpj)}</td>
                  <td>
                    {c.cidade}/{c.uf}
                  </td>
                  <td>{c.locais}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="paginacao" aria-label="Paginação">
          {r.pagina > 1 && <Link href={urlPagina(r.pagina - 1)}>Anterior</Link>}
          <span>
            Página {r.pagina} de {paginas}
          </span>
          {r.pagina < paginas && <Link href={urlPagina(r.pagina + 1)}>Próxima</Link>}
        </nav>
      )}
    </section>
  );
}
