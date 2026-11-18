import { Page, PageHeader } from "@/components/ui/page-header";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";
import { UsuarioForm } from "../usuario-form";

export const metadata = { title: "Novo usuário – Sistema PMOC" };

/** TL-107 – criação (FL-04 passo 4, FL-05). `?cliente=` vem de TL-109 e trava perfil e cliente. */
export default async function NovoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const sp = await searchParams;
  const clientes = await listarClientesParaSelecao(s.ctx, getAuth().deps);
  const cliente = typeof sp.cliente === "string" ? sp.cliente : null;
  const travado =
    cliente && clientes.some((c) => c.id === cliente) ? { clientId: cliente } : undefined;
  const nomeCliente = travado ? clientes.find((c) => c.id === travado.clientId)?.razaoSocial : null;
  return (
    <Page largura="form">
      <PageHeader
        migalhas={
          travado && nomeCliente
            ? [
                { rotulo: "Clientes", href: "/adm/clientes" },
                { rotulo: nomeCliente, href: `/adm/clientes/${travado.clientId}?aba=usuarios` },
                { rotulo: "Novo usuário" },
              ]
            : [{ rotulo: "Usuários", href: "/adm/usuarios" }, { rotulo: "Novo usuário" }]
        }
        titulo="Novo usuário"
      />
      <UsuarioForm
        clientes={clientes}
        travado={travado}
        cancelarHref={travado ? `/adm/clientes/${travado.clientId}?aba=usuarios` : "/adm/usuarios"}
      />
    </Page>
  );
}
