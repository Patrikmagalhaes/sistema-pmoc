import type { CertificadoExibido } from "@/modules/empresa";

/** 04 §1.5: `VALIDO` → "Válido"; `A_VENCER` → "Vence em {n} dias"; `VENCIDO` → "Vencido". */
export function rotuloCertificado(c: Pick<CertificadoExibido, "estado" | "diasParaVencer">) {
  if (c.estado === "VALIDO") return "Válido";
  if (c.estado === "VENCIDO") return "Vencido";
  return c.diasParaVencer === 1 ? "Vence em 1 dia" : `Vence em ${c.diasParaVencer} dias`;
}

export const classeCertificado = (estado: CertificadoExibido["estado"]) =>
  estado === "VALIDO" ? "ok" : estado === "A_VENCER" ? "aviso" : "erro";

/** Etiqueta do estado derivado (RN-153). */
export function EstadoCertificado({ c }: { c: CertificadoExibido }) {
  return <span className={`etiqueta ${classeCertificado(c.estado)}`}>{rotuloCertificado(c)}</span>;
}
