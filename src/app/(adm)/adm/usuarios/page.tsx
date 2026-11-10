import Link from "next/link";
import { formatarDataHora, ROTULO_PERFIL, ROTULO_SITUACAO } from "@/lib/formato";
import { listarUsuarios } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";

export const metadata = { title: "Usuários – Sistema PMOC" };

type SP = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** TL-106 – Usuários (04 §4.2; FL-04, FL-05). */
export default async function UsuariosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const deps = getAuth().deps;
  // UL-03: inativos só com o filtro; "todos" mostra os dois estados.
  const situacaoUrl = um(sp.situacao) ?? "ATIVO";
  const filtro = {
    perfil: um(sp.perfil) ?? null,
    situacao: situacaoUrl === "TODOS" ? null : situacaoUrl,
    clientId: um(sp.cliente) ?? null,
    busca: um(sp.busca) ?? null,
    pagina: um(sp.pagina) ?? null,
  };
  const [r, clientes] = await Promise.all([
    listarUsuarios(s.ctx, filtro, deps),
    listarClientesParaSelecao(s.ctx, deps),
  ]);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.razaoSocial]));
  const paginas = Math.max(1, Math.ceil(r.total / r.porPagina));
  const temFiltro = Boolean(
    filtro.perfil || filtro.clientId || filtro.busca || situacaoUrl !== "ATIVO",
  );

  const urlPagina = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && k !== "pagina") q.set(k, v);
    q.set("pagina", String(p));
    return `/adm/usuarios?${q}`;
  };

  return (
    <section className="pagina">
      <div className="titulo-pagina">
        <h1>Usuários</h1>
        <Link className="botao" href="/adm/usuarios/novo">
          Novo usuário
        </Link>
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="busca">Buscar</label>
          <input
            id="busca"
            name="busca"
            defaultValue={filtro.busca ?? ""}
            placeholder="Nome ou e-mail"
          />
        </div>
        <div className="campo">
          <label htmlFor="perfil">Perfil</label>
          <select id="perfil" name="perfil" defaultValue={filtro.perfil ?? ""}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_PERFIL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="situacao">Estado</label>
          <select id="situacao" name="situacao" defaultValue={situacaoUrl}>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
            <option value="TODOS">Todos</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cliente">Cliente</label>
          <select id="cliente" name="cliente" defaultValue={filtro.clientId ?? ""}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <button className="botao" type="submit">
          Filtrar
        </button>
      </form>

      {r.linhas.length === 0 ? (
        <div className="vazio">
          <p>{temFiltro ? "Nenhum resultado para os filtros." : "Nenhum usuário encontrado."}</p>
          {temFiltro && <Link href="/adm/usuarios">Limpar filtros</Link>}
        </div>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Último login</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/adm/usuarios/${u.id}`}>{u.nome}</Link>
                  </td>
                  <td>{u.email}</td>
                  <td>{ROTULO_PERFIL[u.perfil]}</td>
                  <td>{u.clientId ? (nomeCliente.get(u.clientId) ?? "—") : "—"}</td>
                  <td>
                    <span className={`etiqueta ${u.situacao === "ATIVO" ? "ok" : "neutra"}`}>
                      {ROTULO_SITUACAO[u.situacao]}
                    </span>
                  </td>
                  <td>{formatarDataHora(u.ultimoLogin)}</td>
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
