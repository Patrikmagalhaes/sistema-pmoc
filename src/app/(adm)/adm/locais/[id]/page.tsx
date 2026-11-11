import Link from "next/link";
import { notFound } from "next/navigation";
import { Abas } from "@/components/abas";
import { formatarDataIso, ROTULO_CONTRATO, ROTULO_PMOC, ROTULO_SITUACAO } from "@/lib/formato";
import { listarContratosDoLocal, obterLocal } from "@/modules/clientes";
import { listarEquipamentosDoLocal } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import type { RequestContext } from "@/server/context";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { LocalForm } from "../local-form";

export const metadata = { title: "Local – Sistema PMOC" };

const ABAS = [
  { id: "dados", rotulo: "Dados" },
  { id: "equipamentos", rotulo: "Equipamentos" },
  { id: "contratos", rotulo: "Contratos e PMOC" },
];

/** TL-110 – Local: abas Dados, Equipamentos e Contratos e PMOC (RF-06, RF-07, RF-09; FL-04, FL-06, FL-07). */
export default async function LocalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const deps = { db: getDatabase() };
  const l = await obterLocal(s.ctx, id, deps);
  if (!l) notFound();
  const aba = ABAS.some((a) => a.id === sp.aba) ? String(sp.aba) : "dados";
  const bloqueio =
    l.temContratoVivo || l.temEquipamentoVivo
      ? "Exclua antes os contratos e os equipamentos deste local."
      : null;

  return (
    <section className="pagina">
      <p>
        Cliente:{" "}
        <Link href={`/adm/clientes/${l.clienteId}?aba=locais`}>{l.clienteRazaoSocial}</Link>
      </p>
      <h1>
        {l.nome} ({l.codigo})
      </h1>
      {sp.aviso === "criado" && (
        <div className="alerta ok" role="status">
          Local criado com o código {l.codigo}.
        </div>
      )}
      <Abas base={`/adm/locais/${l.id}`} ativa={aba} abas={ABAS} />

      {aba === "dados" && (
        <>
          <LocalForm key={l.rowVersion} clienteId={l.clienteId} local={l} />
          <Excluir
            alvo="local"
            id={l.id}
            rowVersion={l.rowVersion}
            nome={`${l.nome} (${l.codigo})`}
            bloqueio={bloqueio}
            depois={`/adm/clientes/${l.clienteId}?aba=locais`}
          />
        </>
      )}

      {aba === "equipamentos" && (
        <Equipamentos
          ctx={s.ctx}
          localId={l.id}
          tipoId={typeof sp.tipo === "string" ? sp.tipo : null}
          mostrarInativos={sp.inativos === "1"}
        />
      )}

      {aba === "contratos" && (
        <Contratos localId={l.id} contratos={await listarContratosDoLocal(s.ctx, l.id, deps)} />
      )}
    </section>
  );
}

/** Aba Equipamentos (FL-07 passo 1): filtro por tipo e "Mostrar inativos" (UL-03), por TAG. */
async function Equipamentos({
  ctx,
  localId,
  tipoId,
  mostrarInativos,
}: {
  ctx: RequestContext;
  localId: string;
  tipoId: string | null;
  mostrarInativos: boolean;
}) {
  const r = await listarEquipamentosDoLocal(
    ctx,
    localId,
    { tipoId, mostrarInativos },
    { db: getDatabase() },
  );
  const lista = r?.equipamentos ?? [];
  return (
    <div className="secao">
      <p>
        <Link
          className="botao"
          style={{ width: "auto" }}
          href={`/adm/equipamentos/novo?local=${localId}`}
        >
          Novo equipamento
        </Link>
      </p>
      <form className="filtros" method="get">
        <input type="hidden" name="aba" value="equipamentos" />
        <label>
          Tipo{" "}
          <select name="tipo" defaultValue={tipoId ?? ""}>
            <option value="">Todos</option>
            {r?.tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="caixa">
          <input type="checkbox" name="inativos" value="1" defaultChecked={mostrarInativos} />
          Mostrar inativos
        </label>
        <button className="botao secundario" type="submit">
          Aplicar
        </button>
      </form>
      {lista.length === 0 ? (
        <p className="vazio">Nenhum equipamento.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>TAG</th>
                <th>Tipo</th>
                <th>Grupo</th>
                <th>Ambiente</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/adm/equipamentos/${e.id}`}>{e.tag}</Link>
                  </td>
                  <td>{e.tipo}</td>
                  <td>{e.grupo}</td>
                  <td>{e.ambiente}</td>
                  <td>{e.marca ?? "—"}</td>
                  <td>{e.modelo ?? "—"}</td>
                  <td>
                    <span className={`etiqueta ${e.situacao === "ATIVO" ? "ok" : "neutra"}`}>
                      {ROTULO_SITUACAO[e.situacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Contratos({
  localId,
  contratos,
}: {
  localId: string;
  contratos: Awaited<ReturnType<typeof listarContratosDoLocal>>;
}) {
  return (
    <div className="secao">
      <p>
        <Link
          className="botao"
          style={{ width: "auto" }}
          href={`/adm/contratos/novo?local=${localId}`}
        >
          Novo contrato
        </Link>
      </p>
      {!contratos?.length ? (
        <p className="vazio">Nenhum contrato. Cadastre o contrato para criar o PMOC.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Início</th>
                <th>Fim</th>
                <th>Meses</th>
                <th>ART</th>
                <th>TH-revisão</th>
                <th>Contrato</th>
                <th>PMOC</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/adm/contratos/${c.id}`}>{formatarDataIso(c.inicio)}</Link>
                  </td>
                  <td>{formatarDataIso(c.fim)}</td>
                  <td>{c.meses}</td>
                  <td>{c.art}</td>
                  <td>{[c.th, c.revisao].filter(Boolean).join("-") || "—"}</td>
                  <td>
                    <span className={`etiqueta ${c.situacao === "VIGENTE" ? "ok" : "neutra"}`}>
                      {ROTULO_CONTRATO[c.situacao]}
                    </span>
                  </td>
                  <td>{c.estadoPmoc ? (ROTULO_PMOC[c.estadoPmoc] ?? c.estadoPmoc) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
