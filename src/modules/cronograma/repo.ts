import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import type { OcorrenciaExistente, Recalculo } from "./domain/cronograma";

/** MOD-03: único arquivo do módulo `cronograma` que fala com o banco. Sempre dentro de `withTransaction`. */

/**
 * Ocorrências do PMOC como o recálculo as enxerga. `emVisitaIniciada`: vínculo ativo com visita
 * `EM_ANDAMENTO` ou `REGISTRADA` (RN-066).
 */
export async function ocorrenciasDoPmoc(tx: Tx, pmocId: string): Promise<OcorrenciaExistente[]> {
  const r = await tx.execute(sql`SELECT o.id, o.pmoc_activity_id AS "atividadeId",
      o.equipment_id AS "equipamentoId", o.month_index AS indice, o.status AS estado,
      EXISTS (SELECT 1 FROM visit_occurrence vo JOIN visit v ON v.id = vo.visit_id
        WHERE vo.occurrence_id = o.id AND vo.removed_at IS NULL
          AND v.status IN ('EM_ANDAMENTO', 'REGISTRADA')) AS "emVisitaIniciada"
    FROM occurrence o WHERE o.pmoc_id = ${pmocId}
    ORDER BY o.pmoc_activity_id, o.equipment_id, o.month_index`);
  return r as unknown as OcorrenciaExistente[];
}

/** Ocorrência que passou a ser prevista, já gravada. */
export interface OcorrenciaGravada {
  id: string;
  indice: number;
  referencia: string;
}

/**
 * Grava o recálculo: insere as células novas, volta `NAO_PREVISTA` → `PREVISTA` na mesma linha
 * (RN-184) e passa `PREVISTA` → `NAO_PREVISTA` com o motivo. Os filtros de estado repetem os da regra:
 * linha que mudou entre a leitura e a escrita fica como está.
 */
export async function gravarRecalculo(
  tx: Tx,
  pmocId: string,
  r: Recalculo,
  agora: Date,
): Promise<{ entraram: OcorrenciaGravada[]; sairam: string[] }> {
  const entraram: OcorrenciaGravada[] = [];
  if (r.inserir.length > 0) {
    const linhas = r.inserir.map((o) => ({
      a: o.atividadeId,
      e: o.equipamentoId,
      m: o.indice,
      r: o.referencia,
      v: o.vencimento,
    }));
    const x = await tx.execute(sql`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id,
        month_index, reference_month, due_date, status)
      SELECT ${pmocId}, x.a, x.e, x.m, x.r, x.v, 'PREVISTA'
      FROM jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb)
        AS x(a uuid, e uuid, m smallint, r date, v date)
      RETURNING id, month_index AS indice, to_char(reference_month, 'YYYY-MM-DD') AS referencia`);
    entraram.push(...(x as unknown as OcorrenciaGravada[]));
  }
  if (r.prever.length > 0) {
    const x = await tx.execute(sql`UPDATE occurrence
      SET status = 'PREVISTA', unscheduled_reason = NULL, unscheduled_at = NULL
      WHERE pmoc_id = ${pmocId} AND status = 'NAO_PREVISTA'
        AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(r.prever)}::jsonb)::uuid)
      RETURNING id, month_index AS indice, to_char(reference_month, 'YYYY-MM-DD') AS referencia`);
    entraram.push(...(x as unknown as OcorrenciaGravada[]));
  }
  const sairam: string[] = [];
  if (r.desprever.length > 0) {
    const linhas = r.desprever.map((d) => ({ id: d.id, motivo: d.motivo }));
    const x = await tx.execute(sql`UPDATE occurrence o
      SET status = 'NAO_PREVISTA', unscheduled_reason = x.motivo, unscheduled_at = ${agora.toISOString()}::timestamptz
      FROM jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb) AS x(id uuid, motivo text)
      WHERE o.id = x.id AND o.pmoc_id = ${pmocId} AND o.status = 'PREVISTA'
      RETURNING o.id`);
    sairam.push(...(x as unknown as { id: string }[]).map((o) => o.id));
  }
  return { entraram, sairam };
}
