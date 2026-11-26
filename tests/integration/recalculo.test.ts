/**
 * Etapa 4 – recálculo do cronograma depois da emissão (RN-015, RN-032, RN-065 a RN-068, RN-102,
 * RN-183, RN-184; E-07.7) e triggers da migração 0016 (02 §7.4 e §7.5; 03 `visit` [L]). Banco próprio,
 * com PMOC emitido de verdade. As mudanças de plano e de equipamento são feitas direto no banco: as
 * telas que as fazem entram nos passos seguintes; aqui o alvo é o recálculo.
 *
 * Contrato de 2026-11-01 a 2027-10-31 e hoje 2026-11-18: mês corrente = 1, recálculo a partir do 2.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type HipoteseDeRecalculo,
  impactoDoRecalculoNaTransacao,
  recalcularCronogramaNaTransacao,
} from "../../src/modules/pmoc";
import { type AmbienteDeEmissao, prepararEmissao } from "./fixture-emissao";
import { admCtx, failureText } from "./helpers";

const AGORA = new Date("2026-11-18T15:00:00Z");

let amb: AmbienteDeEmissao;
let tipoMt: { id: string; grupoId: string };
let tipoMmMt: { id: string; grupoId: string };

beforeAll(async () => {
  amb = await prepararEmissao("pmoc_recalculo", AGORA);
  tipoMt = await amb.novoTipo("RCT", ["MT"]); // meses 1, 4, 7, 10
  tipoMmMt = await amb.novoTipo("RCM", ["MM", "MT"]);
}, 180_000);

afterAll(async () => {
  await amb.encerrar();
});

const recalcular = (pmocId: string) =>
  amb.db.withTransaction(admCtx(), (tx) => recalcularCronogramaNaTransacao(tx, pmocId, AGORA));
const impacto = (pmocId: string, h: HipoteseDeRecalculo) =>
  amb.db.withTransaction(admCtx(), (tx) => impactoDoRecalculoNaTransacao(tx, pmocId, h, AGORA));

/** Células do PMOC: `mês:estado[:motivo]` por equipamento, em ordem. */
async function celulas(pmocId: string, equipamentoId?: string) {
  const r = await amb.owner`SELECT o.month_index AS m, o.status AS s, o.unscheduled_reason AS u
    FROM occurrence o WHERE o.pmoc_id = ${pmocId}
      AND (${equipamentoId ?? null}::uuid IS NULL OR o.equipment_id = ${equipamentoId ?? null}::uuid)
    ORDER BY o.pmoc_activity_id, o.equipment_id, o.month_index`;
  return r.map((x) => [x.m, x.s, x.u].filter(Boolean).join(":"));
}

/** Visitas do PMOC: mês, estado, origem, se foi excluída e quantos vínculos ativos. */
async function visitas(pmocId: string) {
  return amb.owner`SELECT v.id, v.reference_month_index AS mes, v.status, v.origin,
      v.deleted_at IS NOT NULL AS excluida, v.cancelled_by_user_id AS "canceladaPor",
      (SELECT count(*)::int FROM visit_occurrence vo
        WHERE vo.visit_id = v.id AND vo.removed_at IS NULL) AS itens
    FROM visit v WHERE v.pmoc_id = ${pmocId} ORDER BY v.reference_month_index, v.created_at`;
}

const visitaDoMes = async (pmocId: string, mes: number) =>
  (await visitas(pmocId)).find((v) => v.mes === mes && !v.excluida && v.status !== "CANCELADA");

async function agendar(visitaId: string, tecnicoId: string, data: string) {
  await amb.comoSistema(
    (tx) => tx`UPDATE visit SET status = 'AGENDADA', scheduled_date = ${data},
      technician_user_id = ${tecnicoId} WHERE id = ${visitaId}`,
  );
}

const periodicidade = (pmocId: string, p: string) =>
  amb.comoSistema(
    (tx) => tx`UPDATE pmoc_activity SET periodicity = ${p} WHERE pmoc_id = ${pmocId}`,
  );

describe("RN-032 e RN-065: mudança de periodicidade depois da emissão", () => {
  it("MT → MS: prévia sem gravar, Ø nos meses que saíram, A_AGENDAR excluída, AGENDADA cancelada e notificada", async () => {
    const c = await amb.cenario([tipoMt, tipoMt]);
    const tecnico = await amb.usuario("TECNICO");
    await amb.usuario("CLIENTE", c.clienteId);
    await amb.usuario("CLIENTE", c.clienteId);
    await amb.emitir(c.pmocId);
    const v10 = await visitaDoMes(c.pmocId, 10);
    await agendar(v10?.id, tecnico, "2027-08-10");
    const antes = await celulas(c.pmocId);

    // E-07.7: a prévia mostra o impacto e não grava nada.
    const previa = await impacto(c.pmocId, {
      plano: (p) => p.map((a) => ({ ...a, periodicidade: "MS" })),
    });
    expect(previa).toEqual({
      aPartirDoMes: 2,
      ocorrenciasNovas: 0,
      ocorrenciasRetiradas: 4,
      visitasCriadas: 0,
      visitasExcluidas: 1,
      visitasCanceladas: [{ data: "2027-08-10" }],
    });
    expect(await celulas(c.pmocId)).toEqual(antes);

    await periodicidade(c.pmocId, "MS");
    const r = await recalcular(c.pmocId);
    expect(r).toEqual({
      aPartirDoMes: 2,
      ocorrenciasNovas: 0,
      ocorrenciasRetiradas: 4,
      visitasCriadas: 0,
      visitasExcluidas: 1,
      visitasCanceladas: 1,
      notificados: 3, // técnico atribuído + 2 usuários ATIVO do cliente (RN-102)
    });

    // RN-032: meses 4 e 10 viram Ø; o mês 1 (corrente) e o 7 (continua previsto) ficam.
    const um = await celulas(c.pmocId, c.equipamentos[0]);
    expect(um).toEqual([
      "1:PREVISTA",
      "4:NAO_PREVISTA:RECALCULO_PERIODICIDADE",
      "7:PREVISTA",
      "10:NAO_PREVISTA:RECALCULO_PERIODICIDADE",
    ]);
    const vs = await visitas(c.pmocId);
    expect(vs.find((v) => v.mes === 4)).toMatchObject({
      status: "A_AGENDAR",
      excluida: true,
      itens: 0,
    });
    expect(vs.find((v) => v.mes === 10)).toMatchObject({
      status: "CANCELADA",
      excluida: false,
      canceladaPor: null, // cancelamento automático (03 `visit`)
      itens: 0,
    });
    expect(vs.find((v) => v.mes === 7)).toMatchObject({ status: "A_AGENDAR", itens: 2 });
    const [n] = await amb.owner`SELECT count(*)::int AS n, min(body) AS corpo FROM notification
      WHERE event_type = 'VISITA_CANCELADA' AND entity_id = ${v10?.id}`;
    expect(n?.n).toBe(3);
    expect(n?.corpo).toBe("A visita de Unidade marcada para 10/08/2027 foi cancelada.");
    const [vinculos] = await amb.owner`SELECT count(*)::int AS n FROM visit_occurrence vo
      JOIN visit v ON v.id = vo.visit_id
      WHERE v.pmoc_id = ${c.pmocId} AND vo.removal_reason = 'RECALCULO'`;
    expect(vinculos?.n).toBe(4);

    // RN-184: voltar para MT reaproveita as linhas Ø e cria visitas RECALCULO nos meses sem visita aberta.
    await periodicidade(c.pmocId, "MT");
    const volta = await recalcular(c.pmocId);
    expect(volta).toMatchObject({
      ocorrenciasNovas: 4,
      ocorrenciasRetiradas: 0,
      visitasCriadas: 2,
    });
    expect(await celulas(c.pmocId, c.equipamentos[0])).toEqual([
      "1:PREVISTA",
      "4:PREVISTA",
      "7:PREVISTA",
      "10:PREVISTA",
    ]);
    const [linhas] =
      await amb.owner`SELECT count(*)::int AS n FROM occurrence WHERE pmoc_id = ${c.pmocId}`;
    expect(linhas?.n).toBe(8);
    const novas = (await visitas(c.pmocId)).filter((v) => v.origin === "RECALCULO");
    expect(novas.map((v) => [v.mes, v.status, v.itens])).toEqual([
      [4, "A_AGENDAR", 2],
      [10, "A_AGENDAR", 2],
    ]);
  }, 60_000);

  it("MT → MB: células novas entram na visita aberta do mês ou numa visita nova", async () => {
    const c = await amb.cenario([tipoMmMt]);
    await amb.emitir(c.pmocId);
    await amb.comoSistema(
      (tx) => tx`UPDATE pmoc_activity SET periodicity = 'MB'
        WHERE pmoc_id = ${c.pmocId} AND periodicity = 'MT'`,
    );
    const r = await recalcular(c.pmocId);
    // MB: 1, 3, 5, 7, 9, 11. Novos 3, 5, 9, 11; saem 4 e 10; 7 fica.
    expect(r).toMatchObject({ ocorrenciasNovas: 4, ocorrenciasRetiradas: 2, visitasCriadas: 0 });
    const vs = await visitas(c.pmocId);
    // Toda visita mensal (MM) continua; os meses 3, 5, 9 e 11 ganham a MB.
    expect(vs.map((v) => [v.mes, v.itens])).toEqual([
      [1, 2],
      [2, 1],
      [3, 2],
      [4, 1],
      [5, 2],
      [6, 1],
      [7, 2],
      [8, 1],
      [9, 2],
      [10, 1],
      [11, 2],
      [12, 1],
    ]);
  }, 60_000);
});

describe("RN-183: atividade removida do plano emitido", () => {
  it("futuras viram Ø com ATIVIDADE_REMOVIDA_DO_PLANO; o mês corrente fica", async () => {
    const c = await amb.cenario([tipoMt]);
    await amb.emitir(c.pmocId);
    await amb.comoSistema(
      (tx) => tx`UPDATE pmoc_activity SET removed_at = now() WHERE pmoc_id = ${c.pmocId}`,
    );
    const r = await recalcular(c.pmocId);
    expect(r).toMatchObject({ ocorrenciasRetiradas: 3, visitasExcluidas: 3 });
    expect(await celulas(c.pmocId)).toEqual([
      "1:PREVISTA",
      "4:NAO_PREVISTA:ATIVIDADE_REMOVIDA_DO_PLANO",
      "7:NAO_PREVISTA:ATIVIDADE_REMOVIDA_DO_PLANO",
      "10:NAO_PREVISTA:ATIVIDADE_REMOVIDA_DO_PLANO",
    ]);
  }, 60_000);
});

describe("RN-068, RN-066 e RN-184: equipamento inativado e reativado", () => {
  it("inativado: futuras dele viram Ø, menos a da visita em andamento; reativado: voltam às visitas abertas", async () => {
    const c = await amb.cenario([tipoMt, tipoMt]);
    const tecnico = await amb.usuario("TECNICO");
    await amb.emitir(c.pmocId);
    const [, dois] = c.equipamentos as [string, string];
    const v4 = await visitaDoMes(c.pmocId, 4);
    await agendar(v4?.id, tecnico, "2027-02-10");
    await amb.comoSistema(
      (tx) => tx`UPDATE visit SET status = 'EM_ANDAMENTO' WHERE id = ${v4?.id}`,
    );

    const situacao = (s: "ATIVO" | "INATIVO") =>
      amb.comoSistema(
        (tx) => tx`UPDATE equipment SET status = ${s},
          inactivated_at = ${s === "INATIVO" ? AGORA.toISOString() : null} WHERE id = ${dois}`,
      );
    await situacao("INATIVO");
    const r = await recalcular(c.pmocId);
    expect(r).toMatchObject({ ocorrenciasRetiradas: 2, visitasExcluidas: 0, visitasCanceladas: 0 });
    expect(await celulas(c.pmocId, dois)).toEqual([
      "1:PREVISTA",
      "4:PREVISTA", // RN-066: está em visita EM_ANDAMENTO
      "7:NAO_PREVISTA:EQUIPAMENTO_INATIVADO",
      "10:NAO_PREVISTA:EQUIPAMENTO_INATIVADO",
    ]);
    expect((await visitas(c.pmocId)).map((v) => [v.mes, v.itens])).toEqual([
      [1, 2],
      [4, 2],
      [7, 1],
      [10, 1],
    ]);

    await situacao("ATIVO");
    const volta = await recalcular(c.pmocId);
    expect(volta).toMatchObject({ ocorrenciasNovas: 2, visitasCriadas: 0 });
    expect((await visitas(c.pmocId)).map((v) => [v.mes, v.itens])).toEqual([
      [1, 2],
      [4, 2],
      [7, 2],
      [10, 2],
    ]);
  }, 60_000);
});

describe("recalcularCronogramaNaTransacao: quando não recalcula", () => {
  it("PMOC em RASCUNHO ou HISTORICO → null, sem tocar o banco (RN-146)", async () => {
    const c = await amb.cenario([tipoMt]);
    expect(await recalcular(c.pmocId)).toBeNull();
    await amb.emitir(c.pmocId);
    await amb.comoSistema(
      (tx) =>
        tx`UPDATE pmoc SET status = 'HISTORICO', historic_since = now() WHERE id = ${c.pmocId}`,
    );
    await periodicidade(c.pmocId, "MS");
    expect(await recalcular(c.pmocId)).toBeNull();
    expect(await celulas(c.pmocId)).toEqual([
      "1:PREVISTA",
      "4:PREVISTA",
      "7:PREVISTA",
      "10:PREVISTA",
    ]);
  }, 60_000);

  it("nada mudou → resultado vazio", async () => {
    const c = await amb.cenario([tipoMt]);
    await amb.emitir(c.pmocId);
    expect(await recalcular(c.pmocId)).toMatchObject({
      ocorrenciasNovas: 0,
      ocorrenciasRetiradas: 0,
    });
  }, 60_000);
});

describe("Migração 0016: transições de estado (02 §7.4, §7.5) e exclusão de visita (03 `visit` [L])", () => {
  it("ocorrência OK não volta para PREVISTA (RN-149) e NAO_PREVISTA não vai direto para OK", async () => {
    const c = await amb.cenario([tipoMt]);
    await amb.emitir(c.pmocId);
    const [o] = await amb.owner`SELECT id FROM occurrence WHERE pmoc_id = ${c.pmocId} LIMIT 1`;
    await amb.comoSistema(
      (
        tx,
      ) => tx`UPDATE occurrence SET status = 'NAO_PREVISTA', unscheduled_reason = 'RECALCULO_PERIODICIDADE',
        unscheduled_at = now() WHERE id = ${o?.id}`,
    );
    expect(
      await failureText(
        amb.comoSistema(
          (tx) => tx`UPDATE occurrence SET status = 'PENDENTE', pending_since = current_date,
            unscheduled_reason = NULL, unscheduled_at = NULL WHERE id = ${o?.id}`,
        ),
      ),
    ).toMatch(/transição de ocorrência não permitida: NAO_PREVISTA -> PENDENTE/);
  }, 60_000);

  it("visita CANCELADA não volta, e só A_AGENDAR pode ser excluída", async () => {
    const c = await amb.cenario([tipoMt]);
    const tecnico = await amb.usuario("TECNICO");
    await amb.emitir(c.pmocId);
    const [v1, v4] = (await visitas(c.pmocId)) as unknown as [{ id: string }, { id: string }];
    await amb.comoSistema(
      (tx) => tx`UPDATE visit SET status = 'CANCELADA', cancelled_at = now() WHERE id = ${v1.id}`,
    );
    expect(
      await failureText(
        amb.comoSistema((tx) => tx`UPDATE visit SET status = 'A_AGENDAR' WHERE id = ${v1.id}`),
      ),
    ).toMatch(/transição de visita não permitida: CANCELADA -> A_AGENDAR/);
    await agendar(v4.id, tecnico, "2027-02-10");
    expect(
      await failureText(
        amb.comoSistema((tx) => tx`UPDATE visit SET deleted_at = now() WHERE id = ${v4.id}`),
      ),
    ).toMatch(/só visita A_AGENDAR pode ser excluída/);
  }, 60_000);
});
