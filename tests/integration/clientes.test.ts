/**
 * Etapa 3 – clientes e locais (RF-05, RF-06; FL-04; TL-108 a TL-110). CA-05.1 a CA-05.4, CA-06.1,
 * CA-06.2, E-04.1 a E-04.7, DM-19, EL-7 e isolamento (RN-162; SEG-25).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  atualizarCliente,
  atualizarLocal,
  criarCliente,
  criarLocal,
  excluirCliente,
  excluirLocal,
  listarClientes,
  obterCliente,
  obterLocal,
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

/** CNPJ numérico válido aleatório (mesmo cálculo de `is_valid_cnpj`). */
function gerarCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((a, p, i) => a + Number(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

const endereco = {
  logradouro: "Rua das Flores",
  numero: "100",
  semNumero: false,
  cidade: "Florianópolis",
  uf: "SC" as const,
  cep: "88020-300",
};

const dadosCliente = (extra: Record<string, unknown> = {}) => ({
  razaoSocial: `Clínica ${randomUUID().slice(0, 8)} Ltda`,
  cnpj: gerarCnpj(),
  endereco,
  ...extra,
});

async function novoCliente(extra: Record<string, unknown> = {}) {
  const d = dadosCliente(extra);
  const { id } = await criarCliente(admCtx(), d, deps);
  return { id, ...d };
}

describe("cliente (RF-05; E-04.1 a E-04.4)", () => {
  it("grava CNPJ, CEP e telefones sem máscara; auditado", async () => {
    const d = dadosCliente({ telefone1: "(48) 3333-4444", nomeFantasia: "  " });
    const cnpjMascarado = `${d.cnpj.slice(0, 2)}.${d.cnpj.slice(2, 5)}.${d.cnpj.slice(5, 8)}/${d.cnpj.slice(8, 12)}-${d.cnpj.slice(12)}`;
    const { id } = await criarCliente(admCtx(), { ...d, cnpj: cnpjMascarado }, deps);
    const c = (await obterCliente(admCtx(), id, deps))?.cliente;
    expect(c).toMatchObject({
      cnpj: d.cnpj,
      telefone1: "4833334444",
      telefone2: null,
      nomeFantasia: null,
      endereco: { cep: "88020300", numero: "100", semNumero: false },
    });
    const [n] = await owner`SELECT count(*)::int AS n FROM audit_log
      WHERE table_name = 'client' AND record_id = ${id} AND action = 'INSERT'`;
    expect(n?.n).toBe(1);
  });

  it("CA-05.1, CA-05.2, CA-05.3: CNPJ de 13 dígitos, CPF e CEP de 7 dígitos são recusados", async () => {
    await expect(
      criarCliente(admCtx(), dadosCliente({ cnpj: "28.474.019/0001-9" }), deps),
    ).rejects.toThrow(/CNPJ inválido/);
    await expect(
      criarCliente(admCtx(), dadosCliente({ cnpj: "529.982.247-25" }), deps),
    ).rejects.toThrow(/CNPJ inválido/);
    await expect(
      criarCliente(admCtx(), dadosCliente({ endereco: { ...endereco, cep: "88.020-30" } }), deps),
    ).rejects.toThrow(/8 dígitos/);
  });

  it("CA-05.4: s/n sem número", async () => {
    const c = await novoCliente({ endereco: { ...endereco, numero: "", semNumero: true } });
    const r = (await obterCliente(admCtx(), c.id, deps))?.cliente;
    expect(r?.endereco).toMatchObject({ numero: null, semNumero: true });
  });

  it("E-04.2: CNPJ repetido mostra a razão social e o id do existente", async () => {
    const c = await novoCliente();
    await expect(
      criarCliente(admCtx(), dadosCliente({ cnpj: c.cnpj }), deps),
    ).rejects.toMatchObject({ codigo: "CNPJ_EM_USO", campo: "cnpj", existenteId: c.id });
  });

  it("E-04.4: telefone 2 sem o 1, ou igual ao 1, é recusado", async () => {
    await expect(
      criarCliente(admCtx(), dadosCliente({ telefone2: "4833334444" }), deps),
    ).rejects.toThrow(/telefone 1 antes/);
    await expect(
      criarCliente(
        admCtx(),
        dadosCliente({ telefone1: "4833334444", telefone2: "(48) 3333-4444" }),
        deps,
      ),
    ).rejects.toThrow(/repete/);
  });

  it("edita com row_version; versão antiga é recusada (UF-07)", async () => {
    const c = await novoCliente();
    const a = (await obterCliente(admCtx(), c.id, deps))?.cliente;
    await atualizarCliente(
      admCtx(),
      { ...c, id: c.id, rowVersion: a?.rowVersion ?? 1, nomeFantasia: "Fantasia" },
      deps,
    );
    expect((await obterCliente(admCtx(), c.id, deps))?.cliente.nomeFantasia).toBe("Fantasia");
    await expect(
      atualizarCliente(admCtx(), { ...c, id: c.id, rowVersion: a?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "ALTERADO_POR_OUTRO" });
  });

  it("lista com busca por razão social, nome fantasia ou CNPJ (com ou sem máscara)", async () => {
    const fantasia = `Fantasia ${randomUUID().slice(0, 6)}`;
    const c = await novoCliente({ nomeFantasia: fantasia });
    const porNome = await listarClientes(admCtx(), { busca: c.razaoSocial.slice(0, 15) }, deps);
    expect(porNome.linhas.map((l) => l.id)).toContain(c.id);
    const porFantasia = await listarClientes(admCtx(), { busca: fantasia }, deps);
    expect(porFantasia.linhas.map((l) => l.id)).toEqual([c.id]);
    const porCnpj = await listarClientes(
      admCtx(),
      { busca: `${c.cnpj.slice(0, 2)}.${c.cnpj.slice(2, 5)}.${c.cnpj.slice(5, 8)}` },
      deps,
    );
    expect(porCnpj.linhas.map((l) => l.id)).toContain(c.id);
    expect((await listarClientes(admCtx(), { busca: "100%_" }, deps)).linhas).toEqual([]);
  });
});

describe("local (RF-06; DM-19; CA-06.1, CA-06.2)", () => {
  const dadosLocal = { nome: "Unidade Centro", endereco };

  it("código gerado pelo sistema, distinto por local, e mostrado ao salvar", async () => {
    const c = await novoCliente();
    const a = await criarLocal(admCtx(), { clienteId: c.id, ...dadosLocal }, deps);
    const b = await criarLocal(admCtx(), { clienteId: c.id, ...dadosLocal, nome: "Filial" }, deps);
    expect(a.codigo).toMatch(/^L\d{3,}$/);
    expect(b.codigo).not.toBe(a.codigo);
    // o seed usa L001 e L002 fixos: a sequência pula os códigos já usados
    expect(["L001", "L002"]).not.toContain(a.codigo);
    const l = await obterLocal(admCtx(), a.id, deps);
    expect(l).toMatchObject({
      codigo: a.codigo,
      clienteId: c.id,
      clienteRazaoSocial: c.razaoSocial,
    });
    const locais = (await obterCliente(admCtx(), c.id, deps))?.locais;
    expect(locais?.map((x) => x.codigo)).toEqual([a.codigo, b.codigo].sort());
  });

  it("CA-06.2: o código não muda (trigger), mesmo por fora do serviço", async () => {
    await expect(
      owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await tx`UPDATE site SET code = 'L999' WHERE id = ${SEED.siteAId}`;
      }),
    ).rejects.toThrow(/imutável/);
  });

  it("edita nome, telefone e endereço com row_version", async () => {
    const c = await novoCliente();
    const { id } = await criarLocal(admCtx(), { clienteId: c.id, ...dadosLocal }, deps);
    const l = await obterLocal(admCtx(), id, deps);
    await atualizarLocal(
      admCtx(),
      { id, rowVersion: l?.rowVersion ?? 1, nome: "Novo nome", telefone: "48999998888", endereco },
      deps,
    );
    expect(await obterLocal(admCtx(), id, deps)).toMatchObject({
      nome: "Novo nome",
      telefone: "48999998888",
      codigo: l?.codigo,
    });
  });
});

describe("excluir sem cascata (E-04.7; EL-7)", () => {
  it("cliente com local vivo não é excluído; depois de excluir o local, é", async () => {
    const c = await novoCliente();
    const { id: localId } = await criarLocal(
      admCtx(),
      { clienteId: c.id, nome: "Único", endereco },
      deps,
    );
    const r = await obterCliente(admCtx(), c.id, deps);
    expect(r?.cliente.temLocalVivo).toBe(true);
    await expect(
      excluirCliente(admCtx(), { id: c.id, rowVersion: r?.cliente.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "TEM_FILHOS" });
    const l = await obterLocal(admCtx(), localId, deps);
    await excluirLocal(
      admCtx(),
      { id: localId, rowVersion: l?.rowVersion ?? 1, motivo: "duplicado" },
      deps,
    );
    expect(await obterLocal(admCtx(), localId, deps)).toBeNull();
    await excluirCliente(admCtx(), { id: c.id, rowVersion: r?.cliente.rowVersion ?? 1 }, deps);
    expect(await obterCliente(admCtx(), c.id, deps)).toBeNull();
    const [x] = await owner`SELECT deletion_reason FROM site WHERE id = ${localId}`;
    expect(x?.deletion_reason).toBe("duplicado");
    // excluído libera o CNPJ (UNIQUE só entre vivos)
    await criarCliente(admCtx(), dadosCliente({ cnpj: c.cnpj }), deps);
  });

  it("local com contrato ou equipamento vivo não é excluído", async () => {
    const l = await obterLocal(admCtx(), SEED.siteAId, deps);
    expect(l).toMatchObject({ temContratoVivo: true, temEquipamentoVivo: true });
    await expect(
      excluirLocal(admCtx(), { id: SEED.siteAId, rowVersion: l?.rowVersion ?? 1 }, deps),
    ).rejects.toMatchObject({ codigo: "TEM_FILHOS" });
  });
});

describe("isolamento (RN-162; SEG-25)", () => {
  it("CLIENTE vê o próprio cliente e local; o de outro é como inexistente", async () => {
    expect((await obterCliente(clientCtx("A"), SEED.clientAId, deps))?.cliente.id).toBe(
      SEED.clientAId,
    );
    expect(await obterCliente(clientCtx("A"), SEED.clientBId, deps)).toBeNull();
    expect((await obterLocal(clientCtx("A"), SEED.siteAId, deps))?.id).toBe(SEED.siteAId);
    expect(await obterLocal(clientCtx("A"), SEED.siteBId, deps)).toBeNull();
  });

  it("TECNICO não lê cadastro; CLIENTE e TECNICO não listam nem alteram", async () => {
    expect(await obterCliente(technicianCtx(), SEED.clientAId, deps)).toBeNull();
    expect(await obterLocal(technicianCtx(), SEED.siteAId, deps)).toBeNull();
    for (const ctx of [clientCtx("A"), technicianCtx()]) {
      await expect(listarClientes(ctx, {}, deps)).rejects.toMatchObject({
        codigo: "SEM_PERMISSAO",
      });
      await expect(criarCliente(ctx, dadosCliente(), deps)).rejects.toMatchObject({
        codigo: "SEM_PERMISSAO",
      });
      await expect(
        criarLocal(ctx, { clienteId: SEED.clientAId, nome: "X", endereco }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
      await expect(
        excluirLocal(ctx, { id: SEED.siteAId, rowVersion: 1 }, deps),
      ).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
  });

  it("id inexistente ou malformado vira não encontrado", async () => {
    expect(await obterCliente(admCtx(), "x", deps)).toBeNull();
    expect(await obterLocal(admCtx(), randomUUID(), deps)).toBeNull();
    await expect(
      criarLocal(admCtx(), { clienteId: randomUUID(), nome: "X", endereco }, deps),
    ).rejects.toMatchObject({ codigo: "NAO_ENCONTRADO" });
  });
});
