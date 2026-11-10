import Link from "next/link";
import { exigirArea } from "@/server/auth/sessao";
import { ClienteForm } from "../cliente-form";

export const metadata = { title: "Novo cliente – Sistema PMOC" };

/** TL-109 vazio (FL-04 passo 1): só a aba Dados até salvar. */
export default async function NovoClientePage() {
  await exigirArea(["ADM"]);
  return (
    <section className="pagina">
      <p>
        <Link href="/adm/clientes">← Clientes</Link>
      </p>
      <h1>Novo cliente</h1>
      <ClienteForm />
    </section>
  );
}
