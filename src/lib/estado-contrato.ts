/**
 * Estado do contrato (RN-142, RN-144). Regra pura, compartilhada por `clientes` (dono do contrato) e
 * `pmoc` (RN-017), que não podem importar um ao outro nos dois sentidos (MOD-02). Datas de negócio em
 * `YYYY-MM-DD`, "hoje" no fuso de São Paulo (`hojeEmSaoPaulo`).
 */

export type EstadoContrato = "A_INICIAR" | "VIGENTE" | "ENCERRADO" | "CANCELADO";

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

/**
 * Estado para decidir agora. O gravado em `contract.status` é recalculado pelo processamento diário
 * (RN-142, J-02) e pode estar um dia atrás, ou mais se o job falhar; por isso valem as datas, e só o
 * `CANCELADO` gravado prevalece (RN-144).
 */
export function estadoDoContrato(
  gravado: EstadoContrato,
  inicio: string,
  fim: string,
  hoje: string,
): EstadoContrato {
  return gravado === "CANCELADO" ? "CANCELADO" : estadoPorDatas(inicio, fim, hoje);
}
