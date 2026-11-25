"use client";
import { Download, FileSignature } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/description-list";
import { Dialog } from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import type { DestinoPendencia, VerificacaoEmissao } from "@/modules/pmoc";
import { emitirPmocAction, verificarEmissaoAction } from "../actions";

type Estado =
  | { tipo: "VERIFICANDO" }
  | { tipo: "VERIFICADO"; v: VerificacaoEmissao }
  | { tipo: "PROCESSANDO"; desde: number }
  | { tipo: "CONCLUIDO"; versao: number; arquivoId: string }
  | { tipo: "ERRO"; mensagem: string; podeTentar: boolean };

/** "1 min 05 s" (E-08.7: tempo decorrido enquanto o PDF é gerado e assinado). */
function decorrido(ms: number) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

function TempoDecorrido({ desde }: { desde: number }) {
  const [agora, setAgora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{decorrido(agora - desde)}</span>;
}

/**
 * TL-121 – Emitir PMOC (FL-08 passos 7–12). Abre em `VERIFICANDO`, confere as pré-condições no servidor
 * (RN-007, RN-008, RN-017) e mostra `PENDENCIAS` (todas, com link para corrigir; E-08.3 a E-08.5) ou
 * `PRONTO` (resumo e aviso E-08.9). "Emitir" (UF-09) leva a `PROCESSANDO` (E-08.7: sem fechar, com o
 * tempo decorrido), e daí a `CONCLUIDO` ou `ERRO` (E-08.6; E-08.8 recarrega a página, UF-07).
 */
export function EmitirPmoc({
  pmocId,
  rowVersion,
  contratoId,
  localId,
  bloqueio,
}: {
  pmocId: string;
  /** `pmoc.row_version` mostrado na página (UF-07). */
  rowVersion: number;
  contratoId: string;
  localId: string;
  /** E-08.5: motivo para o botão já vir desabilitado (contrato encerrado). */
  bloqueio: string | null;
}) {
  const pronto = useHidratado();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "VERIFICANDO" });
  /**
   * Depois de emitir (ou do conflito), a página recarrega ao fechar o diálogo: recarregar antes o
   * desmontaria, porque o botão só existe em `RASCUNHO`.
   */
  const [recarregar, setRecarregar] = useState(false);

  const destino: Record<DestinoPendencia, string> = {
    EMPRESA: "/adm/empresa",
    CONTRATO: `/adm/contratos/${contratoId}`,
    EQUIPAMENTOS: `/adm/locais/${localId}?aba=equipamentos`,
    PLANO: `/adm/pmocs/${pmocId}?aba=plano`,
  };

  async function verificar() {
    setEstado({ tipo: "VERIFICANDO" });
    const r = await chamarAcao(verificarEmissaoAction({ pmocId }));
    if (r.tipo === "ok") {
      const { ok: _, ...v } = r.dados;
      setEstado({ tipo: "VERIFICADO", v });
    } else {
      setEstado({
        tipo: "ERRO",
        podeTentar: false,
        mensagem: r.tipo === "conflito" ? "Recarregue a página e tente novamente." : r.mensagem,
      });
    }
  }

  async function emitir() {
    setEstado({ tipo: "PROCESSANDO", desde: Date.now() });
    const r = await chamarAcao(emitirPmocAction({ pmocId, rowVersion }));
    if (r.tipo === "ok") {
      setEstado({ tipo: "CONCLUIDO", versao: r.dados.versao, arquivoId: r.dados.arquivoId });
      setRecarregar(true);
      return;
    }
    if (r.tipo === "conflito") {
      // E-08.8 / UF-07: outra pessoa emitiu ou mudou o PMOC; a página mostra o estado atual.
      setEstado({
        tipo: "ERRO",
        podeTentar: false,
        mensagem:
          "Este PMOC foi alterado ou está sendo emitido por outra pessoa. Feche para ver o estado atual.",
      });
      setRecarregar(true);
      return;
    }
    // Faltou algo entre a verificação e a emissão: mostra a lista de novo.
    if (r.falha?.codigo === "PENDENCIAS") {
      await verificar();
      return;
    }
    setEstado({ tipo: "ERRO", podeTentar: true, mensagem: r.mensagem });
  }

  const pendencias = estado.tipo === "VERIFICADO" ? estado.v.pendencias : [];
  const semPendencias = estado.tipo === "VERIFICADO" && pendencias.length === 0;
  const processando = estado.tipo === "PROCESSANDO";
  const fechar = () => {
    setAberto(false);
    if (recarregar) router.refresh();
  };

  const rodape = (() => {
    if (processando) return null;
    if (semPendencias) {
      return (
        <>
          <Button onClick={fechar}>Cancelar</Button>
          <Button variant="primary" onClick={() => void emitir()}>
            Emitir
          </Button>
        </>
      );
    }
    if (estado.tipo === "CONCLUIDO") {
      // "Ir para agenda" chega com a TL-130 (Etapa 5).
      return (
        <>
          <Button onClick={fechar}>Fechar</Button>
          <a
            href={`/api/arquivos/${estado.arquivoId}`}
            target="_blank"
            rel="noopener"
            className={buttonClasses({ variant: "primary" })}
          >
            <Download size={20} aria-hidden="true" />
            Baixar PDF
          </a>
        </>
      );
    }
    if (estado.tipo === "ERRO" && estado.podeTentar) {
      return (
        <>
          <Button onClick={fechar}>Fechar</Button>
          <Button variant="primary" onClick={() => void verificar()}>
            Tentar novamente
          </Button>
        </>
      );
    }
    return <Button onClick={fechar}>Fechar</Button>;
  })();

  const titulo =
    estado.tipo === "VERIFICADO" && !semPendencias
      ? "Falta completar antes de emitir"
      : estado.tipo === "CONCLUIDO"
        ? "PMOC emitido"
        : "Emitir PMOC";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        variant="primary"
        icon={<FileSignature size={20} aria-hidden="true" />}
        disabled={!pronto || Boolean(bloqueio)}
        title={bloqueio ?? undefined}
        onClick={() => {
          setAberto(true);
          void verificar();
        }}
      >
        Emitir PMOC
      </Button>
      {bloqueio && <p className="max-w-prose text-small text-text-muted">{bloqueio}</p>}
      <Dialog
        aberto={aberto}
        aoFechar={fechar}
        travado={processando}
        largura="md"
        titulo={titulo}
        rodape={rodape}
      >
        {estado.tipo === "VERIFICANDO" && (
          <p className="text-text-muted" role="status">
            Verificando dados…
          </p>
        )}
        {estado.tipo === "ERRO" && <Alert tom="danger">{estado.mensagem}</Alert>}
        {estado.tipo === "VERIFICADO" && !semPendencias && (
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {pendencias.map((p) => (
              <li key={p.codigo}>
                <Link href={destino[p.destino]}>{p.mensagem}</Link>
              </li>
            ))}
          </ul>
        )}
        {estado.tipo === "VERIFICADO" && semPendencias && (
          <>
            {estado.v.certificadoVenceEmDias !== null && (
              <Alert tom="warning">
                Certificado do RT vence em {estado.v.certificadoVenceEmDias}{" "}
                {estado.v.certificadoVenceEmDias === 1 ? "dia" : "dias"}.
              </Alert>
            )}
            <DescriptionList
              itens={[
                { rotulo: "Equipamentos", valor: estado.v.resumo.equipamentos },
                { rotulo: "Atividades no plano", valor: estado.v.resumo.atividades },
                { rotulo: "Ocorrências previstas", valor: estado.v.resumo.ocorrencias },
                { rotulo: "Visitas a criar", valor: estado.v.resumo.visitas },
              ]}
            />
            <Alert tom="info">Após emitir, o PDF é assinado pelo RT e não pode ser alterado.</Alert>
          </>
        )}
        {processando && (
          <div role="status" className="flex flex-col gap-2">
            <p>Gerando e assinando o PDF… isto pode levar alguns minutos. Não feche esta janela.</p>
            <p className="text-small text-text-muted">
              Tempo decorrido: <TempoDecorrido desde={estado.desde} />
            </p>
          </div>
        )}
        {estado.tipo === "CONCLUIDO" && (
          <Alert tom="success">
            PMOC emitido – versão {estado.versao}. As visitas do cronograma foram criadas para
            agendar, e os usuários do cliente foram avisados.
          </Alert>
        )}
      </Dialog>
    </div>
  );
}
