"use client";
import { FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { criarPmocAction } from "../../pmocs/actions";

/**
 * TL-112 "Criar PMOC" (FL-08 passos 1–3). Com PMOC no contrato anterior, pergunta em diálogo se
 * copia o plano e as periodicidades dele (RN-004); a cópia nunca traz ocorrências, registros,
 * visitas nem assinaturas.
 */
export function CriarPmoc({
  contratoId,
  anteriorTemPmoc,
}: {
  contratoId: string;
  anteriorTemPmoc: boolean;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [perguntando, setPerguntando] = useState(false);
  const [enviando, setEnviando] = useState<"copiar" | "biblioteca" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(copiarDoAnterior: boolean) {
    setEnviando(copiarDoAnterior ? "copiar" : "biblioteca");
    setErro(null);
    const r = await chamarAcao(criarPmocAction({ contratoId, copiarDoAnterior }));
    if (r.tipo === "ok") {
      router.push(`/adm/pmocs/${(r.dados as { id: string }).id}?aviso=criado`);
      return;
    }
    setEnviando(null);
    setErro(
      r.tipo === "conflito"
        ? "Este registro foi alterado por outra pessoa. Recarregue a página."
        : r.mensagem,
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        icon={<FilePlus2 size={20} aria-hidden="true" />}
        disabled={!pronto}
        loading={enviando !== null && !perguntando}
        onClick={() => (anteriorTemPmoc ? setPerguntando(true) : criar(false))}
      >
        {enviando && !perguntando ? "Criando…" : "Criar PMOC"}
      </Button>
      {erro && !perguntando && (
        <Alert tom="danger" className="basis-full">
          {erro}
        </Alert>
      )}
      <Dialog
        aberto={perguntando}
        aoFechar={() => setPerguntando(false)}
        travado={enviando !== null}
        titulo="Copiar plano e periodicidades do PMOC anterior?"
        rodape={
          <>
            <Button disabled={enviando !== null} onClick={() => setPerguntando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={enviando !== null}
              loading={enviando === "biblioteca"}
              onClick={() => criar(false)}
            >
              Usar a biblioteca
            </Button>
            <Button
              variant="primary"
              disabled={enviando !== null}
              loading={enviando === "copiar"}
              onClick={() => criar(true)}
            >
              Copiar do anterior
            </Button>
          </>
        }
      >
        {erro && <Alert tom="danger">{erro}</Alert>}
        <p className="text-text">
          A cópia nunca traz ocorrências, registros, visitas ou assinaturas.
        </p>
      </Dialog>
    </>
  );
}
