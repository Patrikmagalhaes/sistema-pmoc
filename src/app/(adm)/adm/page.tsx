import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Painel de pendências – Sistema PMOC" };

/**
 * TL-100 – Painel de pendências: tela inicial do ADM (doc 08 FE-P3). Os grupos de pendência chegam
 * com a agenda e as visitas (doc 07); até lá, o estado vazio orienta para os cadastros.
 */
export default function PainelPage() {
  return (
    <Page>
      <PageHeader titulo="Painel de pendências" />
      <div className="rounded-lg border border-border bg-surface shadow-1">
        <EmptyState
          icone={LayoutDashboard}
          titulo="Ainda não há pendências"
          descricao="As pendências aparecem aqui depois que um PMOC é emitido e as visitas são geradas. Comece pelos cadastros."
          acao={
            <>
              <Link href="/adm/clientes" className={buttonClasses({ variant: "primary" })}>
                Ir para clientes
              </Link>
              <Link href="/adm/empresa" className={buttonClasses({ variant: "secondary" })}>
                Empresa e RT
              </Link>
            </>
          }
        />
      </div>
    </Page>
  );
}
