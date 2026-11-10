import Link from "next/link";
import { Area } from "@/components/area";
import { formatarData, ROTULO_PERFIL } from "@/lib/formato";
import { minhaConta, minhasSessoes, segundoFatorAtivoDesde } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea, INICIO } from "@/server/auth/sessao";
import { getEnv } from "@/server/env";
import { DadosForm } from "./dados-form";
import { SenhaForm } from "./senha-form";
import { Sessoes } from "./sessoes";

export const runtime = "nodejs";
export const metadata = { title: "Minha conta – Sistema PMOC" };

/** TL-005 – Minha conta (todos os perfis; 04 §4.5). ADM sem segundo fator vai antes para TL-004. */
export default async function MinhaContaPage() {
  const s = await exigirArea(["ADM", "TECNICO", "CLIENTE"]);
  const deps = getAuth().deps;
  const [u, sessoes, desde, clientes] = await Promise.all([
    minhaConta(s.ctx, deps),
    minhasSessoes(s.ctx, s.sessaoId, deps),
    s.usuario.perfil === "ADM" ? segundoFatorAtivoDesde(s.ctx, deps) : Promise.resolve(null),
    s.usuario.perfil === "CLIENTE" ? listarClientesParaSelecao(s.ctx, deps) : Promise.resolve([]),
  ]);
  const cliente = clientes.find((c) => c.id === u.clientId)?.razaoSocial;
  const canal = getEnv().PRIVACIDADE_EMAIL;

  return (
    <Area titulo="Minha conta" nome={u.nome} menu={[{ href: INICIO[u.perfil], rotulo: "Início" }]}>
      <section className="pagina">
        <h1>Minha conta</h1>

        <h2>Seus dados</h2>
        <p className="dica">
          {ROTULO_PERFIL[u.perfil]}
          {cliente ? ` · ${cliente}` : ""}
        </p>
        <DadosForm rowVersion={u.rowVersion} nome={u.nome} email={u.email} telefone={u.telefone} />

        <h2>Senha</h2>
        <SenhaForm />

        <h2>Sessões ativas</h2>
        <Sessoes
          sessoes={sessoes.map((x) => ({
            ...x,
            criadaEm: x.criadaEm.toISOString(),
            ultimoUso: x.ultimoUso.toISOString(),
          }))}
        />

        {u.perfil === "ADM" && (
          <>
            <h2>Segundo fator</h2>
            <p>
              Ativo{desde ? ` desde ${formatarData(desde)}` : ""}.{" "}
              <Link href="/conta/segundo-fator">Gerar novos códigos de recuperação</Link>
            </p>
          </>
        )}

        <h2>Seus dados (LGPD)</h2>
        <p>
          Você pode pedir a confirmação e o acesso aos seus dados, a correção, a anonimização, o
          bloqueio ou a eliminação do que não for necessário, a portabilidade e informações sobre
          com quem os dados são compartilhados. Nome e telefone você corrige aqui mesmo.
        </p>
        <p>
          Para os demais pedidos,{" "}
          {canal ? (
            <>
              escreva para <a href={`mailto:${canal}`}>{canal}</a>.
            </>
          ) : (
            "fale com o administrador do sistema."
          )}
        </p>
      </section>
    </Area>
  );
}
