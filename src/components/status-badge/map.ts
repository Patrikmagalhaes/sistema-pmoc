import {
  Archive,
  Ban,
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FileClock,
  FilePen,
  type LucideIcon,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

/**
 * Tabela central de estados (doc 08 §2.3). Rótulos do doc 04 §1.5; o chamador nunca passa cor.
 * Só os enums que as telas atuais exibem; os demais (visita, ocorrência, relatório) entram com as
 * telas deles, nesta mesma tabela.
 */
export type TomEstado = "neutral" | "info" | "success" | "warning" | "danger" | "brand";
export type EntradaEstado = { rotulo: string; tom: TomEstado; icone: LucideIcon };

export const ESTADOS = {
  situacao: {
    ATIVO: { rotulo: "Ativo", tom: "success", icone: CheckCircle2 },
    INATIVO: { rotulo: "Inativo", tom: "neutral", icone: Ban },
  },
  contrato: {
    A_INICIAR: { rotulo: "A iniciar", tom: "info", icone: CalendarClock },
    VIGENTE: { rotulo: "Vigente", tom: "success", icone: CheckCircle2 },
    ENCERRADO: { rotulo: "Encerrado", tom: "neutral", icone: Archive },
    CANCELADO: { rotulo: "Cancelado", tom: "neutral", icone: Ban },
  },
  pmoc: {
    RASCUNHO: { rotulo: "Rascunho", tom: "neutral", icone: FilePen },
    EMITIDO: { rotulo: "Aguardando assinatura do cliente", tom: "warning", icone: FileClock },
    ASSINADO_CLIENTE: { rotulo: "Assinado", tom: "success", icone: FileCheck },
    HISTORICO: { rotulo: "Histórico", tom: "neutral", icone: Archive },
  },
  versaoPmoc: {
    AGUARDANDO_ASSINATURA: { rotulo: "Aguardando assinatura", tom: "warning", icone: FileClock },
    ASSINADO_CLIENTE: { rotulo: "Assinado", tom: "success", icone: FileCheck },
    SUBSTITUIDA: { rotulo: "Substituída", tom: "neutral", icone: Archive },
  },
  certificado: {
    VALIDO: { rotulo: "Válido", tom: "success", icone: ShieldCheck },
    A_VENCER: { rotulo: "Vence em {n} dias", tom: "warning", icone: ShieldAlert },
    VENCIDO: { rotulo: "Vencido", tom: "danger", icone: ShieldX },
  },
} as const satisfies Record<string, Record<string, EntradaEstado>>;

export type TipoEstado = keyof typeof ESTADOS;

export const CLASSE_TOM: Record<TomEstado, string> = {
  neutral: "border-border bg-surface-muted text-text-label",
  info: "border-info-border bg-info-bg text-info-text",
  success: "border-success-border bg-success-bg text-success-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
  danger: "border-danger-border bg-danger-bg text-danger-text",
  brand: "border-action-border bg-action-strong-bg text-action-strong-text",
};
