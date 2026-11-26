"use client";
import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import type { Desfecho } from "@/lib/chamar-acao";
import { formatarDataIso } from "@/lib/formato";
import type { ImpactoDoRecalculo, ResultadoRecalculo } from "@/modules/pmoc";

type Falha = { ok: false; codigo: string; mensagem: string };
export type RespostaDaPrevia = Desfecho<{ ok: true; impacto: ImpactoDoRecalculo | null } | Falha>;

export const CONFLITO = "Este registro foi alterado por outra pessoa. Recarregue a página.";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** `YYYY-MM` → `MM/AAAA`. */
const mesAno = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

/** Aviso depois de gravar (toast): o que o recálculo mudou. `null` sem PMOC emitido. */
export function resumoDoRecalculo(r: ResultadoRecalculo | null | undefined): string | null {
  if (!r) return null;
  const partes = [
    `${plural(r.ocorrenciasNovas, "ocorrência entrou", "ocorrências entraram")}, ${r.ocorrenciasRetiradas} ${
      r.ocorrenciasRetiradas === 1 ? "saiu" : "saíram"
    }`,
  ];
  if (r.visitasCanceladas > 0) {
    partes.push(plural(r.visitasCanceladas, "visita cancelada", "visitas canceladas"));
  }
  return `Cronograma recalculado: ${partes.join("; ")}.`;
}

interface Pedido {
  titulo: string;
  confirmar: { rotulo: string; carregando: string };
  impacto: ImpactoDoRecalculo;
  /** Grava com o motivo; devolve a mensagem de erro (o diálogo fica aberto) ou `null` (fecha). */
  gravar(motivo: string | null): Promise<string | null>;
  aoVoltar?: () => void;
}

/**
 * FL-09 passos 1–3: com PMOC emitido, toda mudança no plano mostra antes o impacto (RN-032; E-07.7,
 * E-09.2) e pede motivo opcional (UF-10, CA-10.2); em `RASCUNHO` a prévia volta vazia e a mudança vale
 * na hora (RN-006). `pedir` devolve a mensagem de erro da prévia (ex.: bloqueio da RN-183) ou `null`.
 * `dialogo` vai num lugar válido para `<dialog>` (não direto num `<tr>`).
 */
export function useMudancaComImpacto(motivoMax: number): {
  pedir(p: Omit<Pedido, "impacto"> & { previa: Promise<RespostaDaPrevia> }): Promise<string | null>;
  ocupado: boolean;
  dialogo: ReactNode;
} {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pedir(p: Omit<Pedido, "impacto"> & { previa: Promise<RespostaDaPrevia> }) {
    setConsultando(true);
    const r = await p.previa;
    setConsultando(false);
    if (r.tipo === "conflito") return CONFLITO;
    if (r.tipo === "erro") return r.mensagem;
    if (!r.dados.impacto) return p.gravar(null);
    setErro(null);
    setPedido({ ...p, impacto: r.dados.impacto });
    return null;
  }

  function voltar() {
    pedido?.aoVoltar?.();
    setPedido(null);
  }

  async function confirmar(dados: FormData) {
    if (!pedido) return;
    setEnviando(true);
    setErro(null);
    const motivo = String(dados.get("motivo") ?? "").trim();
    const e = await pedido.gravar(motivo || null);
    setEnviando(false);
    if (e) setErro(e);
    else setPedido(null);
  }

  const dialogo = (
    <Dialog
      aberto={pedido !== null}
      aoFechar={voltar}
      travado={enviando}
      largura="md"
      titulo={pedido?.titulo ?? ""}
      icone={<Info size={24} className="mt-0.5 shrink-0 text-info-solid" aria-hidden="true" />}
      onSubmit={(ev) => confirmar(new FormData(ev.currentTarget))}
      rodape={
        <>
          <Button autoFocus disabled={enviando} onClick={voltar}>
            Voltar
          </Button>
          <Button type="submit" variant="primary" loading={enviando}>
            {enviando ? pedido?.confirmar.carregando : pedido?.confirmar.rotulo}
          </Button>
        </>
      }
    >
      {erro && <Alert tom="danger">{erro}</Alert>}
      {pedido && <Impacto impacto={pedido.impacto} />}
      <Field id="motivo-mudanca-plano" label="Motivo" opcional>
        <Textarea name="motivo" rows={2} maxLength={motivoMax} />
      </Field>
    </Dialog>
  );

  return { pedir, ocupado: consultando || enviando, dialogo };
}

/** Corpo do diálogo de impacto (textos de FL-09 passo 2, E-07.7 e E-09.2). */
function Impacto({ impacto: i }: { impacto: ImpactoDoRecalculo }) {
  const visitas: string[] = [
    ...i.visitasCanceladas.map(
      (v) => `A visita de ${formatarDataIso(v.data)} ficará sem itens e será cancelada.`,
    ),
  ];
  if (i.visitasExcluidas > 0) {
    visitas.push(
      i.visitasExcluidas === 1
        ? "1 visita a agendar ficará sem itens e será excluída."
        : `${i.visitasExcluidas} visitas a agendar ficarão sem itens e serão excluídas.`,
    );
  }
  if (i.visitasCriadas > 0) {
    visitas.push(
      i.visitasCriadas === 1
        ? "1 visita a agendar será criada para as ocorrências novas."
        : `${i.visitasCriadas} visitas a agendar serão criadas para as ocorrências novas.`,
    );
  }
  for (const v of i.visitasNaoAlteradas) {
    visitas.push(
      `Não alterada: visita de ${formatarDataIso(v.data)} (${
        v.estado === "EM_ANDAMENTO" ? "em andamento" : "registrada"
      }).`,
    );
  }
  return (
    <div className="flex max-w-prose flex-col gap-3 text-text">
      <p>
        Recalcula só meses após {mesAno(i.mesCorrente)}:{" "}
        {plural(i.ocorrenciasNovas, "ocorrência entra", "ocorrências entram")},{" "}
        {i.ocorrenciasRetiradas} {i.ocorrenciasRetiradas === 1 ? "sai" : "saem"}. Registros OK/NOK e
        pendências não mudam.
      </p>
      {visitas.length > 0 && (
        <ul className="list-disc pl-5">
          {visitas.map((t, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, duas visitas podem ter o mesmo texto.
            <li key={n}>{t}</li>
          ))}
        </ul>
      )}
      <p className="text-small text-text-muted">O PDF assinado não muda.</p>
    </div>
  );
}
