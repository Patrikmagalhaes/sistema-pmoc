import Link from "next/link";
import { exigirArea } from "@/server/auth/sessao";
import { TipoForm } from "../tipo-form";

export const metadata = { title: "Novo tipo – Sistema PMOC" };

/** TL-105 vazio (FL-03 passo 2): as atividades são incluídas depois de salvar o tipo. */
export default async function NovoTipoPage() {
  await exigirArea(["ADM"]);
  return (
    <section className="pagina">
      <p>
        <Link href="/adm/tipos">← Tipos de equipamento</Link>
      </p>
      <h1>Novo tipo de equipamento</h1>
      <TipoForm />
    </section>
  );
}
