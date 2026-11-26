import "server-only";
import type { Tx } from "@/server/db";
import type { OcorrenciaExistente, Recalculo } from "./domain/cronograma";
import * as repo from "./repo";

/**
 * Leitura e gravação das ocorrências para o recálculo depois da emissão (RN-032, RN-067, RN-068,
 * RN-183, RN-184). Sem conferência de permissão: quem chama (módulo `pmoc`) já conferiu e abriu a
 * transação.
 */

export type { OcorrenciaGravada } from "./repo";

export function ocorrenciasDoPmocNaTransacao(
  tx: Tx,
  pmocId: string,
): Promise<OcorrenciaExistente[]> {
  return repo.ocorrenciasDoPmoc(tx, pmocId);
}

export function gravarRecalculoNaTransacao(
  tx: Tx,
  pmocId: string,
  r: Recalculo,
  agora: Date,
): ReturnType<typeof repo.gravarRecalculo> {
  return repo.gravarRecalculo(tx, pmocId, r, agora);
}
