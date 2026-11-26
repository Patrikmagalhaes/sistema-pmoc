import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import type { AcompanhamentoDasVisitas, VisitaDoPmoc } from "./domain/recalculo";

/** MOD-03: único arquivo do módulo `visitas` que fala com o banco. Sempre dentro de `withTransaction`. */

/**
 * Visitas vivas não iniciadas do PMOC, na ordem de criação, com as linhas travadas: agendar ou
 * cancelar ao mesmo tempo espera o recálculo terminar. Só elas mudam no recálculo (RN-065, RN-066).
 */
export async function visitasNaoIniciadas(tx: Tx, pmocId: string): Promise<VisitaDoPmoc[]> {
  const r = await tx.execute(sql`SELECT v.id, v.reference_month_index AS indice, v.status AS estado,
      to_char(v.scheduled_date, 'YYYY-MM-DD') AS data,
      ARRAY(SELECT vo.occurrence_id::text FROM visit_occurrence vo
        WHERE vo.visit_id = v.id AND vo.removed_at IS NULL ORDER BY vo.occurrence_id) AS ocorrencias
    FROM visit v
    WHERE v.pmoc_id = ${pmocId} AND v.deleted_at IS NULL AND v.status IN ('A_AGENDAR', 'AGENDADA')
    ORDER BY v.created_at, v.id
    FOR UPDATE OF v`);
  return r as unknown as VisitaDoPmoc[];
}

const MOTIVO_RECALCULO = "Sem ocorrências depois do recálculo do cronograma (RN-065).";

/**
 * Grava o acompanhamento do recálculo (RN-065); a chave de cada ocorrência que entra é o id dela.
 * Devolve as visitas `AGENDADA` canceladas, para a notificação (RN-102).
 */
export async function gravarAcompanhamento(
  tx: Tx,
  pmocId: string,
  localId: string,
  a: AcompanhamentoDasVisitas,
  agora: Date,
): Promise<{ criadas: number; excluidas: number; canceladas: string[] }> {
  const em = agora.toISOString();

  if (a.retirar.length > 0) {
    const linhas = a.retirar.map((x) => ({ v: x.visitaId, o: x.ocorrenciaId }));
    await tx.execute(sql`UPDATE visit_occurrence vo
      SET removed_at = ${em}::timestamptz, removal_reason = 'RECALCULO'
      FROM jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb) AS x(v uuid, o uuid)
      WHERE vo.visit_id = x.v AND vo.occurrence_id = x.o AND vo.removed_at IS NULL`);
  }

  const vinculos = a.incluir.map((x) => ({ v: x.visitaId, o: x.chave }));
  for (const n of a.novas) {
    const r = await tx.execute(sql`INSERT INTO visit (pmoc_id, site_id, reference_month_index,
        reference_month, origin)
      VALUES (${pmocId}, ${localId}, ${n.indice}, ${n.referencia}::date, 'RECALCULO') RETURNING id`);
    const visitaId = (r[0] as { id: string }).id;
    for (const c of n.chaves) vinculos.push({ v: visitaId, o: c });
  }
  if (vinculos.length > 0) {
    await tx.execute(sql`INSERT INTO visit_occurrence (visit_id, occurrence_id)
      SELECT x.v, x.o FROM jsonb_to_recordset(${JSON.stringify(vinculos)}::jsonb) AS x(v uuid, o uuid)`);
  }

  if (a.excluir.length > 0) {
    await tx.execute(sql`UPDATE visit SET deleted_at = ${em}::timestamptz,
        deletion_reason = ${MOTIVO_RECALCULO}
      WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(a.excluir)}::jsonb)::uuid)
        AND status = 'A_AGENDAR' AND deleted_at IS NULL`);
  }
  const canceladas: string[] = [];
  if (a.cancelar.length > 0) {
    const r = await tx.execute(sql`UPDATE visit SET status = 'CANCELADA',
        cancelled_at = ${em}::timestamptz, cancellation_reason = ${MOTIVO_RECALCULO}
      WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(a.cancelar.map((c) => c.visitaId))}::jsonb)::uuid)
        AND status = 'AGENDADA'
      RETURNING id`);
    canceladas.push(...(r as unknown as { id: string }[]).map((x) => x.id));
  }
  return { criadas: a.novas.length, excluidas: a.excluir.length, canceladas };
}

/**
 * RN-102: visita cancelada → notifica o técnico atribuído e os usuários `ATIVO` do cliente (só `ATIVO`
 * recebe, RN-141). Devolve quantas notificações.
 */
export async function notificarCancelamento(tx: Tx, visitaIds: readonly string[]): Promise<number> {
  if (visitaIds.length === 0) return 0;
  const r =
    await tx.execute(sql`INSERT INTO notification (recipient_user_id, event_type, title, body,
      entity_type, entity_id, payload)
    SELECT u.id, 'VISITA_CANCELADA', 'Visita cancelada',
      'A visita de ' || s.name || ' marcada para ' || to_char(v.scheduled_date, 'DD/MM/YYYY')
        || ' foi cancelada.',
      'visit', v.id, jsonb_build_object('data', to_char(v.scheduled_date, 'YYYY-MM-DD'))
    FROM visit v
    JOIN site s ON s.id = v.site_id
    JOIN app_user u ON u.status = 'ATIVO' AND (
      u.id = v.technician_user_id OR (u.role = 'CLIENTE' AND u.client_id = v.client_id))
    WHERE v.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(visitaIds)}::jsonb)::uuid)`);
  // Sem RETURNING: a RLS de `notification` só deixa o destinatário ler a linha (05 §4.2).
  return (r as unknown as { count: number }).count;
}
