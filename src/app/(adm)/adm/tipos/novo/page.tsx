import { Page, PageHeader } from "@/components/ui/page-header";
import { exigirArea } from "@/server/auth/sessao";
import { TipoForm } from "../tipo-form";

export const metadata = { title: "Novo tipo – Sistema PMOC" };

/** TL-105 vazio (FL-03 passo 2): as atividades são incluídas depois de salvar o tipo. */
export default async function NovoTipoPage() {
  await exigirArea(["ADM"]);
  return (
    <Page largura="form">
      <PageHeader
        migalhas={[{ rotulo: "Tipos de equipamento", href: "/adm/tipos" }, { rotulo: "Novo tipo" }]}
        titulo="Novo tipo de equipamento"
        meta="As atividades padrão são incluídas depois de salvar o tipo."
      />
      <TipoForm />
    </Page>
  );
}
