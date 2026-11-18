import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarDataHora, ROTULO_PERFIL } from "@/lib/formato";
import { MOTIVO_MAX, obterUsuario } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";
import { UsuarioForm } from "../usuario-form";
import { AcoesUsuario } from "./acoes";
import { RedefinirSegundoFator } from "./segundo-fator";

export const metadata = { title: "Usuário – Sistema PMOC" };

/** TL-107 – Usuário (edição, inativar, reativar, reenviar link). Template T-FORM (doc 08 §7.4). */
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
    <Page largura="form">
      <PageHeader
        migalhas={[{ rotulo: "Usuários", href: "/adm/usuarios" }, { rotulo: u.nome }]}
        titulo={u.nome}
        estado={<StatusBadge tipo="situacao" valor={u.situacao} tamanho="lg" />}
        meta={
          <>
            {ROTULO_PERFIL[u.perfil]} · Último login: {formatarDataHora(u.ultimoLogin)}
            {u.inativadoEm ? ` · Inativo desde ${formatarDataHora(u.inativadoEm)}` : ""}
          </>
        }
        acoes={
          <>
            <AcoesUsuario
              id={u.id}
              rowVersion={u.rowVersion}
              nome={u.nome}
              situacao={u.situacao}
              proprio={u.id === s.ctx.userId}
            />
            {u.perfil === "ADM" &&
              u.situacao === "ATIVO" &&
              u.segundoFatorAtivo &&
              u.id !== s.ctx.userId && (
                <RedefinirSegundoFator id={u.id} nome={u.nome} motivoMax={MOTIVO_MAX} />
              )}
          </>
        }
      />
      {aviso === "criado" && (
        <Alert tom="success">Usuário criado. Enviamos o link para definir a senha.</Alert>
      )}
      {aviso === "sem-email" && (
        <Alert tom="warning">
          Usuário criado, mas o e-mail não foi enviado. Use "Reenviar link de senha".
        </Alert>
      )}
      <UsuarioForm
        key={u.rowVersion}
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
    </Page>
  );
}
