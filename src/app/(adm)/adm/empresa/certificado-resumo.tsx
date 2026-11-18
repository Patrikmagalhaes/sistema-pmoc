import { StatusBadge } from "@/components/status-badge";
import type { CertificadoExibido } from "@/modules/empresa";

/** 04 §1.5: `VALIDO` → "Válido"; `A_VENCER` → "Vence em {n} dias"; `VENCIDO` → "Vencido". */
export function rotuloCertificado(c: Pick<CertificadoExibido, "estado" | "diasParaVencer">) {
  if (c.estado === "VALIDO") return "Válido";
  if (c.estado === "VENCIDO") return "Vencido";
  return c.diasParaVencer === 1 ? "Vence em 1 dia" : `Vence em ${c.diasParaVencer} dias`;
}

/** Estado derivado do certificado (RN-153) no StatusBadge (doc 08 §2.3). */
export function EstadoCertificado({ c }: { c: CertificadoExibido }) {
  return <StatusBadge tipo="certificado" valor={c.estado} n={c.diasParaVencer ?? undefined} />;
}
