/**
 * Etapa 3 – equipamentos e TAG (RF-09; FL-07; TL-110 aba Equipamentos, TL-111). RN-041, RN-045,
 * RN-046, RN-048, RN-049, RN-052, RN-152; CA-09.1 a CA-09.3; E-07.1 a E-07.6; isolamento (RN-162).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { alterarSituacaoTipo, criarTipo, obterTipo } from "../../src/modules/biblioteca";
import { criarCliente, criarLocal, excluirLocal, obterLocal } from "../../src/modules/clientes";
import {
  alterarSituacaoEquipamento,
  atualizarEquipamento,
  criarEquipamento,
  excluirEquipamento,
  listarEquipamentosDoLocal,
  obterEquipamento,
  prepararNovoEquipamento,
} from "../../src/modules/equipamentos";
import type { Database } from "../../src/server/db";
import {
  admCtx,
  appDatabase,
  clientCtx,
  ensureSeed,
  failureText,
  SEED,
  technicianCtx,
} from "./helpers";

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

function gerarCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((a, p, i) => a + Number(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${dv(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}

const endereco = {
  logradouro: "Rua A",
  numero: "1",
  semNumero: false,
  cidade: "Joinville",
  uf: "SC" as const,
  cep: "89201000",
};

/** Local novo (cliente novo) para cada teste: as TAGs não se misturam. */
async function novoLocal(): Promise<{ id: string; codigo: string }> {
  const { id } = await criarCliente(
    admCtx(),
    { razaoSocial: `Cliente ${randomUUID().slice(0, 8)}`, cnpj: gerarCnpj(), endereco },
    deps,
  );
  return criarLocal(admCtx(), { clienteId: id, nome: "Unidade", endereco }, deps);
}

/** Sigla única entre vivos (RN-040): 5 letras ao acaso. */
const siglaNova = () =>
  Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    "",
  );

/** Tipo novo com dois grupos; devolve ids e a sigla. */
async function novoTipo() {
  const sigla = siglaNova();
  const { id } = await criarTipo(
    admCtx(),
    { nome: `Tipo ${sigla}`, sigla, grupos: ["Hi-Wall", "Cassete"] },
    deps,
  );
  const t = await obterTipo(admCtx(), id, deps);
  const grupos = t?.grupos ?? [];
  return { id, sigla, grupoId: grupos[0]?.id as string, outroGrupoId: grupos[1]?.id as string };
}

const dados = (grupoId: string, extra = {}) => ({
  grupoId,
  ambiente: "Consultório 03",
  ...extra,
});

async function novoEquipamento(localId: string, t: { id: string; grupoId: string }, extra = {}) {
  return criarEquipamento(admCtx(), { localId, tipoId: t.id, ...dados(t.grupoId, extra) }, deps);
}

const obter = async (id: string) =>
  (await obterEquipamento(admCtx(), id, deps)) as NonNullable<
    Awaited<ReturnType<typeof obterEquipamento>>
  >;

/** Contrato e PMOC direto no banco (a criação do PMOC pela tela é da Etapa 4). */
async function criarPmoc(localId: string, status: "RASCUNHO" | "HISTORICO" = "RASCUNHO") {
  return owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    const [k] = await tx`INSERT INTO contract (site_id, start_date, end_date, art_number, status)
      VALUES (${localId}, '2026-01-01', '2026-12-31', 'ART-T', 'VIGENTE') RETURNING id`;
    const [p] = await tx`INSERT INTO pmoc (contract_id, status, historic_since)
      VALUES (${k?.id}, ${status}, ${status === "HISTORICO" ? new Date() : null}) RETURNING id`;
    return p?.id as string;
  });
}

/** Ocorrência com registro (RN-048), direto no banco (a execução é da Etapa 6). */
async function registrarOcorrencia(pmocId: string, equipamentoId: string, tipoId: string) {
  await owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    const [a] = await tx`INSERT INTO pmoc_activity (pmoc_id, equipment_type_id, title, periodicity,
        nature, display_order)
      VALUES (${pmocId}, ${tipoId}, 'Atividade de teste', 'MM', 'VERIFICACAO', 1) RETURNING id`;
    const [o] =
      await tx`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index,
        reference_month, due_date, status)
      VALUES (${pmocId}, ${a?.id}, ${equipamentoId}, 1, '2026-01-01', '2026-01-31', 'PREVISTA')
      RETURNING id`;
    await tx`INSERT INTO occurrence_record (occurrence_id, activity_nature, source)
      VALUES (${o?.id}, 'VERIFICACAO', 'PAINEL_ADM')`;
  });
}

describe("TAG (RN-046; CA-09.1, CA-09.2)", () => {
  it("CA-09.1: o terceiro do tipo no local recebe {código}-{sigla}-003; auditado", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    await novoEquipamento(l.id, t);
    await novoEquipamento(l.id, t);
    const terceiro = await novoEquipamento(l.id, t);
    expect(terceiro.tag).toBe(`${l.codigo}-${t.sigla}-003`);
    const [n] = await owner`SELECT count(*)::int AS n FROM audit_log
      WHERE table_name = 'equipment' AND record_id = ${terceiro.id} AND action = 'INSERT'`;
    expect(n?.n).toBe(1);
    // O contador é tabela técnica, sem auditoria (03 §5.3).
    const [c] = await owner`SELECT count(*)::int AS n FROM audit_log
      WHERE table_name = 'equipment_tag_counter'`;
    expect(c?.n).toBe(0);
  });

  it("CA-09.2: inativado ou excluído, o sequencial não volta", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    await novoEquipamento(l.id, t);
    const segundo = await obter((await novoEquipamento(l.id, t)).id);
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: segundo.id, rowVersion: segundo.rowVersion, situacao: "INATIVO" },
      deps,
    );
    expect((await novoEquipamento(l.id, t)).tag).toBe(`${l.codigo}-${t.sigla}-003`);
    const quarto = await obter((await novoEquipamento(l.id, t)).id);
    await excluirEquipamento(admCtx(), { id: quarto.id, rowVersion: quarto.rowVersion }, deps);
    expect((await novoEquipamento(l.id, t)).tag).toBe(`${l.codigo}-${t.sigla}-005`);
  });

  it("o sequencial é por local + tipo: outro tipo e outro local começam em 001", async () => {
    const l1 = await novoLocal();
    const l2 = await novoLocal();
    const spl = await novoTipo();
    const cas = await novoTipo();
    await novoEquipamento(l1.id, spl);
    expect((await novoEquipamento(l1.id, cas)).tag).toBe(`${l1.codigo}-${cas.sigla}-001`);
    expect((await novoEquipamento(l2.id, spl)).tag).toBe(`${l2.codigo}-${spl.sigla}-001`);
  });

  it("inclusões simultâneas do mesmo par recebem sequenciais distintos", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const tags = await Promise.all([1, 2, 3].map(() => novoEquipamento(l.id, t)));
    expect(tags.map((e) => e.tag).sort()).toEqual(
      ["001", "002", "003"].map((n) => `${l.codigo}-${t.sigla}-${n}`),
    );
  });

  it("E-07.6: acima de 999 recusa com a mensagem e o contador não anda", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    await owner`INSERT INTO equipment_tag_counter (site_id, equipment_type_id, last_sequence)
      VALUES (${l.id}, ${t.id}, 999)`;
    await expect(novoEquipamento(l.id, t)).rejects.toThrow(
      "Limite de TAGs deste tipo no local atingido.",
    );
    const [c] = await owner`SELECT last_sequence FROM equipment_tag_counter
      WHERE site_id = ${l.id} AND equipment_type_id = ${t.id}`;
    expect(c?.last_sequence).toBe(999);
  });

  it("TAG, sequencial, local e tipo não mudam nem pelo banco (RN-046, RN-049)", async () => {
    const l = await novoLocal();
    const outro = await novoLocal();
    const t = await novoTipo();
    const t2 = await novoTipo();
    const { id } = await novoEquipamento(l.id, t);
    const mudar = (set: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      failureText(
        owner.begin(async (tx) => {
          await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
          await set(tx);
        }),
      );
    expect(await mudar((tx) => tx`UPDATE equipment SET tag = 'X-1' WHERE id = ${id}`)).toMatch(
      /são imutáveis/,
    );
    expect(
      await mudar((tx) => tx`UPDATE equipment SET site_id = ${outro.id} WHERE id = ${id}`),
    ).toMatch(/são imutáveis/);
    expect(
      await mudar(
        (tx) =>
          tx`UPDATE equipment SET equipment_type_id = ${t2.id}, equipment_group_id = ${t2.grupoId}
          WHERE id = ${id}`,
      ),
    ).toMatch(/tipo do equipamento não muda/);
  });
});

describe("campos (RN-041, RN-045, RN-052; CA-09.3; E-07.1 a E-07.3)", () => {
  it("CA-09.3 / E-07.1: sem ambiente rejeita", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    await expect(novoEquipamento(l.id, t, { ambiente: "  " })).rejects.toThrow(
      /Informe o ambiente/,
    );
  });

  it("E-07.3: capacidade ≤ 0, sem unidade ou com mais de 2 casas rejeita", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    await expect(novoEquipamento(l.id, t, { capacidade: "0", unidade: "BTU/h" })).rejects.toThrow(
      /maior que zero/,
    );
    await expect(novoEquipamento(l.id, t, { capacidade: "12000" })).rejects.toThrow(
      /Informe a unidade/,
    );
    await expect(novoEquipamento(l.id, t, { capacidade: "1,234", unidade: "TR" })).rejects.toThrow(
      /até 2 casas/,
    );
  });

  it("capacidade em pt-BR vira número; opcionais vazios gravam nulo; sem capacidade não grava unidade", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const a = await obter(
      (
        await novoEquipamento(l.id, t, {
          marca: " LG ",
          modelo: "",
          capacidade: "12.000",
          unidade: "BTU/h",
        })
      ).id,
    );
    expect(a).toMatchObject({ marca: "LG", modelo: null, unidade: "BTU/h" });
    expect(Number(a.capacidade)).toBe(12000);
    const b = await obter((await novoEquipamento(l.id, t, { unidade: "BTU/h" })).id);
    expect(b).toMatchObject({ capacidade: null, unidade: null });
  });

  it("E-07.2 / RN-041: grupo de outro tipo, grupo inativo ou tipo inativo recusam", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const t2 = await novoTipo();
    await expect(
      criarEquipamento(admCtx(), { localId: l.id, tipoId: t.id, ...dados(t2.grupoId) }, deps),
    ).rejects.toThrow(/grupo ativo do tipo/);
    const tipo = await obterTipo(admCtx(), t2.id, deps);
    await alterarSituacaoTipo(
      admCtx(),
      { id: t2.id, rowVersion: tipo?.tipo.rowVersion ?? 0, situacao: "INATIVO" },
      deps,
    );
    await expect(novoEquipamento(l.id, t2)).rejects.toThrow(/tipo ativo/);
    // A tela só oferece tipos ATIVO (FL-07 passo 2).
    const n = await prepararNovoEquipamento(admCtx(), l.id, deps);
    expect(n?.tipos.some((x) => x.id === t2.id)).toBe(false);
    expect(n?.tipos.find((x) => x.id === t.id)?.previaTag).toBe(`${l.codigo}-${t.sigla}-NNN`);
  });

  it("editar troca o grupo para outro do tipo; conflito de versão recusa (UF-07)", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const e = await obter((await novoEquipamento(l.id, t)).id);
    await atualizarEquipamento(
      admCtx(),
      { id: e.id, rowVersion: e.rowVersion, ...dados(t.outroGrupoId, { ambiente: "Recepção" }) },
      deps,
    );
    const depois = await obter(e.id);
    expect(depois).toMatchObject({ grupoId: t.outroGrupoId, ambiente: "Recepção", tag: e.tag });
    await expect(
      atualizarEquipamento(
        admCtx(),
        { id: e.id, rowVersion: e.rowVersion, ...dados(t.grupoId) },
        deps,
      ),
    ).rejects.toThrow(/alterado por outra pessoa/);
  });
});

describe("inativar, reativar e excluir (RN-048, RN-152; E-07.5)", () => {
  it("inativar grava a data; reativar limpa [A VALIDAR]; reativar com tipo inativo recusa", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const e = await obter((await novoEquipamento(l.id, t)).id);
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: e.id, rowVersion: e.rowVersion, situacao: "INATIVO" },
      deps,
    );
    const inativo = await obter(e.id);
    expect(inativo.situacao).toBe("INATIVO");
    expect(inativo.inativadoEm).toBeInstanceOf(Date);
    await expect(
      alterarSituacaoEquipamento(
        admCtx(),
        { id: e.id, rowVersion: inativo.rowVersion, situacao: "INATIVO" },
        deps,
      ),
    ).rejects.toThrow(/já está inativo/);

    const tipo = await obterTipo(admCtx(), t.id, deps);
    await alterarSituacaoTipo(
      admCtx(),
      { id: t.id, rowVersion: tipo?.tipo.rowVersion ?? 0, situacao: "INATIVO" },
      deps,
    );
    await expect(
      alterarSituacaoEquipamento(
        admCtx(),
        { id: e.id, rowVersion: inativo.rowVersion, situacao: "ATIVO" },
        deps,
      ),
    ).rejects.toThrow(/Reative antes o tipo/);
    const tipoInativo = await obterTipo(admCtx(), t.id, deps);
    await alterarSituacaoTipo(
      admCtx(),
      { id: t.id, rowVersion: tipoInativo?.tipo.rowVersion ?? 0, situacao: "ATIVO" },
      deps,
    );
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: e.id, rowVersion: inativo.rowVersion, situacao: "ATIVO" },
      deps,
    );
    expect(await obter(e.id)).toMatchObject({ situacao: "ATIVO", inativadoEm: null });
  });

  it("RN-048 / E-07.5: com ocorrência registrada não exclui (serviço e banco), só inativa", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const e = await obter((await novoEquipamento(l.id, t)).id);
    const pmocId = await criarPmoc(l.id, "HISTORICO");
    await registrarOcorrencia(pmocId, e.id, t.id);
    const comReg = await obter(e.id);
    expect(comReg).toMatchObject({ temRegistro: true, podeExcluir: false });
    await expect(
      excluirEquipamento(admCtx(), { id: e.id, rowVersion: comReg.rowVersion }, deps),
    ).rejects.toThrow("Equipamento com registro: só pode ser inativado.");
    const banco = await failureText(
      owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await tx`UPDATE equipment SET deleted_at = now() WHERE id = ${e.id}`;
      }),
    );
    expect(banco).toMatch(/não é excluído, só inativado/);
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: e.id, rowVersion: comReg.rowVersion, situacao: "INATIVO" },
      deps,
    );
    expect((await obter(e.id)).situacao).toBe("INATIVO");
  });

  it("excluir sem registro: some da lista e libera excluir o local (EL-7)", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const e = await obter((await novoEquipamento(l.id, t)).id);
    const local = await obterLocal(admCtx(), l.id, deps);
    await expect(
      excluirLocal(admCtx(), { id: l.id, rowVersion: local?.rowVersion ?? 0 }, deps),
    ).rejects.toThrow(/Exclua antes os contratos e os equipamentos/);
    expect(
      await excluirEquipamento(
        admCtx(),
        { id: e.id, rowVersion: e.rowVersion, motivo: "Cadastro em duplicidade" },
        deps,
      ),
    ).toEqual({ localId: l.id });
    expect(await obterEquipamento(admCtx(), e.id, deps)).toBeNull();
    const [row] = await owner`SELECT deleted_at, deletion_reason FROM equipment WHERE id = ${e.id}`;
    expect(row?.deletion_reason).toBe("Cadastro em duplicidade");
    await excluirLocal(admCtx(), { id: l.id, rowVersion: local?.rowVersion ?? 0 }, deps);
  });
});

describe("local com PMOC (FL-07 passos 4–5; Etapa 4)", () => {
  it("incluir, inativar e excluir esperam a Etapa 4; editar os dados continua; PMOC histórico libera", async () => {
    const l = await novoLocal();
    const t = await novoTipo();
    const e = await obter((await novoEquipamento(l.id, t)).id);
    await criarPmoc(l.id, "RASCUNHO");
    await expect(novoEquipamento(l.id, t)).rejects.toThrow(/ainda não está disponível/);
    await expect(
      alterarSituacaoEquipamento(
        admCtx(),
        { id: e.id, rowVersion: e.rowVersion, situacao: "INATIVO" },
        deps,
      ),
    ).rejects.toThrow(/ainda não está disponível/);
    await expect(
      excluirEquipamento(admCtx(), { id: e.id, rowVersion: e.rowVersion }, deps),
    ).rejects.toThrow(/ainda não está disponível/);
    expect((await obter(e.id)).bloqueio).toMatch(/ainda não está disponível/);
    expect((await prepararNovoEquipamento(admCtx(), l.id, deps))?.bloqueio).toMatch(
      /ainda não está disponível/,
    );
    await atualizarEquipamento(
      admCtx(),
      { id: e.id, rowVersion: e.rowVersion, ...dados(t.grupoId, { marca: "Midea" }) },
      deps,
    );
    expect((await obter(e.id)).marca).toBe("Midea");

    const l2 = await novoLocal();
    await criarPmoc(l2.id, "HISTORICO");
    expect((await novoEquipamento(l2.id, t)).tag).toBe(`${l2.codigo}-${t.sigla}-001`);
  });
});

describe("lista do local (TL-110 aba Equipamentos)", () => {
  it("por TAG; inativos só com o filtro; filtro por tipo; tipos do local no filtro", async () => {
    const l = await novoLocal();
    const a = await novoTipo();
    const b = await novoTipo();
    await novoEquipamento(l.id, a);
    const inativo = await obter((await novoEquipamento(l.id, a)).id);
    await novoEquipamento(l.id, b);
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: inativo.id, rowVersion: inativo.rowVersion, situacao: "INATIVO" },
      deps,
    );
    const ativos = await listarEquipamentosDoLocal(admCtx(), l.id, {}, deps);
    expect(ativos?.equipamentos.map((e) => e.tag)).toEqual(
      [`${l.codigo}-${a.sigla}-001`, `${l.codigo}-${b.sigla}-001`].sort(),
    );
    expect(ativos?.tipos.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    const todosA = await listarEquipamentosDoLocal(
      admCtx(),
      l.id,
      { tipoId: a.id, mostrarInativos: true },
      deps,
    );
    expect(todosA?.equipamentos.map((e) => e.tag)).toEqual([
      `${l.codigo}-${a.sigla}-001`,
      `${l.codigo}-${a.sigla}-002`,
    ]);
    // Filtro inválido da URL é ignorado.
    const lixo = await listarEquipamentosDoLocal(admCtx(), l.id, { tipoId: "x" }, deps);
    expect(lixo?.equipamentos).toHaveLength(2);
  });
});

describe("permissões e isolamento (RF-03; RN-162)", () => {
  it("CLIENTE lê só o equipamento dos próprios locais; TECNICO sem visita não lê", async () => {
    expect((await obterEquipamento(clientCtx("A"), SEED.equipmentAId, deps))?.id).toBe(
      SEED.equipmentAId,
    );
    expect(await obterEquipamento(clientCtx("A"), SEED.equipmentBId, deps)).toBeNull();
    expect(await listarEquipamentosDoLocal(clientCtx("A"), SEED.siteBId, {}, deps)).toBeNull();
    expect(await obterEquipamento(technicianCtx(), SEED.equipmentAId, deps)).toBeNull();
    expect(await obterEquipamento(admCtx(), randomUUID(), deps)).toBeNull();
    expect(await obterEquipamento(admCtx(), "nao-e-uuid", deps)).toBeNull();
  });

  it("só o ADM grava; CLIENTE e TECNICO recebem SEM_PERMISSAO", async () => {
    const e = await obter(SEED.equipmentAId);
    for (const ctx of [clientCtx("A"), technicianCtx()]) {
      await expect(
        criarEquipamento(
          ctx,
          { localId: SEED.siteAId, tipoId: SEED.equipmentTypeId, ...dados(SEED.equipmentGroupId) },
          deps,
        ),
      ).rejects.toThrow(/Sem permissão/);
      await expect(
        atualizarEquipamento(
          ctx,
          { id: e.id, rowVersion: e.rowVersion, ...dados(SEED.equipmentGroupId) },
          deps,
        ),
      ).rejects.toThrow(/Sem permissão/);
      await expect(
        excluirEquipamento(ctx, { id: e.id, rowVersion: e.rowVersion }, deps),
      ).rejects.toThrow(/Sem permissão/);
      expect(await prepararNovoEquipamento(ctx, SEED.siteAId, deps)).toBeNull();
    }
  });
});
