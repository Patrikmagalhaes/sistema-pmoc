/**
 * Etapa 4 – rascunho e plano do PMOC (RF-10, RF-11; FL-08 passos 1–6; TL-120). RN-001 a RN-004,
 * RN-006, RN-017, RN-026, RN-147, RN-184; CA-08.3, CA-10.1, CA-10.2; E-08.1, E-08.2, E-08.5;
 * FL-07 passo 5; isolamento (RN-162).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  alterarSituacaoAtividade,
  atualizarAtividade,
  criarTipo,
  incluirAtividade,
  obterTipo,
} from "../../src/modules/biblioteca";
import { criarCliente, criarContrato, criarLocal } from "../../src/modules/clientes";
import { alterarSituacaoEquipamento, criarEquipamento } from "../../src/modules/equipamentos";
import {
  alterarPeriodicidade,
  criarPmoc,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  obterPmoc,
  type PmocCompleto,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
} from "../../src/modules/pmoc";
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
const AGORA = new Date("2026-11-13T12:00:00Z");

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

/** Local novo em cliente novo (nunca nos clientes da semente: o isolamento conta as linhas deles). */
async function novoLocal(): Promise<string> {
  const { id } = await criarCliente(
    admCtx(),
    { razaoSocial: `Cliente ${randomUUID().slice(0, 8)}`, cnpj: gerarCnpj(), endereco },
    deps,
  );
  return (await criarLocal(admCtx(), { clienteId: id, nome: "Unidade", endereco }, deps)).id;
}

const siglaNova = () =>
  Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    "",
  );

/** Tipo com atividades na biblioteca: "Tensão" MS (MEDICAO), "Filtro" MM e uma inativa. */
async function novoTipo() {
  const sigla = siglaNova();
  const { id } = await criarTipo(admCtx(), { nome: `Tipo ${sigla}`, sigla, grupos: ["G"] }, deps);
  const base = { tipoId: id, exigeFoto: false };
  const tensao = await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Tensão", periodicidade: "MS", natureza: "MEDICAO", unidade: "V", ordem: 1 },
    deps,
  );
  const filtro = await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Filtro", periodicidade: "MM", natureza: "VERIFICACAO", ordem: 2 },
    deps,
  );
  const inativa = await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Inativa", periodicidade: "MA", natureza: "VERIFICACAO", ordem: 3 },
    deps,
  );
  await alterarSituacaoAtividade(
    admCtx(),
    { id: inativa.id, rowVersion: 1, situacao: "INATIVO" },
    deps,
  );
  const t = await obterTipo(admCtx(), id, deps);
  return { id, grupoId: t?.grupos[0]?.id as string, tensao: tensao.id, filtro: filtro.id };
}

async function novoEquipamento(localId: string, t: { id: string; grupoId: string }) {
  return criarEquipamento(
    admCtx(),
    { localId, tipoId: t.id, grupoId: t.grupoId, ambiente: "Sala 1" },
    deps,
  );
}

async function novoContrato(
  localId: string,
  inicio = "2026-11-01",
  fim = "2027-10-31",
  anteriorId?: string,
) {
  return (
    await criarContrato(admCtx(), { localId, inicio, fim, art: "ART-1", anteriorId }, deps, AGORA)
  ).id;
}

const abrir = async (id: string) => (await obterPmoc(admCtx(), id, deps)) as PmocCompleto;
const tipo = (p: PmocCompleto, id: string) => p.tipos.find((t) => t.id === id);
const atividade = (p: PmocCompleto, titulo: string, tipoId?: string) =>
  p.tipos
    .filter((t) => !tipoId || t.id === tipoId)
    .flatMap((t) => t.atividades)
    .find((a) => a.titulo === titulo);

describe("criar o rascunho (FL-08 passos 1–3)", () => {
  it("RN-002: copia as atividades ATIVO dos tipos com equipamento ATIVO, com a periodicidade padrão", async () => {
    const l = await novoLocal();
    const split = await novoTipo();
    const vrf = await novoTipo();
    const semEquipamentoAtivo = await novoTipo();
    await novoEquipamento(l, split);
    await novoEquipamento(l, split);
    await novoEquipamento(l, vrf);
    const inativo = await novoEquipamento(l, semEquipamentoAtivo);
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: inativo.id, rowVersion: 1, situacao: "INATIVO" },
      deps,
    );

    const { id } = await criarPmoc(
      admCtx(),
      { contratoId: await novoContrato(l), copiarDoAnterior: false },
      deps,
    );
    const p = await abrir(id);
    expect(p.situacao).toBe("RASCUNHO");
    expect(p.tipos.map((t) => t.id).sort()).toEqual([split.id, vrf.id].sort());
    expect(tipo(p, split.id)?.equipamentosAtivos).toBe(2);
    // RN-051: MM antes de MS; a inativa não entra (RN-152).
    expect(tipo(p, split.id)?.atividades.map((a) => [a.titulo, a.periodicidade])).toEqual([
      ["Filtro", "MM"],
      ["Tensão", "MS"],
    ]);
    expect(atividade(p, "Tensão", split.id)).toMatchObject({ natureza: "MEDICAO", unidade: "V" });
    // RN-006 / DM-05: em RASCUNHO nada vai para occurrence; a pré-visualização calcula.
    expect(p.calendario).toHaveLength(12);
    expect(p.calendario[0]).toMatchObject({ indice: 1, referencia: "2026-11-01" });
    expect(atividade(p, "Tensão", split.id)?.previstos).toEqual([1, 7]);
    // Split: 2 equipamentos × (12 + 2); VRF: 1 × (12 + 2).
    expect(p.ocorrenciasPrevistas).toBe(3 * 14);
    const [o] = await owner`SELECT count(*)::int AS n FROM occurrence WHERE pmoc_id = ${id}`;
    expect(o?.n).toBe(0);
  });

  it("RN-001 / E-08.1: um PMOC por contrato; E-08.2: local sem equipamento dá plano vazio", async () => {
    const l = await novoLocal();
    const k = await novoContrato(l);
    const { id } = await criarPmoc(admCtx(), { contratoId: k, copiarDoAnterior: false }, deps);
    expect((await abrir(id)).tipos).toEqual([]);
    await expect(
      criarPmoc(admCtx(), { contratoId: k, copiarDoAnterior: false }, deps),
    ).rejects.toMatchObject({ codigo: "JA_EXISTE", message: "Este contrato já tem PMOC." });
    // Duas criações ao mesmo tempo: só uma vence.
    const k2 = await novoContrato(l, "2027-11-01", "2028-10-31");
    const r = await Promise.allSettled([
      criarPmoc(admCtx(), { contratoId: k2, copiarDoAnterior: false }, deps),
      criarPmoc(admCtx(), { contratoId: k2, copiarDoAnterior: false }, deps),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("RN-017 / E-08.5: contrato encerrado não cria PMOC; sem contrato anterior não copia", async () => {
    const l = await novoLocal();
    const encerrado = await novoContrato(l, "2024-01-01", "2024-12-31");
    await expect(
      criarPmoc(admCtx(), { contratoId: encerrado, copiarDoAnterior: false }, deps),
    ).rejects.toMatchObject({ codigo: "ESTADO", message: "Contrato encerrado não emite PMOC." });
    await expect(
      criarPmoc(admCtx(), { contratoId: await novoContrato(l), copiarDoAnterior: true }, deps),
    ).rejects.toMatchObject({ codigo: "VALIDACAO" });
  });

  it("RN-004: copia plano e periodicidades do PMOC anterior, sem as removidas; tipo novo vem da biblioteca", async () => {
    const l = await novoLocal();
    const split = await novoTipo();
    await novoEquipamento(l, split);
    const anterior = await novoContrato(l, "2026-01-01", "2026-12-31");
    const { id: pa } = await criarPmoc(
      admCtx(),
      { contratoId: anterior, copiarDoAnterior: false },
      deps,
    );
    let p = await abrir(pa);
    const tensao = atividade(p, "Tensão") as NonNullable<ReturnType<typeof atividade>>;
    const filtro = atividade(p, "Filtro") as NonNullable<ReturnType<typeof atividade>>;
    await alterarPeriodicidade(
      admCtx(),
      { id: tensao.id, rowVersion: tensao.rowVersion, periodicidade: "MT" },
      deps,
    );
    await removerAtividadeDoPlano(admCtx(), { id: filtro.id, rowVersion: filtro.rowVersion }, deps);
    await incluirAtividadeNova(
      admCtx(),
      {
        pmocId: pa,
        tipoId: split.id,
        titulo: "Dreno",
        periodicidade: "MB",
        natureza: "VERIFICACAO",
      },
      deps,
    );
    // O anterior já histórico: o tipo novo do local não entra nele (FL-07 passo 5 só vale para rascunho).
    await owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      await tx`UPDATE pmoc SET status = 'HISTORICO', historic_since = now() WHERE id = ${pa}`;
    });
    const vrf = await novoTipo();
    await novoEquipamento(l, vrf);
    expect(tipo(await abrir(pa), vrf.id)?.atividades).toEqual([]);

    const renovacao = await novoContrato(l, "2027-01-01", "2027-12-31", anterior);
    const { id } = await criarPmoc(
      admCtx(),
      { contratoId: renovacao, copiarDoAnterior: true },
      deps,
    );
    p = await abrir(id);
    expect(p.copiadoDe).toBe(pa);
    expect(tipo(p, split.id)?.atividades.map((a) => [a.titulo, a.periodicidade])).toEqual([
      ["Dreno", "MB"],
      ["Tensão", "MT"],
    ]);
    expect(atividade(p, "Dreno")?.modeloId).toBeNull();
    expect(tipo(p, split.id)?.removidas).toEqual([]);
    expect(tipo(p, vrf.id)?.atividades.map((a) => a.titulo)).toEqual(["Filtro", "Tensão"]);
  });
});

describe("plano (RF-10; TL-120 aba Plano)", () => {
  it("CA-10.1 / RN-026 / RN-003: periodicidade muda só neste PMOC e não toca a biblioteca; CA-10.2 audita", async () => {
    const t = await novoTipo();
    const x = await novoLocal();
    const y = await novoLocal();
    await novoEquipamento(x, t);
    await novoEquipamento(x, t);
    await novoEquipamento(y, t);
    const px = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(x), copiarDoAnterior: false },
        deps,
      )
    ).id;
    const py = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(y), copiarDoAnterior: false },
        deps,
      )
    ).id;

    const a = atividade(await abrir(px), "Tensão") as NonNullable<ReturnType<typeof atividade>>;
    const antes = (await abrir(px)).ocorrenciasPrevistas;
    await alterarPeriodicidade(
      admCtx(),
      { id: a.id, rowVersion: a.rowVersion, periodicidade: "MM" },
      deps,
    );

    const depois = await abrir(px);
    expect(atividade(depois, "Tensão")?.periodicidade).toBe("MM");
    expect(atividade(depois, "Tensão")?.previstos).toHaveLength(12);
    // RN-026: vale para os 2 equipamentos do tipo (2 × (12 − 2) células a mais).
    expect(depois.ocorrenciasPrevistas).toBe(antes + 2 * 10);
    expect(atividade(await abrir(py), "Tensão")?.periodicidade).toBe("MS");
    const tipoLib = await obterTipo(admCtx(), t.id, deps);
    expect(tipoLib?.atividades.find((x) => x.titulo === "Tensão")?.periodicidade).toBe("MS");

    const [log] = await owner`SELECT actor_user_id, old_values->>'periodicity' AS antes,
        new_values->>'periodicity' AS depois, occurred_at FROM audit_log
      WHERE table_name = 'pmoc_activity' AND record_id = ${a.id} AND action = 'UPDATE'
      ORDER BY id DESC LIMIT 1`;
    expect(log).toMatchObject({ actor_user_id: SEED.admUserId, antes: "MS", depois: "MM" });
    expect(log?.occurred_at).toBeInstanceOf(Date);

    // UF-07: versão antiga = conflito.
    await expect(
      alterarPeriodicidade(
        admCtx(),
        { id: a.id, rowVersion: a.rowVersion, periodicidade: "MT" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "ALTERADO_POR_OUTRO" });
  });

  it("CA-08.3: mudar a periodicidade padrão na biblioteca não muda o PMOC já criado", async () => {
    const t = await novoTipo();
    const l = await novoLocal();
    await novoEquipamento(l, t);
    const id = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(l), copiarDoAnterior: false },
        deps,
      )
    ).id;
    const lib = (await obterTipo(admCtx(), t.id, deps))?.atividades.find(
      (a) => a.titulo === "Filtro",
    );
    await atualizarAtividade(
      admCtx(),
      {
        id: t.filtro,
        rowVersion: lib?.rowVersion ?? 1,
        titulo: "Filtro",
        periodicidade: "MA",
        natureza: "VERIFICACAO",
        ordem: 2,
      },
      deps,
    );
    expect(atividade(await abrir(id), "Filtro")?.periodicidade).toBe("MM");
  });

  it("RF-10.3: remover e voltar pela mesma linha (RN-184); incluir da biblioteca e nova", async () => {
    const t = await novoTipo();
    const l = await novoLocal();
    await novoEquipamento(l, t);
    const id = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(l), copiarDoAnterior: false },
        deps,
      )
    ).id;
    const filtro = atividade(await abrir(id), "Filtro") as NonNullable<
      ReturnType<typeof atividade>
    >;

    await removerAtividadeDoPlano(admCtx(), { id: filtro.id, rowVersion: filtro.rowVersion }, deps);
    let p = await abrir(id);
    expect(atividade(p, "Filtro")).toBeUndefined();
    expect(tipo(p, t.id)?.removidas.map((a) => a.id)).toEqual([filtro.id]);
    expect(p.ocorrenciasPrevistas).toBe(2); // só Tensão MS
    const [r] = await owner`SELECT removed_by_user_id FROM pmoc_activity WHERE id = ${filtro.id}`;
    expect(r?.removed_by_user_id).toBe(SEED.admUserId);
    // A atividade da biblioteca com linha removida não aparece como "disponível".
    expect(tipo(p, t.id)?.disponiveis).toEqual([]);

    const removida = tipo(p, t.id)?.removidas[0];
    await restaurarAtividadeDoPlano(
      admCtx(),
      { id: filtro.id, rowVersion: removida?.rowVersion ?? 0 },
      deps,
    );
    expect(atividade(await abrir(id), "Filtro")?.id).toBe(filtro.id);

    // Atividade criada na biblioteca depois do rascunho: disponível para incluir, uma vez só.
    const nova = await incluirAtividade(
      admCtx(),
      { tipoId: t.id, titulo: "Dreno", periodicidade: "MT", natureza: "VERIFICACAO", ordem: 4 },
      deps,
    );
    p = await abrir(id);
    expect(tipo(p, t.id)?.disponiveis.map((d) => d.id)).toEqual([nova.id]);
    await incluirAtividadeDaBiblioteca(admCtx(), { pmocId: id, modeloId: nova.id }, deps);
    expect(atividade(await abrir(id), "Dreno")).toMatchObject({
      periodicidade: "MT",
      modeloId: nova.id,
    });
    await expect(
      incluirAtividadeDaBiblioteca(admCtx(), { pmocId: id, modeloId: nova.id }, deps),
    ).rejects.toMatchObject({ codigo: "VALIDACAO" });

    // Nova só deste PMOC: medição exige unidade (RN-042); título repetido no tipo é recusado.
    const base = { pmocId: id, tipoId: t.id, periodicidade: "MS" as const };
    await expect(
      incluirAtividadeNova(admCtx(), { ...base, titulo: "Pressão", natureza: "MEDICAO" }, deps),
    ).rejects.toMatchObject({ codigo: "VALIDACAO", campo: "unidade" });
    await expect(
      incluirAtividadeNova(
        admCtx(),
        { ...base, titulo: " filtro ", natureza: "VERIFICACAO" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "VALIDACAO", campo: "titulo" });
    await incluirAtividadeNova(
      admCtx(),
      { ...base, titulo: "Pressão", natureza: "MEDICAO", unidade: "psi", exigeFoto: true },
      deps,
    );
    expect(atividade(await abrir(id), "Pressão")).toMatchObject({
      modeloId: null,
      unidade: "psi",
      exigeFoto: true,
      ordem: 5,
    });
    // Tipo fora do PMOC.
    const outro = await novoTipo();
    await expect(
      incluirAtividadeNova(
        admCtx(),
        { ...base, tipoId: outro.id, titulo: "X", natureza: "VERIFICACAO" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "VALIDACAO", campo: "tipoId" });
  });

  it("RN-146: histórico é somente leitura; emitido espera o recálculo pós-emissão (FL-09)", async () => {
    const t = await novoTipo();
    const l = await novoLocal();
    await novoEquipamento(l, t);
    const id = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(l), copiarDoAnterior: false },
        deps,
      )
    ).id;
    const a = atividade(await abrir(id), "Filtro") as NonNullable<ReturnType<typeof atividade>>;
    const mudar = () =>
      alterarPeriodicidade(
        admCtx(),
        { id: a.id, rowVersion: a.rowVersion, periodicidade: "MT" },
        deps,
      );

    await owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      await tx`UPDATE pmoc SET status = 'EMITIDO', current_version_number = 1, first_issued_at = now()
        WHERE id = ${id}`;
    });
    await expect(mudar()).rejects.toMatchObject({ codigo: "NAO_DISPONIVEL" });
    expect((await abrir(id)).podeAlterarPlano).toBe(false);

    await owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      await tx`UPDATE pmoc SET status = 'HISTORICO', historic_since = now() WHERE id = ${id}`;
    });
    await expect(mudar()).rejects.toMatchObject({
      codigo: "ESTADO",
      message: "PMOC histórico: somente leitura.",
    });
  });
});

describe("equipamentos com PMOC em rascunho (FL-07 passo 5; RN-006)", () => {
  it("incluir equipamento de tipo novo inclui o tipo no plano; tipo já no plano não muda", async () => {
    const t = await novoTipo();
    const l = await novoLocal();
    const e = await novoEquipamento(l, t);
    const id = (
      await criarPmoc(
        admCtx(),
        { contratoId: await novoContrato(l), copiarDoAnterior: false },
        deps,
      )
    ).id;
    const filtro = atividade(await abrir(id), "Filtro") as NonNullable<
      ReturnType<typeof atividade>
    >;
    await removerAtividadeDoPlano(admCtx(), { id: filtro.id, rowVersion: filtro.rowVersion }, deps);

    await novoEquipamento(l, t); // mesmo tipo: a remoção do ADM vale
    const novo = await novoTipo();
    const outro = await novoEquipamento(l, novo);
    let p = await abrir(id);
    expect(tipo(p, t.id)?.atividades.map((a) => a.titulo)).toEqual(["Tensão"]);
    expect(tipo(p, novo.id)?.atividades.map((a) => a.titulo)).toEqual(["Filtro", "Tensão"]);

    // Inativar entra na pré-visualização na hora (RN-006); reativar não duplica.
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: outro.id, rowVersion: 1, situacao: "INATIVO" },
      deps,
    );
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: e.id, rowVersion: 1, situacao: "INATIVO" },
      deps,
    );
    p = await abrir(id);
    expect(tipo(p, novo.id)?.equipamentosAtivos).toBe(0);
    expect(p.ocorrenciasPrevistas).toBe(2); // 1 Split ativo × Tensão MS
    await alterarSituacaoEquipamento(
      admCtx(),
      { id: outro.id, rowVersion: 2, situacao: "ATIVO" },
      deps,
    );
    expect(tipo(await abrir(id), novo.id)?.atividades).toHaveLength(2);
  });
});

describe("permissões e isolamento (RN-147, RN-162, RN-168)", () => {
  it("só o ADM cria e altera; cliente e técnico não veem o rascunho (404)", async () => {
    const l = await novoLocal(); // cliente novo: o isolamento conta os locais da semente
    // RN-147: o rascunho do próprio cliente (PMOC A da semente) também não aparece para ele.
    expect(await obterPmoc(clientCtx("A"), SEED.pmocAId, deps)).toBeNull();
    expect((await obterPmoc(admCtx(), SEED.pmocAId, deps))?.situacao).toBe("RASCUNHO");
    const t = await novoTipo();
    await novoEquipamento(l, t);
    const k = await novoContrato(l, "2030-01-01", "2030-12-31");
    for (const ctx of [technicianCtx(), clientCtx("A")]) {
      expect(
        await failureText(criarPmoc(ctx, { contratoId: k, copiarDoAnterior: false }, deps)),
      ).toMatch(/Sem permissão/);
    }
    const id = (await criarPmoc(admCtx(), { contratoId: k, copiarDoAnterior: false }, deps)).id;
    const a = atividade(await abrir(id), "Filtro") as NonNullable<ReturnType<typeof atividade>>;
    for (const ctx of [technicianCtx(), clientCtx("A"), clientCtx("B")]) {
      expect(await obterPmoc(ctx, id, deps)).toBeNull();
      await expect(
        alterarPeriodicidade(
          ctx,
          { id: a.id, rowVersion: a.rowVersion, periodicidade: "MT" },
          deps,
        ),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        removerAtividadeDoPlano(ctx, { id: a.id, rowVersion: a.rowVersion }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
    expect(await obterPmoc(admCtx(), randomUUID(), deps)).toBeNull();
    expect(await obterPmoc(admCtx(), "nao-e-uuid", deps)).toBeNull();
  });
});
