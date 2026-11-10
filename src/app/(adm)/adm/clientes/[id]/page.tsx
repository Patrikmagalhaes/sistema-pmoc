import Link from "next/link";
import { notFound } from "next/navigation";
import { Abas } from "@/components/abas";
import { formatarDataIso, ROTULO_PMOC, ROTULO_SITUACAO } from "@/lib/formato";
import { listarUsuarios } from "@/modules/acesso";
import { obterCliente } from "@/modules/clientes";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { ClienteForm } from "../cliente-form";
import { Excluir } from "../excluir";

export const metadata = { title: "Cliente – Sistema PMOC" };

const ABAS = [
  { id: "dados", rotulo: "Dados" },
  { id: "locais", rotulo: "Locais" },
  { id: "usuarios", rotulo: "Usuários" },
];

/** TL-109 – Cliente: abas Dados, Locais e Usuários (FL-04; RF-05, RF-06, RF-02). */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = getDatabase();
  const r = await obterCliente(s.ctx, id, { db });
  if (!r) notFound();
  const { cliente, locais } = r;
  const aba = ABAS.some((a) => a.id === sp.aba) ? String(sp.aba) : "dados";
  const base = `/adm/clientes/${cliente.id}`;

  return (
    <section className="pagina">
      <p>
        <Link href="/adm/clientes">← Clientes</Link>
      </p>
      <h1>{cliente.razaoSocial}</h1>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Cliente criado. Cadastre agora os locais e os usuários do portal.
        </div>
      )}
      <Abas base={base} ativa={aba} abas={ABAS} />

      {aba === "dados" && (
        <>
          <ClienteForm key={cliente.rowVersion} cliente={cliente} />
          <Excluir
            alvo="cliente"
            id={cliente.id}
            rowVersion={cliente.rowVersion}
            nome={cliente.razaoSocial}
            bloqueio={cliente.temLocalVivo ? "Exclua antes os locais deste cliente." : null}
            depois="/adm/clientes"
          />
        </>
      )}

      {aba === "locais" && (
        <div className="secao">
          <p>
            <Link
              className="botao"
              style={{ width: "auto" }}
              href={`/adm/locais/novo?cliente=${cliente.id}`}
            >
              Novo local
            </Link>
          </p>
          {locais.length === 0 ? (
            <p className="vazio">Nenhum local. Cadastre o primeiro local deste cliente.</p>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Cidade/UF</th>
                    <th>Contrato vigente até</th>
                    <th>PMOC</th>
                  </tr>
                </thead>
                <tbody>
                  {locais.map((l) => (
                    <tr key={l.id}>
                      <td>{l.codigo}</td>
                      <td>
                        <Link href={`/adm/locais/${l.id}`}>{l.nome}</Link>
                      </td>
                      <td>
                        {l.cidade}/{l.uf}
                      </td>
                      <td>{formatarDataIso(l.vigenteAte)}</td>
                      <td>{l.estadoPmoc ? (ROTULO_PMOC[l.estadoPmoc] ?? l.estadoPmoc) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === "usuarios" && <Usuarios clienteId={cliente.id} ctx={s.ctx} db={db} />}
    </section>
  );
}

/** TL-109 aba Usuários: lista do módulo `acesso` filtrada pelo cliente (FL-04 passos 4–5). */
async function Usuarios({
  clienteId,
  ctx,
  db,
}: {
  clienteId: string;
  ctx: Parameters<typeof listarUsuarios>[0];
  db: ReturnType<typeof getDatabase>;
}) {
  const r = await listarUsuarios(ctx, { clientId: clienteId, perfil: "CLIENTE" }, { db });
  return (
    <div className="secao">
      <p>
        <Link
          className="botao"
          style={{ width: "auto" }}
          href={`/adm/usuarios/novo?cliente=${clienteId}`}
        >
          Novo usuário
        </Link>
      </p>
      {r.linhas.length === 0 ? (
        <p className="vazio">
          Nenhum usuário. O cliente não terá acesso ao portal até ter um usuário.
        </p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/adm/usuarios/${u.id}`}>{u.nome}</Link>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`etiqueta ${u.situacao === "ATIVO" ? "ok" : "neutra"}`}>
                      {ROTULO_SITUACAO[u.situacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.total > r.linhas.length && (
        <p className="dica">
          Mostrando {r.linhas.length} de {r.total}.{" "}
          <Link href={`/adm/usuarios?cliente=${clienteId}&situacao=TODOS`}>Ver todos</Link>
        </p>
      )}
    </div>
  );
}
