"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { criarPmocAction } from "../../pmocs/actions";

/**
 * TL-112 "Criar PMOC" (FL-08 passos 1–3). Com PMOC no contrato anterior, pergunta se copia o plano e
 * as periodicidades dele (RN-004); a cópia nunca traz ocorrências, registros, visitas nem assinaturas.
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
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(copiarDoAnterior: boolean) {
    setEnviando(true);
    setErro(null);
    const r = await chamarAcao(criarPmocAction({ contratoId, copiarDoAnterior }));
    if (r.tipo === "ok") {
      router.push(`/adm/pmocs/${(r.dados as { id: string }).id}?aviso=criado`);
      return;
    }
    setEnviando(false);
    setErro(
      r.tipo === "conflito"
        ? "Este registro foi alterado por outra pessoa. Recarregue a página."
        : r.mensagem,
    );
  }

  return (
    <div className="secao">
      {erro && (
        <div className="alerta erro" role="status">
          {erro}
        </div>
      )}
      {perguntando ? (
        <div className="confirmacao" role="dialog" aria-labelledby="copiar-pmoc">
          <p id="copiar-pmoc">Copiar plano e periodicidades do PMOC anterior?</p>
          <p className="dica">A cópia nunca traz ocorrências, registros, visitas ou assinaturas.</p>
          <div className="linha">
            <button
              type="button"
              className="botao"
              disabled={!pronto || enviando}
              onClick={() => criar(true)}
            >
              Copiar do anterior
            </button>
            <button
              type="button"
              className="botao secundario"
              disabled={!pronto || enviando}
              onClick={() => criar(false)}
            >
              Usar a biblioteca
            </button>
            <button
              type="button"
              className="botao secundario"
              disabled={enviando}
              onClick={() => setPerguntando(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="botao"
          style={{ width: "auto" }}
          disabled={!pronto || enviando}
          onClick={() => (anteriorTemPmoc ? setPerguntando(true) : criar(false))}
        >
          {enviando ? "Criando…" : "Criar PMOC"}
        </button>
      )}
    </div>
  );
}
