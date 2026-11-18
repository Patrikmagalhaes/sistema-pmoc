import { Page, PageHeader } from "@/components/ui/page-header";
import { exigirArea } from "@/server/auth/sessao";
import { ClienteForm } from "../cliente-form";

export const metadata = { title: "Novo cliente – Sistema PMOC" };

/** TL-109 vazio (FL-04 passo 1): só a aba Dados até salvar. Template T-FORM. */
export default async function NovoClientePage() {
  await exigirArea(["ADM"]);
  return (
    <Page largura="form">
      <PageHeader
        migalhas={[{ rotulo: "Clientes", href: "/adm/clientes" }, { rotulo: "Novo cliente" }]}
        titulo="Novo cliente"
      />
      <ClienteForm />
    </Page>
  );
}
