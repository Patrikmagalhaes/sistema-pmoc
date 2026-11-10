import { cookies } from "next/headers";
import { linkDeSenhaValido } from "@/modules/acesso";
import { COOKIE_LINK_SENHA } from "@/proxy";
import { getAuth } from "@/server/auth";
import { DefinirSenhaForm, LinkInvalido } from "./definir-senha-form";

export const runtime = "nodejs";
export const metadata = { title: "Definir senha – Sistema PMOC", referrer: "no-referrer" };

/** TL-003 – Definir nova senha (senha inicial e recuperação; FL-01). */
export default async function DefinirSenhaPage() {
  const token = (await cookies()).get(COOKIE_LINK_SENHA)?.value;
  const valido = token ? await linkDeSenhaValido(token, getAuth().deps) : false;
  return (
    <main className="centro">
      <div className="cartao">
        <h1>Definir senha</h1>
        {valido ? <DefinirSenhaForm /> : <LinkInvalido />}
      </div>
    </main>
  );
}
