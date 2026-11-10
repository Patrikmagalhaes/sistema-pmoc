import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarDataHora, ROTULO_SITUACAO } from "@/lib/formato";
import { obterUsuario } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";
import { UsuarioForm } from "../usuario-form";
import { AcoesUsuario } from "./acoes";

export const metadata = { title: "Usuário – Sistema PMOC" };

/** TL-107 – Usuário (edição, inativar, reativar, reenviar link). */
export default async function UsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const deps = getAuth().deps;
  const [u, clientes] = await Promise.all([
    obterUsuario(s.ctx, id, deps),
    listarClientesParaSelecao(s.ctx, deps),
  ]);
  if (!u) notFound();
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  return (
    <section className="pagina">
      <p>
        <Link href="/adm/usuarios">← Usuários</Link>
      </p>
      <div className="titulo-pagina">
        <h1>{u.nome}</h1>
        <span className={`etiqueta ${u.situacao === "ATIVO" ? "ok" : "neutra"}`}>
          {ROTULO_SITUACAO[u.situacao]}
          {u.inativadoEm ? ` desde ${formatarDataHora(u.inativadoEm)}` : ""}
        </span>
      </div>
      {aviso === "criado" && (
        <div className="alerta ok" role="status">
          Usuário criado. Enviamos o link para definir a senha.
        </div>
      )}
      {aviso === "sem-email" && (
        <div className="alerta erro" role="status">
          Usuário criado, mas o e-mail não foi enviado. Use "Reenviar link de senha".
        </div>
      )}
      <p className="dica">Último login: {formatarDataHora(u.ultimoLogin)}</p>
      <UsuarioForm
        clientes={clientes}
        usuario={{
          id: u.id,
          rowVersion: u.rowVersion,
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          clientId: u.clientId,
          telefone: u.telefone,
        }}
      />
      <AcoesUsuario
        id={u.id}
        rowVersion={u.rowVersion}
        nome={u.nome}
        situacao={u.situacao}
        proprio={u.id === s.ctx.userId}
      />
    </section>
  );
}
