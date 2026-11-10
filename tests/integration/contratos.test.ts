/**
 * Etapa 3 – contratos (RF-07, RF-15; FL-06; TL-112). RN-014, RN-022, RN-142 a RN-145, RN-176, RN-192;
 * CA-07.1, CA-07.2; E-06.1 a E-06.4, E-06.7; isolamento (RN-162; SEG-25).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  atualizarContrato,
  cancelarContrato,
  confirmarRenovacao,
  criarCliente,
  criarContrato,
  criarLocal,
  excluirContrato,
  excluirLocal,
  listarContratosDoLocal,
  obterContrato,
  obterLocal,
  sugestaoDeRenovacao,
} from "../../src/modules/clientes";
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

/** Relógio fixo dos testes (MOD-06): 10/11/2026, meio-dia em São Paulo. */
const AGORA = new Date("2026-11-10T15:00:00Z");

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

/** Local novo (cliente novo) para cada teste: contratos não se misturam. */
async function novoLocal(): Promise<string> {
  const { id } = await criarCliente(
    admCtx(),
    { razaoSocial: `Cliente ${randomUUID().slice(0, 8)}`, cnpj: gerarCnpj(), endereco },
    deps,
  );
  return (await criarLocal(admCtx(), { clienteId: id, nome: "Unidade", endereco }, deps)).id;
}

const contrato = (localId: string, inicio: string, fim: string, extra = {}) => ({
  localId,
  inicio,
  fim,
  art: "ART-123",
  ...extra,
});

async function novoContrato(localId: string, inicio: string, fim: string, extra = {}) {
  const { id } = await criarContrato(admCtx(), contrato(localId, inicio, fim, extra), deps, AGORA);
  return (await obterContrato(admCtx(), id, deps)) as NonNullable<
    Awaited<ReturnType<typeof obterContrato>>
  >;
}

/** PMOC do contrato direto no banco (a criação pela tela é da Etapa 4). */
async function criarPmoc(contratoId: string, emitido: boolean) {
  await owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    await tx`INSERT INTO pmoc (contract_id, status, current_version_number, first_issued_at)
      VALUES (${contratoId}, ${emitido ? "EMITIDO" : "RASCUNHO"}, ${emitido ? 1 : null},
        ${emitido ? new Date() : null})`;
  });
}
const pmocDe = async (contratoId: string) =>
  (await owner`SELECT status, historic_since FROM pmoc WHERE contract_id = ${contratoId}`)[0];

describe("criar e editar (RF-07; RN-022, RN-142, RN-176; E-06.1, E-06.3)", () => {
  it("estado pelas datas no fuso de São Paulo e nº de meses calculado; auditado", async () => {
    const l = await novoLocal();
    const vigente = await novoContrato(l, "2026-01-15", "2027-01-14", {
      th: "TH12326",
      revisao: "R1",
    });
    expect(vigente).toMatchObject({ situacao: "VIGENTE", meses: 13, th: "TH12326", revisao: "R1" });
    const futuro = await novoContrato(l, "2027-01-15", "2027-12-31");
    expect(futuro.situacao).toBe("A_INICIAR");
    const l2 = await novoLocal();
    expect((await novoContrato(l2, "2025-01-01", "2025-12-31")).situacao).toBe("ENCERRADO");
    const [n] = await owner`SELECT count(*)::int AS n FROM audit_log
      WHERE table_name = 'contract' AND record_id = ${vigente.id} AND action = 'INSERT'`;
    expect(n?.n).toBe(1);
  });

  it("CA-07.2 / E-06.3: sem ART bloqueia; E-06.1: fim não depois do início bloqueia", async () => {
    const l = await novoLocal();
    await expect(
      criarContrato(admCtx(), contrato(l, "2027-01-01", "2027-12-31", { art: "  " }), deps, AGORA),
    ).rejects.toThrow(/Informe o nº da ART/);
    await expect(
      criarContrato(admCtx(), contrato(l, "2027-01-01", "2027-01-01"), deps, AGORA),
    ).rejects.toThrow(/depois da de início/);
    await expect(
      criarContrato(admCtx(), contrato(l, "2027-02-30", "2027-12-31"), deps, AGORA),
    ).rejects.toThrow(/data de início/);
  });

  it("CA-07.1 / E-06.2: período sobreposto é recusado com as datas; adjacente e cancelado não bloqueiam", async () => {
    const l = await novoLocal();
    const a = await novoContrato(l, "2026-08-01", "2027-07-30");
    await expect(
      criarContrato(admCtx(), contrato(l, "2027-06-01", "2028-05-31"), deps, AGORA),
    ).rejects.toMatchObject({
      codigo: "SOBREPOSICAO",
      campo: "fim",
      message: "Período sobrepõe o contrato 01/08/2026–30/07/2027.",
    });
    await novoContrato(l, "2027-07-31", "2028-07-30");
    // cancelado sai da regra (EXCLUDE ... WHERE status <> 'CANCELADO')
    await cancelarContrato(
      admCtx(),
      { id: a.id, rowVersion: a.rowVersion, data: "2026-11-10", motivo: "encerrado pelo cliente" },
      deps,
    );
    await novoContrato(l, "2026-12-01", "2027-07-01");
  });

  it("edita ART, TH e datas com row_version e recalcula o estado; versão antiga é recusada", async () => {
    const l = await novoLocal();
    const c = await novoContrato(l, "2027-01-01", "2027-12-31");
    await atualizarContrato(
      admCtx(),
      { id: c.id, rowVersion: c.rowVersion, inicio: "2026-11-01", fim: "2027-10-31", art: "ART-9" },
      deps,
      AGORA,
    );
    expect(await obterContrato(admCtx(), c.id, deps)).toMatchObject({
      situacao: "VIGENTE",
      art: "ART-9",
      meses: 12,
    });
    await expect(
      atualizarContrato(
        admCtx(),
        { id: c.id, rowVersion: c.rowVersion, inicio: c.inicio, fim: c.fim, art: "X" },
        deps,
        AGORA,
      ),
    ).rejects.toMatchObject({ codigo: "ALTERADO_POR_OUTRO" });
  });
});

describe("datas travadas após a emissão (RN-145; E-06.4)", () => {
  it("com PMOC emitido, datas não mudam (serviço e trigger); ART muda; cancelar ainda não", async () => {
    const l = await novoLocal();
    const c = await novoContrato(l, "2026-06-01", "2027-05-31");
    await criarPmoc(c.id, true);
    const x = await obterContrato(admCtx(), c.id, deps);
    expect(x?.pmocEmitido).toBe(true);
    await expect(
      atualizarContrato(
        admCtx(),
        { id: c.id, rowVersion: x?.rowVersion ?? 1, inicio: "2026-07-01", fim: c.fim, art: "A" },
        deps,
        AGORA,
      ),
    ).rejects.toMatchObject({ codigo: "DATAS_TRAVADAS" });
    await expect(
      owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await tx`UPDATE contract SET end_date = '2027-06-30' WHERE id = ${c.id}`;
      }),
    ).rejects.toThrow(/travadas/);
    await atualizarContrato(
      admCtx(),
      { id: c.id, rowVersion: x?.rowVersion ?? 1, inicio: c.inicio, fim: c.fim, art: "ART-NOVA" },
      deps,
      AGORA,
    );
    const y = await obterContrato(admCtx(), c.id, deps);
    expect(y?.art).toBe("ART-NOVA");
    await expect(
      cancelarContrato(
        admCtx(),
        { id: c.id, rowVersion: y?.rowVersion ?? 1, data: "2026-11-10", motivo: "x" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "NAO_DISPONIVEL" });
  });
});

describe("cancelar (RN-144; RN-014; E-06.7)", () => {
  it("data entre início e fim e motivo obrigatórios; PMOC → HISTORICO; depois tudo só leitura", async () => {
    const l = await novoLocal();
    const c = await novoContrato(l, "2026-06-01", "2027-05-31");
    await criarPmoc(c.id, false);
    const base = { id: c.id, rowVersion: c.rowVersion };
    await expect(
      cancelarContrato(admCtx(), { ...base, data: "2026-05-31", motivo: "x" }, deps),
    ).rejects.toMatchObject({ codigo: "VALIDACAO", campo: "data" });
    await expect(
      cancelarContrato(admCtx(), { ...base, data: "2026-11-10", motivo: " " }, deps),
    ).rejects.toThrow(/motivo/);
    await cancelarContrato(
      admCtx(),
      { ...base, data: "2026-11-10", motivo: "Venda do imóvel" },
      deps,
    );
    const x = await obterContrato(admCtx(), c.id, deps);
    expect(x).toMatchObject({
      situacao: "CANCELADO",
      canceladoEm: "2026-11-10",
      motivoCancelamento: "Venda do imóvel",
      podeCancelar: false,
      podeRenovar: false,
      podeExcluir: false,
    });
    // RN-014 / A5: PMOC em rascunho também vira histórico (CHECK corrigido na 0012)
    const p = await pmocDe(c.id);
    expect(p?.status).toBe("HISTORICO");
    expect(p?.historic_since).not.toBeNull();
    // E-06.7: estado final
    await expect(
      atualizarContrato(
        admCtx(),
        { id: c.id, rowVersion: x?.rowVersion ?? 1, inicio: c.inicio, fim: c.fim, art: "Z" },
        deps,
        AGORA,
      ),
    ).rejects.toMatchObject({ codigo: "ESTADO" });
    await expect(
      owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await tx`UPDATE contract SET art_number = 'Z' WHERE id = ${c.id}`;
      }),
    ).rejects.toThrow(/cancelado não pode ser alterado/);
  });

  it("ENCERRADO não pode ser cancelado (decisão R2 2.6)", async () => {
    const l = await novoLocal();
    const c = await novoContrato(l, "2025-01-01", "2025-12-31");
    await expect(
      cancelarContrato(
        admCtx(),
        { id: c.id, rowVersion: c.rowVersion, data: "2025-06-01", motivo: "x" },
        deps,
      ),
    ).rejects.toMatchObject({ codigo: "ESTADO" });
  });
});

describe("renovar e confirmar renovação (RF-15; RN-192; FL-06)", () => {
  it("sugere o dia seguinte; o novo aponta o anterior; confirmar grava quem e põe o PMOC anterior em HISTORICO", async () => {
    const l = await novoLocal();
    const a = await novoContrato(l, "2026-01-01", "2026-12-31");
    await criarPmoc(a.id, false);
    expect(a.podeRenovar).toBe(true);
    const s = await sugestaoDeRenovacao(admCtx(), a.id, deps);
    expect(s).toEqual({ localId: l, anteriorId: a.id, inicio: "2027-01-01" });
    const n = await novoContrato(l, "2027-01-01", "2027-12-31", { anteriorId: a.id });
    expect(n).toMatchObject({
      anteriorId: a.id,
      anteriorInicio: "2026-01-01",
      podeConfirmarRenovacao: true,
    });
    // salvar o contrato novo NÃO confirma a renovação
    expect((await pmocDe(a.id))?.status).toBe("RASCUNHO");
    // o anterior não renova de novo (já tem posterior)
    expect((await obterContrato(admCtx(), a.id, deps))?.podeRenovar).toBe(false);
    expect(await sugestaoDeRenovacao(admCtx(), a.id, deps)).toBeNull();

    await confirmarRenovacao(admCtx(), { id: n.id, rowVersion: n.rowVersion }, deps);
    const x = await obterContrato(admCtx(), n.id, deps);
    expect(x?.renovacaoConfirmadaEm).toBeInstanceOf(Date);
    expect(x?.renovacaoConfirmadaPor).toBe("Ana Administradora");
    expect(x?.podeConfirmarRenovacao).toBe(false);
    expect((await pmocDe(a.id))?.status).toBe("HISTORICO");
    await expect(
      confirmarRenovacao(admCtx(), { id: n.id, rowVersion: x?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "ESTADO" });
  });

  it("contrato A_INICIAR ou de outro local não serve de anterior", async () => {
    const l = await novoLocal();
    const futuro = await novoContrato(l, "2027-01-01", "2027-12-31");
    await expect(
      criarContrato(
        admCtx(),
        contrato(l, "2028-01-01", "2028-12-31", { anteriorId: futuro.id }),
        deps,
        AGORA,
      ),
    ).rejects.toMatchObject({ codigo: "ESTADO" });
    const outro = await novoLocal();
    const vig = await novoContrato(outro, "2026-01-01", "2026-12-31");
    await expect(
      criarContrato(
        admCtx(),
        contrato(l, "2028-01-01", "2028-12-31", { anteriorId: vig.id }),
        deps,
        AGORA,
      ),
    ).rejects.toMatchObject({ codigo: "ESTADO" });
  });
});

describe("excluir (TL-112; E-04.7)", () => {
  it("sem PMOC exclui; com PMOC não; local com contrato vivo não é excluído", async () => {
    const l = await novoLocal();
    const c = await novoContrato(l, "2027-01-01", "2027-12-31");
    const lc = await obterLocal(admCtx(), l, deps);
    await expect(
      excluirLocal(admCtx(), { id: l, rowVersion: lc?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "TEM_FILHOS" });
    const com = await novoContrato(l, "2028-01-01", "2028-12-31");
    await criarPmoc(com.id, false);
    await expect(
      excluirContrato(admCtx(), { id: com.id, rowVersion: com.rowVersion }, deps),
    ).rejects.toMatchObject({ codigo: "TEM_FILHOS" });
    expect(await excluirContrato(admCtx(), { id: c.id, rowVersion: c.rowVersion }, deps)).toEqual({
      localId: l,
    });
    expect(await obterContrato(admCtx(), c.id, deps)).toBeNull();
    expect((await listarContratosDoLocal(admCtx(), l, deps))?.map((x) => x.id)).toEqual([com.id]);
  });
});

describe("isolamento (RN-162; SEG-25)", () => {
  it("CLIENTE vê os contratos do próprio local; os de outro cliente são inexistentes", async () => {
    expect((await obterContrato(clientCtx("A"), SEED.contractAId, deps))?.id).toBe(
      SEED.contractAId,
    );
    expect(await obterContrato(clientCtx("A"), SEED.contractBId, deps)).toBeNull();
    expect(await listarContratosDoLocal(clientCtx("A"), SEED.siteBId, deps)).toBeNull();
    expect((await listarContratosDoLocal(clientCtx("A"), SEED.siteAId, deps))?.length).toBe(1);
  });

  it("TECNICO não lê; CLIENTE e TECNICO não criam, alteram, cancelam nem confirmam", async () => {
    expect(await obterContrato(technicianCtx(), SEED.contractAId, deps)).toBeNull();
    for (const ctx of [clientCtx("A"), technicianCtx()]) {
      await expect(
        criarContrato(ctx, contrato(SEED.siteAId, "2030-01-01", "2030-12-31"), deps, AGORA),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        cancelarContrato(
          ctx,
          { id: SEED.contractAId, rowVersion: 1, data: "2026-11-10", motivo: "x" },
          deps,
        ),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        confirmarRenovacao(ctx, { id: SEED.contractAId, rowVersion: 1 }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        excluirContrato(ctx, { id: SEED.contractAId, rowVersion: 1 }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
  });
});
