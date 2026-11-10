/** Regras puras do contrato (RF-07; doc 02 §7.2). Datas de negócio em `YYYY-MM-DD` (sem fuso). */

export type EstadoContrato = "A_INICIAR" | "VIGENTE" | "ENCERRADO" | "CANCELADO";

/** Formato da data de negócio que vem da tela e do banco. */
export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Data válida no calendário (rejeita 2026-02-30). */
export function dataValida(d: string): boolean {
  if (!DATA_ISO.test(d)) return false;
  const [a, m, dia] = d.split("-").map(Number) as [number, number, number];
  const x = new Date(Date.UTC(a, m - 1, dia));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === dia;
}

/** "Hoje" no fuso de negócio (America/Sao_Paulo), a partir do instante recebido (MOD-06). */
export function hojeEmSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** RN-142: estado derivado das datas (`CANCELADO` não sai daqui: prevalece e é gravado à parte). */
export function estadoPorDatas(
  inicio: string,
  fim: string,
  hoje: string,
): Exclude<EstadoContrato, "CANCELADO"> {
  if (hoje < inicio) return "A_INICIAR";
  if (hoje > fim) return "ENCERRADO";
  return "VIGENTE";
}

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
