/**
 * Preparação comum a testes que precisam de PMOC emitido de verdade: banco próprio migrado do zero,
 * empresa, RT e certificado A1 de teste (FL-02), tipos com atividades e local com equipamentos.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { inject } from "vitest";
import { runMigrations } from "../../db/migrate";
import { prepararEnvio } from "../../src/modules/arquivos";
import type { Periodicidade } from "../../src/modules/biblioteca";
import { criarTipo, incluirAtividade, obterTipo } from "../../src/modules/biblioteca";
import { criarCliente, criarContrato, criarLocal } from "../../src/modules/clientes";
import {
  type EmpresaDeps,
  enviarCertificado,
  salvarEmpresa,
  salvarRt,
} from "../../src/modules/empresa";
import { criarEquipamento } from "../../src/modules/equipamentos";
import { criarPmoc, type EmissaoDeps, emitirPmoc, obterPmoc } from "../../src/modules/pmoc";
import { chaveDeBase64 } from "../../src/server/crypto";
import { createDatabase, type Database } from "../../src/server/db";
import { assinarPdfComA1 } from "../../src/server/pdf/assinar";
import { gerarPdfPmoc } from "../../src/server/pdf/pmoc";
import { armazenamentoLocal } from "../../src/server/storage";
import { gerarPkcs12 } from "../fixtures/certificado";
import { admCtx } from "./helpers";

const SEGREDO = "segredo-de-teste";

export const ENDERECO = {
  logradouro: "Rua das Palmeiras",
  numero: "100",
  semNumero: false,
  bairro: "Centro",
  cidade: "Joinville",
  uf: "SC" as const,
  cep: "89201000",
};

export function gerarCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((a, p, i) => a + Number(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${dv(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export interface AmbienteDeEmissao {
  db: Database;
  /** Dono do esquema: lê e ajusta o banco por fora das regras da aplicação. */
  owner: postgres.Sql;
  deps: { db: Database };
  emissao: EmissaoDeps;
  /** Executa como dono, com `app.source = SISTEMA` (gatilhos de auditoria e contexto). */
  comoSistema<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T>;
  /** Usuário direto pelo dono (a criação de usuário tem o próprio teste, Etapa 2). */
  usuario(papel: "CLIENTE" | "TECNICO", clienteId?: string): Promise<string>;
  /** Tipo com um grupo e as atividades pedidas. */
  novoTipo(
    sigla: string,
    periodicidades: Periodicidade[],
  ): Promise<{ id: string; grupoId: string }>;
  /** Cliente, local com os equipamentos pedidos, contrato de 12 meses e PMOC em `RASCUNHO`. */
  cenario(
    equipamentos: { id: string; grupoId: string }[],
    contrato?: { inicio: string; fim: string },
  ): Promise<{ clienteId: string; localId: string; pmocId: string; equipamentos: string[] }>;
  emitir(pmocId: string): ReturnType<typeof emitirPmoc>;
  encerrar(): Promise<void>;
}

export async function prepararEmissao(nomeDb: string, agora: Date): Promise<AmbienteDeEmissao> {
  const trocarDb = (url: string) => {
    const u = new URL(url);
    u.pathname = `/${nomeDb}`;
    return u.toString();
  };
  const admin = postgres(inject("dbAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${nomeDb}`);
  await admin.unsafe(`CREATE DATABASE ${nomeDb}`);
  await runMigrations({
    adminUrl: trocarDb(inject("dbAdminUrl")),
    ownerUrl: trocarDb(inject("dbOwnerUrl")),
  });
  const db = createDatabase(trocarDb(inject("dbAppUrl")), { max: 4 });
  const owner = postgres(trocarDb(inject("dbOwnerUrl")), { max: 2, onnotice: () => {} });
  const comoSistema = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      return fn(tx);
    }) as Promise<T>;

  await comoSistema(async (tx) => {
    await tx`INSERT INTO auth_user (id, name, email) VALUES ('auth-adm', 'ADM Teste', 'adm@teste.test')`;
    await tx`INSERT INTO app_user (id, name, email, auth_user_id, role)
      VALUES (${admCtx().userId}, 'ADM Teste', 'adm@teste.test', 'auth-adm', 'ADM')`;
  });
  const pasta = mkdtempSync(join(tmpdir(), `pmoc-${nomeDb}-`));
  const armazenamento = armazenamentoLocal(pasta, SEGREDO);
  const chave = chaveDeBase64(randomBytes(32).toString("base64"));
  const deps = { db };
  const empresa: EmpresaDeps = {
    db,
    arquivos: { db, armazenamento, segredo: SEGREDO },
    chaveCertificado: chave,
  };

  // Empresa com logo PNG (obrigatório na criação), RT e certificado A1 do RT (FL-02).
  const logo = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), randomBytes(32)]);
  const envio = await prepararEnvio(
    admCtx(),
    {
      finalidade: "LOGO_EMPRESA",
      nome: "logo.png",
      mime: "image/png",
      tamanho: logo.length,
      sha256: sha(logo),
    },
    empresa.arquivos,
  );
  const token = new URL(envio.url, "http://x").searchParams.get("t") ?? "";
  if ((await armazenamento.receber(token, logo, "image/png")) !== "OK") {
    throw new Error("logo não recebido");
  }
  await salvarEmpresa(
    admCtx(),
    {
      rowVersion: null,
      logo: envio.comprovante,
      razaoSocial: "Climatização Teste Ltda",
      cnpj: "11.222.333/0001-81",
      telefone: "(47) 3333-0000",
      crea: "1388695",
      endereco: ENDERECO,
    },
    empresa,
  );
  await salvarRt(
    admCtx(),
    {
      rowVersion: null,
      nome: "Jose da Conceicao",
      titulo: "Engenheiro Responsável",
      registro: "REG-123",
      telefone: "47999990000",
      email: "rt@exemplo.test",
      endereco: ENDERECO,
    },
    empresa,
  );
  const dia = 24 * 60 * 60 * 1000;
  const p12 = gerarPkcs12({
    nome: "Jose da Conceicao",
    senha: "s3nha",
    validoDe: new Date(agora.getTime() - 10 * dia),
    validoAte: new Date(agora.getTime() + 300 * dia),
  });
  await enviarCertificado(
    admCtx(),
    { nomeArquivo: "rt.pfx", arquivo: p12.toString("base64"), senha: "s3nha" },
    empresa,
  );

  const emissao: EmissaoDeps = {
    db,
    armazenamento,
    chaveCertificado: chave,
    gerarPdf: gerarPdfPmoc,
    assinarPdf: assinarPdfComA1,
    urlVerificacao: (c) => `https://pmoc.exemplo.test/verificar/${c}`,
    versaoApp: "teste-1",
  };

  return {
    db,
    owner,
    deps,
    emissao,
    comoSistema,
    async usuario(papel, clienteId) {
      const id = randomUUID();
      await comoSistema(async (tx) => {
        await tx`INSERT INTO auth_user (id, name, email)
          VALUES (${`auth-${id}`}, ${papel}, ${`${id}@exemplo.test`})`;
        await tx`INSERT INTO app_user (id, name, email, auth_user_id, role, client_id)
          VALUES (${id}, ${papel}, ${`${id}@exemplo.test`}, ${`auth-${id}`}, ${papel},
            ${clienteId ?? null})`;
      });
      return id;
    },
    async novoTipo(sigla, periodicidades) {
      const { id } = await criarTipo(
        admCtx(),
        { nome: `Tipo ${sigla}`, sigla, grupos: ["G"] },
        deps,
      );
      for (const [i, periodicidade] of periodicidades.entries()) {
        await incluirAtividade(
          admCtx(),
          {
            tipoId: id,
            titulo: `Atividade ${periodicidade} ${i + 1}`,
            periodicidade,
            natureza: "VERIFICACAO",
            exigeFoto: false,
            ordem: i + 1,
          },
          deps,
        );
      }
      const t = await obterTipo(admCtx(), id, deps);
      return { id, grupoId: t?.grupos[0]?.id as string };
    },
    async cenario(equipamentos, contrato = { inicio: "2026-11-01", fim: "2027-10-31" }) {
      const { id: clienteId } = await criarCliente(
        admCtx(),
        {
          razaoSocial: `Cliente ${randomUUID().slice(0, 8)}`,
          cnpj: gerarCnpj(),
          endereco: ENDERECO,
        },
        deps,
      );
      const { id: localId } = await criarLocal(
        admCtx(),
        { clienteId, nome: "Unidade", endereco: ENDERECO },
        deps,
      );
      const ids: string[] = [];
      for (const t of equipamentos) {
        const e = await criarEquipamento(
          admCtx(),
          { localId, tipoId: t.id, grupoId: t.grupoId, ambiente: "Sala" },
          deps,
        );
        ids.push(e.id);
      }
      const { id: contratoId } = await criarContrato(
        admCtx(),
        { localId, ...contrato, art: "ART-1" },
        deps,
        agora,
      );
      const { id: pmocId } = await criarPmoc(
        admCtx(),
        { contratoId, copiarDoAnterior: false },
        deps,
      );
      return { clienteId, localId, pmocId, equipamentos: ids };
    },
    async emitir(pmocId) {
      const rowVersion = (await obterPmoc(admCtx(), pmocId, deps))?.rowVersion ?? 0;
      return emitirPmoc(admCtx(), { pmocId, rowVersion }, emissao, agora);
    },
    async encerrar() {
      await owner.end();
      await db.close();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${nomeDb} WITH (FORCE)`);
      await admin.end();
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}
