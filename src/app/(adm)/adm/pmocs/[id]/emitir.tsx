"use client";
import { FileSignature } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/description-list";
import { Dialog } from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import type { DestinoPendencia, VerificacaoEmissao } from "@/modules/pmoc";
import { verificarEmissaoAction } from "../actions";

type Estado =
  | { tipo: "VERIFICANDO" }
  | { tipo: "ERRO"; mensagem: string }
  | { tipo: "VERIFICADO"; v: VerificacaoEmissao };

/**
 * TL-121 – Emitir PMOC (FL-08 passo 7). Abre em `VERIFICANDO`, confere as pré-condições no servidor
 * (RN-007, RN-008, RN-017) e mostra `PENDENCIAS` (todas, com link para corrigir; E-08.3 a E-08.5) ou
 * `PRONTO` (resumo e aviso E-08.9). Nada é gravado aqui. A emissão em si (`PROCESSANDO`, RN-009)
 * chega na próxima entrega: o botão "Emitir" aparece desabilitado com o motivo.
 */
export function EmitirPmoc({
  pmocId,
  contratoId,
  localId,
  bloqueio,
}: {
  pmocId: string;
  contratoId: string;
  localId: string;
  /** E-08.5: motivo para o botão já vir desabilitado (contrato encerrado). */
  bloqueio: string | null;
}) {
  const pronto = useHidratado();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "VERIFICANDO" });

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
        mensagem: r.tipo === "conflito" ? "Recarregue a página e tente novamente." : r.mensagem,
      });
    }
  }

  const pendencias = estado.tipo === "VERIFICADO" ? estado.v.pendencias : [];
  const semPendencias = estado.tipo === "VERIFICADO" && pendencias.length === 0;

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
        aoFechar={() => setAberto(false)}
        largura="md"
        titulo={
          estado.tipo === "VERIFICADO" && !semPendencias
            ? "Falta completar antes de emitir"
            : "Emitir PMOC"
        }
        rodape={
          semPendencias ? (
            <>
              <Button onClick={() => setAberto(false)}>Cancelar</Button>
              <Button
                variant="primary"
                disabled
                title="A emissão do PMOC ainda não está disponível."
              >
                Emitir
              </Button>
            </>
          ) : (
            <Button onClick={() => setAberto(false)}>Fechar</Button>
          )
        }
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
            <Alert tom="info">
              Depois de emitido, o PDF assinado pelo RT não muda. A emissão do PMOC ainda não está
              disponível.
            </Alert>
          </>
        )}
      </Dialog>
    </div>
  );
}
