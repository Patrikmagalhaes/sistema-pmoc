/** Regras puras do contrato (RF-07; doc 02 §7.2). Datas de negócio em `YYYY-MM-DD` (sem fuso). */

import type { EstadoContrato } from "@/lib/estado-contrato";

export {
  type EstadoContrato,
  estadoDoContrato,
  estadoPorDatas,
} from "@/lib/estado-contrato";

/** Formato da data de negócio que vem da tela e do banco. */
export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Data válida no calendário (rejeita 2026-02-30). */
export function dataValida(d: string): boolean {
  if (!DATA_ISO.test(d)) return false;
  const [a, m, dia] = d.split("-").map(Number) as [number, number, number];
  const x = new Date(Date.UTC(a, m - 1, dia));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === dia;
}

export { hojeEmSaoPaulo } from "@/lib/hoje";

/** RN-022: `N = (anoFim − anoIni) × 12 + (mêsFim − mêsIni) + 1` (mês de início e de fim contam). */
export function mesesDoContrato(inicio: string, fim: string): number {
  const [ai, mi] = inicio.split("-").map(Number) as [number, number];
  const [af, mf] = fim.split("-").map(Number) as [number, number];
  return (af - ai) * 12 + (mf - mi) + 1;
}

/** FL-06 renovar: início sugerido = dia seguinte ao fim do contrato anterior (UI). */
export function diaSeguinte(d: string): string {
  const [a, m, dia] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, dia + 1)).toISOString().slice(0, 10);
}

/** RN-144: só `A_INICIAR` ou `VIGENTE` pode ser cancelado (decisão R2 2.6). */
export const podeCancelar = (e: EstadoContrato) => e === "A_INICIAR" || e === "VIGENTE";

/** TL-112 "Renovar": `VIGENTE` ou `ENCERRADO`, e o local ainda sem contrato posterior (RF-15). */
export const podeRenovar = (e: EstadoContrato, temPosterior: boolean) =>
  (e === "VIGENTE" || e === "ENCERRADO") && !temPosterior;
