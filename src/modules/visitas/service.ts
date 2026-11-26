import "server-only";
import type { Tx } from "@/server/db";
import type { AcompanhamentoDasVisitas, VisitaDoPmoc } from "./domain/recalculo";
import * as repo from "./repo";

/**
 * Visitas no recálculo do cronograma (RN-065, RN-066, RN-102). Sem conferência de permissão: quem
 * chama (módulo `pmoc`) já conferiu e abriu a transação.
 */

export function visitasNaoIniciadasNaTransacao(tx: Tx, pmocId: string): Promise<VisitaDoPmoc[]> {
  return repo.visitasNaoIniciadas(tx, pmocId);
}

export interface ResultadoAcompanhamento {
  criadas: number;
  excluidas: number;
  canceladas: number;
  notificados: number;
}

/**
 * Grava o acompanhamento e notifica o cancelamento das visitas `AGENDADA` esvaziadas (RN-102). As
 * chaves das ocorrências que entram são os ids gravados.
 */
export async function gravarAcompanhamentoNaTransacao(
  tx: Tx,
  entrada: { pmocId: string; localId: string },
  a: AcompanhamentoDasVisitas,
  agora: Date,
): Promise<ResultadoAcompanhamento> {
  const r = await repo.gravarAcompanhamento(tx, entrada.pmocId, entrada.localId, a, agora);
  const notificados = await repo.notificarCancelamento(tx, r.canceladas);
  return {
    criadas: r.criadas,
    excluidas: r.excluidas,
    canceladas: r.canceladas.length,
    notificados,
  };
}
