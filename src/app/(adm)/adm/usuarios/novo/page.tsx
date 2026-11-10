import Link from "next/link";
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
  return (
    <section className="pagina">
      <p>
        <Link href="/adm/usuarios">← Usuários</Link>
      </p>
      <h1>Novo usuário</h1>
      <p className="dica">
        Ao salvar, o usuário recebe por e-mail um link para definir a senha (vale 72 horas).
      </p>
      <UsuarioForm clientes={clientes} travado={travado} />
    </section>
  );
}
