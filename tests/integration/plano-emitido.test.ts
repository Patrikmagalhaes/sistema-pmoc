/**
 * Etapa 4 – mudança no plano de PMOC emitido pela TL-120 (FL-09 passos 1–4; RN-015, RN-026, RN-032,
 * RN-065, RN-066, RN-183, RN-184; CA-10.2; E-07.7, E-09.2). Banco próprio, com PMOC emitido de verdade.
 *
 * Contrato de 2026-11-01 a 2027-10-31 e hoje 2026-11-18: mês corrente = 1, recálculo a partir do 2.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { incluirAtividade } from "../../src/modules/biblioteca";
import {
  alterarPeriodicidade,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  obterPmoc,
  type PmocCompleto,
  previaDaMudancaNoPlano,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
} from "../../src/modules/pmoc";
import { type AmbienteDeEmissao, prepararEmissao } from "./fixture-emissao";
import { admCtx, clientCtx, technicianCtx } from "./helpers";

const AGORA = new Date("2026-11-18T15:00:00Z");

let amb: AmbienteDeEmissao;
let tipoMt: { id: string; grupoId: string };

beforeAll(async () => {
  amb = await prepararEmissao("pmoc_plano_emitido", AGORA);
  tipoMt = await amb.novoTipo("PET", ["MT"]); // meses 1, 4, 7, 10
}, 180_000);

afterAll(async () => {
  await amb.encerrar();
});

const abrir = async (pmocId: string) =>
  (await obterPmoc(admCtx(), pmocId, amb.deps)) as PmocCompleto;
const primeira = (p: PmocCompleto) =>
  p.tipos[0]?.atividades[0] as PmocCompleto["tipos"][0]["atividades"][0];

/** Células de uma atividade: `mês:estado[:motivo]`, por equipamento e mês. */
async function celulas(atividadeId: string) {
  const r = await amb.owner`SELECT o.month_index AS m, o.status AS s, o.unscheduled_reason AS u
    FROM occurrence o WHERE o.pmoc_activity_id = ${atividadeId}
    ORDER BY o.equipment_id, o.month_index`;
  return r.map((x) => [x.m, x.s, x.u].filter(Boolean).join(":"));
}

async function ultimaAuditoria(atividadeId: string) {
  const [a] = await amb.owner`SELECT old_values AS antes, new_values AS depois, reason AS motivo,
      actor_user_id AS ator
    FROM audit_log WHERE table_name = 'pmoc_activity' AND record_id = ${atividadeId}
      AND action = 'UPDATE'
    ORDER BY id DESC LIMIT 1`;
  return a;
}

async function visitaDoMes(pmocId: string, mes: number): Promise<string> {
  const [v] = await amb.owner`SELECT id FROM visit WHERE pmoc_id = ${pmocId}
    AND reference_month_index = ${mes} AND deleted_at IS NULL ORDER BY created_at LIMIT 1`;
  return v?.id as string;
}

/** Visita agendada para `data` e iniciada pelo técnico (o app do técnico chega na Etapa 6). */
async function iniciar(visitaId: string, tecnicoId: string, data: string) {
  await amb.comoSistema(async (tx) => {
    await tx`UPDATE visit SET status = 'AGENDADA', scheduled_date = ${data},
      technician_user_id = ${tecnicoId} WHERE id = ${visitaId}`;
    await tx`UPDATE visit SET status = 'EM_ANDAMENTO', started_at = now() WHERE id = ${visitaId}`;
  });
}

describe("FL-09: periodicidade com PMOC emitido", () => {
  it("prévia igual ao gravado, auditoria com motivo (CA-10.2), cronograma das ocorrências e faixa de plano alterado", async () => {
    const c = await amb.cenario([tipoMt, tipoMt]);
    await amb.emitir(c.pmocId);
    const antes = await abrir(c.pmocId);
    expect([antes.emitido, antes.podeAlterarPlano, antes.podeEmitir, antes.planoAlterado]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const a = primeira(antes);

    // Passo 2: impacto antes de salvar, sem gravar nada.
    const previa = await previaDaMudancaNoPlano(
      admCtx(),
      { acao: "PERIODICIDADE", id: a.id, periodicidade: "MS" },
      amb.deps,
      AGORA,
    );
    expect(previa).toEqual({
      aPartirDoMes: 2,
      mesCorrente: "2026-11",
      ocorrenciasNovas: 0,
      ocorrenciasRetiradas: 4, // meses 4 e 10 × 2 equipamentos
      visitasCriadas: 0,
      visitasExcluidas: 2,
      visitasCanceladas: [],
      visitasNaoAlteradas: [],
    });
    expect((await abrir(c.pmocId)).planoAlterado).toBe(false);

    // Passo 3: confirma com motivo; recálculo e visitas na mesma transação.
    const r = await alterarPeriodicidade(
      admCtx(),
      { id: a.id, rowVersion: a.rowVersion, periodicidade: "MS", motivo: "  Pedido do cliente  " },
      amb.deps,
      AGORA,
    );
    expect(r).toMatchObject({ ocorrenciasNovas: 0, ocorrenciasRetiradas: 4, visitasExcluidas: 2 });
    expect(await ultimaAuditoria(a.id)).toEqual({
      antes: { periodicity: "MT" },
      depois: { periodicity: "MS" },
      motivo: "Pedido do cliente",
      ator: admCtx().userId,
    });

    // Aba Cronograma: emitido mostra o gravado (o mês 1 ficou), não a periodicidade nova.
    const depois = await abrir(c.pmocId);
    expect(primeira(depois).previstos).toEqual([1, 7]);
    expect(depois.ocorrenciasPrevistas).toBe(4);
    // Passo 4: a faixa aparece; voltar ao que está no PDF a apaga.
    expect(depois.planoAlterado).toBe(true);

    const a2 = primeira(depois);
    await alterarPeriodicidade(
      admCtx(),
      { id: a2.id, rowVersion: a2.rowVersion, periodicidade: "MT" },
      amb.deps,
      AGORA,
    );
    const volta = await abrir(c.pmocId);
    expect(volta.planoAlterado).toBe(false);
    expect(primeira(volta).previstos).toEqual([1, 4, 7, 10]);
    expect((await ultimaAuditoria(a.id))?.motivo).toBeNull();
  }, 60_000);
});

describe("RN-183 (decisão R2 2.3 b) e E-09.2: visita em andamento", () => {
  it("remover fica bloqueado com a visita responsável; a prévia lista a visita iniciada que não muda", async () => {
    const c = await amb.cenario([tipoMt]);
    const tecnico = await amb.usuario("TECNICO");
    await amb.emitir(c.pmocId);
    const a = primeira(await abrir(c.pmocId));
    await iniciar(await visitaDoMes(c.pmocId, 1), tecnico, "2026-11-20");

    const bloqueio = {
      codigo: "ESTADO",
      message: "Há visita em andamento com esta atividade: TECNICO, 20/11/2026.",
    };
    await expect(
      previaDaMudancaNoPlano(admCtx(), { acao: "REMOVER", id: a.id }, amb.deps, AGORA),
    ).rejects.toMatchObject(bloqueio);
    await expect(
      removerAtividadeDoPlano(admCtx(), { id: a.id, rowVersion: a.rowVersion }, amb.deps, AGORA),
    ).rejects.toMatchObject(bloqueio);
    expect((await abrir(c.pmocId)).tipos[0]?.removidas).toEqual([]);

    // E-09.2: com a visita do mês 4 em andamento, a ocorrência dela fica (RN-066) e a prévia avisa.
    await iniciar(await visitaDoMes(c.pmocId, 4), tecnico, "2027-02-10");
    const previa = await previaDaMudancaNoPlano(
      admCtx(),
      { acao: "PERIODICIDADE", id: a.id, periodicidade: "MS" },
      amb.deps,
      AGORA,
    );
    expect(previa).toMatchObject({
      ocorrenciasRetiradas: 1, // só o mês 10
      visitasExcluidas: 1,
      visitasNaoAlteradas: [{ data: "2027-02-10", estado: "EM_ANDAMENTO" }],
    });
    await alterarPeriodicidade(
      admCtx(),
      { id: a.id, rowVersion: a.rowVersion, periodicidade: "MS" },
      amb.deps,
      AGORA,
    );
    expect(await celulas(a.id)).toEqual([
      "1:PREVISTA",
      "4:PREVISTA",
      "7:PREVISTA",
      "10:NAO_PREVISTA:RECALCULO_PERIODICIDADE",
    ]);
  }, 60_000);
});

describe("RF-10.3 com PMOC emitido: incluir, remover e voltar atividade", () => {
  it("atividade nova e da biblioteca entram nas visitas abertas ou em visitas novas; remover e voltar reaproveita a linha (RN-184)", async () => {
    const tipo = await amb.novoTipo("PEI", ["MT"]);
    const c = await amb.cenario([tipo]);
    await amb.emitir(c.pmocId);

    // Nova, MS (meses 1 e 7): só o 7 está no recálculo e entra na visita aberta do mês.
    const nova = {
      pmocId: c.pmocId,
      tipoId: tipo.id,
      titulo: "Inspeção visual",
      periodicidade: "MS" as const,
      natureza: "VERIFICACAO" as const,
      exigeFoto: false,
    };
    const previaNova = await previaDaMudancaNoPlano(
      admCtx(),
      { acao: "INCLUIR_NOVA", pmocId: c.pmocId, tipoId: tipo.id, periodicidade: "MS" },
      amb.deps,
      AGORA,
    );
    expect(previaNova).toMatchObject({ ocorrenciasNovas: 1, visitasCriadas: 0 });
    const incluida = await incluirAtividadeNova(admCtx(), nova, amb.deps, AGORA);
    expect(incluida.recalculo).toMatchObject({ ocorrenciasNovas: 1, visitasCriadas: 0 });
    expect(await celulas(incluida.id)).toEqual(["7:PREVISTA"]);
    expect((await abrir(c.pmocId)).planoAlterado).toBe(true);

    // Remover (sem visita em andamento) e voltar: a mesma linha Ø volta a PREVISTA.
    const linha = (await abrir(c.pmocId)).tipos[0]?.atividades.find((x) => x.id === incluida.id);
    const saiu = await removerAtividadeDoPlano(
      admCtx(),
      { id: incluida.id, rowVersion: linha?.rowVersion ?? 0, motivo: "Duplicada" },
      amb.deps,
      AGORA,
    );
    expect(saiu).toMatchObject({ ocorrenciasRetiradas: 1 });
    expect(await celulas(incluida.id)).toEqual(["7:NAO_PREVISTA:ATIVIDADE_REMOVIDA_DO_PLANO"]);
    const removida = (await abrir(c.pmocId)).tipos[0]?.removidas.find((x) => x.id === incluida.id);
    expect(
      await previaDaMudancaNoPlano(
        admCtx(),
        { acao: "RESTAURAR", id: incluida.id },
        amb.deps,
        AGORA,
      ),
    ).toMatchObject({ ocorrenciasNovas: 1 });
    const voltou = await restaurarAtividadeDoPlano(
      admCtx(),
      { id: incluida.id, rowVersion: removida?.rowVersion ?? 0 },
      amb.deps,
      AGORA,
    );
    expect(voltou).toMatchObject({ ocorrenciasNovas: 1 });
    expect(await celulas(incluida.id)).toEqual(["7:PREVISTA"]);

    // Da biblioteca, MB (1, 3, 5, 7, 9, 11): o 7 entra na visita aberta; 3, 5, 9 e 11 ganham visita.
    const { id: modeloId } = await incluirAtividade(
      admCtx(),
      {
        tipoId: tipo.id,
        titulo: "Atividade MB extra",
        periodicidade: "MB",
        natureza: "VERIFICACAO",
        exigeFoto: false,
        ordem: 9,
      },
      amb.deps,
    );
    const previaModelo = await previaDaMudancaNoPlano(
      admCtx(),
      { acao: "INCLUIR_MODELO", pmocId: c.pmocId, modeloId },
      amb.deps,
      AGORA,
    );
    expect(previaModelo).toMatchObject({ ocorrenciasNovas: 5, visitasCriadas: 4 });
    const modelo = await incluirAtividadeDaBiblioteca(
      admCtx(),
      { pmocId: c.pmocId, modeloId },
      amb.deps,
      AGORA,
    );
    expect(modelo.recalculo).toMatchObject({ ocorrenciasNovas: 5, visitasCriadas: 4 });
    const [origem] = await amb.owner`SELECT count(*)::int AS n FROM visit
      WHERE pmoc_id = ${c.pmocId} AND origin = 'RECALCULO' AND deleted_at IS NULL`;
    expect(origem?.n).toBe(4);
  }, 60_000);
});

describe("previaDaMudancaNoPlano: permissão", () => {
  it("só o ADM (RN-168)", async () => {
    const c = await amb.cenario([tipoMt]);
    await amb.emitir(c.pmocId);
    const a = primeira(await abrir(c.pmocId));
    for (const ctx of [technicianCtx(), clientCtx("A")]) {
      await expect(
        previaDaMudancaNoPlano(
          ctx,
          { acao: "PERIODICIDADE", id: a.id, periodicidade: "MS" },
          amb.deps,
          AGORA,
        ),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
  }, 60_000);
});
