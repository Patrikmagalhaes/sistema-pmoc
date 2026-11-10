/**
 * Etapa 3 – biblioteca de tipos, grupos e atividades (RF-08; FL-03; TL-104, TL-105). CA-08.1 a CA-08.3,
 * E-03.1 a E-03.6, RN-040 a RN-044, RN-051, EL-4 e isolamento (SEG-25).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  alterarSituacaoAtividade,
  alterarSituacaoGrupo,
  alterarSituacaoTipo,
  atualizarAtividade,
  atualizarTipo,
  criarTipo,
  excluirAtividade,
  excluirGrupo,
  excluirTipo,
  incluirAtividade,
  incluirGrupo,
  listarTipos,
  obterTipo,
  renomearGrupo,
} from "../../src/modules/biblioteca";
import type { Database } from "../../src/server/db";
import { admCtx, appDatabase, clientCtx, ensureSeed, SEED, technicianCtx } from "./helpers";

let db: Database;
let owner: postgres.Sql;
let deps: { db: Database };

beforeAll(async () => {
  db = appDatabase(3);
  owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });
  await ensureSeed(db);
  deps = { db };
});
afterAll(async () => {
  await owner.end();
  await db.close();
});

const sigla = () =>
  Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    "",
  );

async function novoTipo(nome = `Tipo ${randomUUID().slice(0, 8)}`, grupos = ["G1"]) {
  const s = sigla();
  const { id } = await criarTipo(admCtx(), { nome, sigla: s.toLowerCase(), grupos }, deps);
  const t = await obterTipo(admCtx(), id, deps);
  if (!t) throw new Error("tipo deveria existir");
  return t;
}

const atividade = (tipoId: string, extra: Record<string, unknown> = {}) => ({
  tipoId,
  titulo: `Atividade ${randomUUID().slice(0, 6)}`,
  periodicidade: "MM" as const,
  natureza: "VERIFICACAO" as const,
  ordem: 1,
  ...extra,
});

describe("tipo (RN-040; E-03.1, E-03.2, E-03.4)", () => {
  it("cria com sigla em maiúsculas e grupos; grava auditoria", async () => {
    const t = await novoTipo("Janela teste", ["Parede", "Portátil"]);
    expect(t.tipo.sigla).toMatch(/^[A-Z]{5}$/);
    expect(t.grupos.map((g) => g.nome).sort()).toEqual(["Parede", "Portátil"]);
    const [n] = await owner`SELECT count(*)::int AS n FROM audit_log
      WHERE table_name = 'equipment_type' AND record_id = ${t.tipo.id} AND action = 'INSERT'`;
    expect(n?.n).toBe(1);
  });

  it("sem grupo, sigla fora do formato, nome ou sigla repetidos são recusados", async () => {
    await expect(
      criarTipo(admCtx(), { nome: "Sem grupo", sigla: "SGR", grupos: [" "] }, deps),
    ).rejects.toThrow(/Inclua ao menos um grupo/);
    await expect(
      criarTipo(admCtx(), { nome: "Sigla ruim", sigla: "S1", grupos: ["G"] }, deps),
    ).rejects.toThrow(/2 a 5 letras/);
    await expect(
      criarTipo(admCtx(), { nome: "split", sigla: sigla(), grupos: ["G"] }, deps),
    ).rejects.toMatchObject({ codigo: "DUPLICADO", campo: "nome" }); // sem diferenciar caixa
    await expect(
      criarTipo(admCtx(), { nome: `Outro ${randomUUID()}`, sigla: "SPL", grupos: ["G"] }, deps),
    ).rejects.toMatchObject({ codigo: "DUPLICADO", campo: "sigla" });
  });

  it("sigla de tipo com equipamento é travada no serviço e no banco (E-03.4)", async () => {
    const t = await obterTipo(admCtx(), SEED.equipmentTypeId, deps);
    expect(t?.tipo).toMatchObject({ siglaTravada: true, emUso: true });
    await expect(
      atualizarTipo(
        admCtx(),
        {
          id: SEED.equipmentTypeId,
          rowVersion: t?.tipo.rowVersion ?? 1,
          nome: "Split",
          sigla: "SPT",
        },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "SIGLA_TRAVADA", campo: "sigla" });
    // o trigger segura mesmo quem passar por fora do serviço
    await expect(
      owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await tx`UPDATE equipment_type SET acronym = 'SPT' WHERE id = ${SEED.equipmentTypeId}`;
      }),
    ).rejects.toThrow(/não pode mudar/);
  });

  it("edita nome, plural e sigla (sem equipamento); versão antiga é recusada (UF-07)", async () => {
    const t = await novoTipo();
    const nova = sigla();
    await atualizarTipo(
      admCtx(),
      {
        id: t.tipo.id,
        rowVersion: t.tipo.rowVersion,
        nome: t.tipo.nome,
        plural: "Coisas",
        sigla: nova,
      },
      deps,
    );
    expect((await obterTipo(admCtx(), t.tipo.id, deps))?.tipo).toMatchObject({
      plural: "Coisas",
      sigla: nova,
    });
    await expect(
      atualizarTipo(
        admCtx(),
        { id: t.tipo.id, rowVersion: t.tipo.rowVersion, nome: "X", sigla: nova },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "ALTERADO_POR_OUTRO" });
  });

  it("lista ativos; inativos só com o filtro (UL-03)", async () => {
    const t = await novoTipo();
    await alterarSituacaoTipo(
      admCtx(),
      { id: t.tipo.id, rowVersion: t.tipo.rowVersion, situacao: "INATIVO" },
      deps,
    );
    const ativos = await listarTipos(admCtx(), {}, deps);
    expect(ativos.some((x) => x.id === t.tipo.id)).toBe(false);
    const todos = await listarTipos(admCtx(), { mostrarInativos: true }, deps);
    expect(todos.find((x) => x.id === t.tipo.id)).toMatchObject({ situacao: "INATIVO", grupos: 1 });
  });
});

describe("excluir ou inativar (EL-4; RN-044; CA-08.2)", () => {
  it("tipo sem uso é excluído logicamente com grupos e atividades; some das telas", async () => {
    const t = await novoTipo();
    const { id: aId } = await incluirAtividade(admCtx(), atividade(t.tipo.id), deps);
    await excluirTipo(admCtx(), { id: t.tipo.id, rowVersion: t.tipo.rowVersion }, deps);
    expect(await obterTipo(admCtx(), t.tipo.id, deps)).toBeNull();
    const [r] = await owner`SELECT
        (SELECT deleted_at IS NOT NULL FROM equipment_type WHERE id = ${t.tipo.id}) AS tipo,
        (SELECT bool_and(deleted_at IS NOT NULL) FROM equipment_group WHERE equipment_type_id = ${t.tipo.id}) AS grupos,
        (SELECT deleted_at IS NOT NULL FROM activity_template WHERE id = ${aId}) AS atividade`;
    expect(r).toEqual({ tipo: true, grupos: true, atividade: true });
    // excluído libera nome e sigla para um novo tipo (UNIQUE só entre vivos)
    await criarTipo(admCtx(), { nome: t.tipo.nome, sigla: t.tipo.sigla, grupos: ["G"] }, deps);
  });

  it("tipo e grupo com equipamento só inativam; o PMOC/equipamento continua íntegro", async () => {
    const t = await obterTipo(admCtx(), SEED.equipmentTypeId, deps);
    await expect(
      excluirTipo(
        admCtx(),
        { id: SEED.equipmentTypeId, rowVersion: t?.tipo.rowVersion ?? 1 },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "EM_USO" });
    const g = t?.grupos.find((x) => x.id === SEED.equipmentGroupId);
    expect(g?.emUso).toBe(true);
    await expect(
      excluirGrupo(admCtx(), { id: SEED.equipmentGroupId, rowVersion: g?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: expect.stringMatching(/EM_USO|SEM_GRUPO_ATIVO/) });
  });

  it("atividade em PMOC só inativa; nova periodicidade não muda o PMOC (CA-08.3)", async () => {
    const t = await novoTipo();
    const { id } = await incluirAtividade(
      admCtx(),
      atividade(t.tipo.id, { natureza: "MEDICAO", unidade: "V" }),
      deps,
    );
    await owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      await tx`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, activity_template_id, title,
          periodicity, nature, unit, display_order)
        VALUES (${SEED.pmocAId}, ${t.tipo.id}, ${id}, 'cópia', 'MM', 'MEDICAO', 'V', 1)`;
    });
    const a = (await obterTipo(admCtx(), t.tipo.id, deps))?.atividades[0];
    expect(a?.emUso).toBe(true);
    await expect(
      excluirAtividade(admCtx(), { id, rowVersion: a?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "EM_USO" });
    const r = await atualizarAtividade(
      admCtx(),
      {
        ...atividade(t.tipo.id, { natureza: "MEDICAO", unidade: "V", periodicidade: "MT" }),
        id,
        rowVersion: a?.rowVersion ?? 1,
      },
      deps,
    );
    expect(r.periodicidadeMudou).toBe(true); // E-03.5
    const [p] =
      await owner`SELECT periodicity FROM pmoc_activity WHERE activity_template_id = ${id}`;
    expect(p?.periodicity).toBe("MM");
    const b = (await obterTipo(admCtx(), t.tipo.id, deps))?.atividades[0];
    await alterarSituacaoAtividade(
      admCtx(),
      { id, rowVersion: b?.rowVersion ?? 1, situacao: "INATIVO" },
      deps,
    );
    expect((await obterTipo(admCtx(), t.tipo.id, deps))?.atividades[0]?.situacao).toBe("INATIVO");
  });
});

describe("grupos (RN-040; E-03.2)", () => {
  it("não tira o último grupo ativo de tipo ativo; com outro ativo, pode", async () => {
    const t = await novoTipo(undefined, ["Único"]);
    const g = t.grupos[0];
    if (!g) throw new Error();
    await expect(
      alterarSituacaoGrupo(
        admCtx(),
        { id: g.id, rowVersion: g.rowVersion, situacao: "INATIVO" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "SEM_GRUPO_ATIVO" });
    await expect(
      excluirGrupo(admCtx(), { id: g.id, rowVersion: g.rowVersion }, deps),
    ).rejects.toMatchObject({ codigo: "SEM_GRUPO_ATIVO" });
    await incluirGrupo(admCtx(), { tipoId: t.tipo.id, nome: "Segundo" }, deps);
    await expect(
      incluirGrupo(admCtx(), { tipoId: t.tipo.id, nome: "segundo" }, deps),
    ).rejects.toMatchObject({ codigo: "DUPLICADO", campo: "nome" });
    await excluirGrupo(admCtx(), { id: g.id, rowVersion: g.rowVersion }, deps);
    const depois = await obterTipo(admCtx(), t.tipo.id, deps);
    expect(depois?.grupos.map((x) => x.nome)).toEqual(["Segundo"]);
    const s = depois?.grupos[0];
    await renomearGrupo(
      admCtx(),
      { id: s?.id ?? "", rowVersion: s?.rowVersion ?? 1, nome: "Cassete" },
      deps,
    );
    expect((await obterTipo(admCtx(), t.tipo.id, deps))?.grupos[0]?.nome).toBe("Cassete");
  });

  it("reativar tipo exige um grupo ativo", async () => {
    const t = await novoTipo(undefined, ["A", "B"]);
    await alterarSituacaoTipo(
      admCtx(),
      { id: t.tipo.id, rowVersion: t.tipo.rowVersion, situacao: "INATIVO" },
      deps,
    );
    // com o tipo inativo, os grupos podem ficar todos inativos
    for (const g of t.grupos) {
      await alterarSituacaoGrupo(
        admCtx(),
        { id: g.id, rowVersion: g.rowVersion, situacao: "INATIVO" },
        deps,
      );
    }
    const x = await obterTipo(admCtx(), t.tipo.id, deps);
    await expect(
      alterarSituacaoTipo(
        admCtx(),
        { id: t.tipo.id, rowVersion: x?.tipo.rowVersion ?? 1, situacao: "ATIVO" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "SEM_GRUPO_ATIVO" });
  });
});

describe("atividades (RN-042, RN-043, RN-051; CA-08.1; E-03.3, E-03.6)", () => {
  it("MEDICAO sem unidade é recusada; VERIFICACAO descarta a unidade; título repetido no tipo", async () => {
    const t = await novoTipo();
    await expect(
      incluirAtividade(admCtx(), atividade(t.tipo.id, { natureza: "MEDICAO", unidade: "" }), deps),
    ).rejects.toMatchObject({ codigo: "VALIDACAO", campo: "unidade" });
    await incluirAtividade(
      admCtx(),
      atividade(t.tipo.id, { titulo: "Limpar", unidade: "V", exigeFoto: true }),
      deps,
    );
    await expect(
      incluirAtividade(admCtx(), atividade(t.tipo.id, { titulo: "limpar" }), deps),
    ).rejects.toMatchObject({ codigo: "DUPLICADO", campo: "titulo" });
    const a = (await obterTipo(admCtx(), t.tipo.id, deps))?.atividades[0];
    expect(a).toMatchObject({ titulo: "Limpar", unidade: null, exigeFoto: true });
  });

  it("devolve na ordem periodicidade → ordem de exibição", async () => {
    const t = await novoTipo();
    for (const [titulo, periodicidade, ordem] of [
      ["Anual", "MA", 1],
      ["Mensal 2", "MM", 2],
      ["Trimestral", "MT", 1],
      ["Mensal 1", "MM", 1],
    ] as const) {
      await incluirAtividade(
        admCtx(),
        atividade(t.tipo.id, { titulo, periodicidade, ordem }),
        deps,
      );
    }
    const r = await obterTipo(admCtx(), t.tipo.id, deps);
    expect(r?.atividades.map((a) => a.titulo)).toEqual([
      "Mensal 1",
      "Mensal 2",
      "Trimestral",
      "Anual",
    ]);
  });
});

describe("isolamento (RF-03; SEG-25)", () => {
  it("CLIENTE e TECNICO não leem nem alteram a biblioteca", async () => {
    for (const ctx of [clientCtx("A"), technicianCtx()]) {
      await expect(listarTipos(ctx, {}, deps)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(obterTipo(ctx, SEED.equipmentTypeId, deps)).rejects.toMatchObject({
        codigo: "SEM_PERMISSAO",
      });
      await expect(
        criarTipo(ctx, { nome: "X", sigla: "XX", grupos: ["G"] }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        excluirTipo(ctx, { id: SEED.equipmentTypeId, rowVersion: 1 }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
  });

  it("id inexistente ou malformado vira não encontrado", async () => {
    expect(await obterTipo(admCtx(), "nao-e-uuid", deps)).toBeNull();
    expect(await obterTipo(admCtx(), randomUUID(), deps)).toBeNull();
    await expect(
      incluirGrupo(admCtx(), { tipoId: randomUUID(), nome: "G" }, deps),
    ).rejects.toMatchObject({ codigo: "NAO_ENCONTRADO" });
  });
});
