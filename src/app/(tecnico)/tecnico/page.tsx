import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/** TL-200 – Minhas visitas: provisória; a tela definitiva entra na etapa dela (doc 07). */
export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Minhas visitas" />
      <div className="rounded-lg border border-border bg-surface shadow-1">
        <EmptyState
          icone={ClipboardList}
          titulo="Nenhuma visita"
          descricao="As visitas agendadas para você aparecem aqui."
        />
      </div>
    </div>
  );
}
