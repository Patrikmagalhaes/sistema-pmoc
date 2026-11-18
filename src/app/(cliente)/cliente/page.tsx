import { Home } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/** TL-300 – Início do cliente: provisória; a tela definitiva entra na etapa dela (doc 07). */
export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Início" />
      <div className="rounded-lg border border-border bg-surface shadow-1">
        <EmptyState
          icone={Home}
          titulo="Portal em preparação"
          descricao="Aqui você vai acompanhar as visitas, os PMOCs e os relatórios, e assinar os documentos."
        />
      </div>
    </div>
  );
}
