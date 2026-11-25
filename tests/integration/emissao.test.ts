/**
 * Etapa 4 – emissão do PMOC (RF-12, RF-13; FL-08 passo 11; TL-121). RN-009 (uma transação; falha em
 * qualquer passo desfaz tudo), RN-060, RN-101, RN-120, RN-187, RN-188; E-08.6, E-08.8; HM-1, VP-2.
 * Triggers da migração 0015. Banco próprio, migrado do zero: precisa de certificado A1 cifrado com
 * a chave do teste e conta as linhas da emissão.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runMigrations } from "../../db/migrate";
import { type ArquivosDeps, lerArquivo, prepararEnvio } from "../../src/modules/arquivos";
import { criarTipo, incluirAtividade, obterTipo } from "../../src/modules/biblioteca";
import { criarCliente, criarContrato, criarLocal } from "../../src/modules/clientes";
import {
  type EmpresaDeps,
  enviarCertificado,
  salvarEmpresa,
  salvarRt,
} from "../../src/modules/empresa";
import { alterarSituacaoEquipamento, criarEquipamento } from "../../src/modules/equipamentos";
import {
  codigoImpresso,
  criarPmoc,
  type EmissaoDeps,
  ErroPmoc,
  emitirPmoc,
  obterPmoc,
  removerAtividadeDoPlano,
  verificarDocumento,
  verificarEmissao,
} from "../../src/modules/pmoc";
import { buildContext } from "../../src/server/context";
import { chaveDeBase64 } from "../../src/server/crypto";
import { createDatabase, type Database } from "../../src/server/db";
import { assinarPdfComA1, ErroAssinatura } from "../../src/server/pdf/assinar";
import { gerarPdfPmoc } from "../../src/server/pdf/pmoc";
import { type ArmazenamentoLocal, armazenamentoLocal } from "../../src/server/storage";
import { gerarPkcs12 } from "../fixtures/certificado";
import { verificarPades } from "../fixtures/verificar-pades";
import { textoDasPaginas } from "../pdf/texto";
import { admCtx, clientCtx, technicianCtx } from "./helpers";

const NOME_DB = "pmoc_emissao";
const trocarDb = (url: string) => {
  const u = new URL(url);
  u.pathname = `/${NOME_DB}`;
  return u.toString();
};

const AGORA = new Date("2026-11-18T15:00:00Z");
const chave = chaveDeBase64(randomBytes(32).toString("base64"));
const SEGREDO = "segredo-de-teste";

let admin: postgres.Sql;
let owner: postgres.Sql;
let db: Database;
let pasta: string;
let armazenamento: ArmazenamentoLocal;
let arquivos: ArquivosDeps;
let empresa: EmpresaDeps;
let deps: { db: Database };
let emissao: EmissaoDeps;
let certificadoId: string;

const endereco = {
  logradouro: "Rua das Palmeiras",
  numero: "100",
  semNumero: false,
  bairro: "Centro",
  cidade: "Joinville",
  uf: "SC" as const,
  cep: "89201000",
};

function gerarCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((a, p, i) => a + Number(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${dv(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Usuário de um cliente, direto pelo dono (a criação de usuário tem o próprio teste, Etapa 2). */
async function usuarioCliente(clienteId: string, situacao: "ATIVO" | "INATIVO" = "ATIVO") {
  const id = randomUUID();
  await owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    await tx`INSERT INTO auth_user (id, name, email) VALUES (${`auth-${id}`}, 'Cliente', ${`${id}@exemplo.test`})`;
    await tx`INSERT INTO app_user (id, name, email, auth_user_id, role, client_id, status, inactivated_at)
      VALUES (${id}, 'Cliente', ${`${id}@exemplo.test`}, ${`auth-${id}`}, 'CLIENTE', ${clienteId},
        ${situacao}, ${situacao === "INATIVO" ? AGORA.toISOString() : null})`;
  });
  return id;
}

/** Tipo com 3 atividades (MM, MT, MA) e um grupo. */
async function novoTipo(sigla: string) {
  const { id } = await criarTipo(admCtx(), { nome: `Tipo ${sigla}`, sigla, grupos: ["G"] }, deps);
  const base = { tipoId: id, exigeFoto: false, natureza: "VERIFICACAO" as const };
  await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Mensal", periodicidade: "MM", ordem: 1 },
    deps,
  );
  await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Trimestral", periodicidade: "MT", ordem: 2 },
    deps,
  );
  await incluirAtividade(
    admCtx(),
    { ...base, titulo: "Anual", periodicidade: "MA", ordem: 3 },
    deps,
  );
  const t = await obterTipo(admCtx(), id, deps);
  return { id, grupoId: t?.grupos[0]?.id as string };
}

/**
 * Cliente, local com 2 equipamentos `ATIVO` do tipo A, 1 do tipo B e 1 inativo, contrato de 12 meses
 * e o PMOC `RASCUNHO`. Usuários do cliente: 2 `ATIVO` e 1 `INATIVO`.
 */
async function cenario(tipos: {
  a: Awaited<ReturnType<typeof novoTipo>>;
  b: Awaited<ReturnType<typeof novoTipo>>;
}) {
  const { id: clienteId } = await criarCliente(
    admCtx(),
    { razaoSocial: `Cliente ${randomUUID().slice(0, 8)}`, cnpj: gerarCnpj(), endereco },
    deps,
  );
  const { id: localId } = await criarLocal(
    admCtx(),
    { clienteId, nome: "Unidade", endereco },
    deps,
  );
  const eq = (t: { id: string; grupoId: string }) =>
    criarEquipamento(
      admCtx(),
      { localId, tipoId: t.id, grupoId: t.grupoId, ambiente: "Sala" },
      deps,
    );
  await eq(tipos.a);
  await eq(tipos.a);
  await eq(tipos.b);
  const inativo = await eq(tipos.b);
  await alterarSituacaoEquipamento(
    admCtx(),
    { id: inativo.id, rowVersion: 1, situacao: "INATIVO" },
    deps,
  );
  const { id: contratoId } = await criarContrato(
    admCtx(),
    { localId, inicio: "2026-11-01", fim: "2027-10-31", art: "ART-1" },
    deps,
    AGORA,
  );
  const { id: pmocId } = await criarPmoc(admCtx(), { contratoId, copiarDoAnterior: false }, deps);
  const usuarios = [await usuarioCliente(clienteId), await usuarioCliente(clienteId)];
  await usuarioCliente(clienteId, "INATIVO");
  return { clienteId, localId, contratoId, pmocId, usuarios };
}

const rowVersion = async (pmocId: string) =>
  ((await obterPmoc(admCtx(), pmocId, deps))?.rowVersion ?? 0) as number;

const emitir = async (pmocId: string, d: Partial<EmissaoDeps> = {}) =>
  emitirPmoc(
    admCtx(),
    { pmocId, rowVersion: await rowVersion(pmocId) },
    { ...emissao, ...d },
    AGORA,
  );

/** Quantas linhas a emissão deixou para o PMOC (todas zero quando nada foi gravado). */
async function rastro(pmocId: string) {
  const [r] = await owner`SELECT
      (SELECT status FROM pmoc WHERE id = ${pmocId}) AS status,
      (SELECT count(*)::int FROM pmoc_version WHERE pmoc_id = ${pmocId}) AS versoes,
      (SELECT count(*)::int FROM occurrence WHERE pmoc_id = ${pmocId}) AS ocorrencias,
      (SELECT count(*)::int FROM visit WHERE pmoc_id = ${pmocId}) AS visitas,
      (SELECT count(*)::int FROM notification WHERE entity_id = ${pmocId}) AS notificacoes,
      (SELECT count(*)::int FROM stored_file WHERE kind = 'PMOC_PDF') AS pdfs`;
  return r as {
    status: string;
    versoes: number;
    ocorrencias: number;
    visitas: number;
    notificacoes: number;
    pdfs: number;
  };
}

async function erroDe(p: Promise<unknown>): Promise<ErroPmoc> {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErroPmoc);
  return e as ErroPmoc;
}

let tipos: { a: Awaited<ReturnType<typeof novoTipo>>; b: Awaited<ReturnType<typeof novoTipo>> };

beforeAll(async () => {
  admin = postgres(inject("dbAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB}`);
  await admin.unsafe(`CREATE DATABASE ${NOME_DB}`);
  await runMigrations({
    adminUrl: trocarDb(inject("dbAdminUrl")),
    ownerUrl: trocarDb(inject("dbOwnerUrl")),
  });
  db = createDatabase(trocarDb(inject("dbAppUrl")), { max: 4 });
  owner = postgres(trocarDb(inject("dbOwnerUrl")), { max: 2, onnotice: () => {} });
  await owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    await tx`INSERT INTO auth_user (id, name, email) VALUES ('auth-adm', 'ADM Teste', 'adm@teste.test')`;
    await tx`INSERT INTO app_user (id, name, email, auth_user_id, role)
      VALUES (${admCtx().userId}, 'ADM Teste', 'adm@teste.test', 'auth-adm', 'ADM')`;
  });
  pasta = mkdtempSync(join(tmpdir(), "pmoc-emissao-"));
  armazenamento = armazenamentoLocal(pasta, SEGREDO);
  arquivos = { db, armazenamento, segredo: SEGREDO };
  empresa = { db, arquivos, chaveCertificado: chave };
  deps = { db };

  // Empresa com logo PNG, RT e certificado A1 do RT (FL-02).
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
    arquivos,
  );
  const token = new URL(envio.url, "http://x").searchParams.get("t") ?? "";
  expect(await armazenamento.receber(token, logo, "image/png")).toBe("OK");
  await salvarEmpresa(
    admCtx(),
    {
      rowVersion: null,
      logo: envio.comprovante,
      razaoSocial: "Climatização Teste Ltda",
      cnpj: "11.222.333/0001-81",
      telefone: "(47) 3333-0000",
      crea: "1388695",
      endereco,
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
      endereco,
    },
    empresa,
  );
  const dia = 24 * 60 * 60 * 1000;
  const p12 = gerarPkcs12({
    nome: "Jose da Conceicao",
    senha: "s3nha",
    validoDe: new Date(AGORA.getTime() - 10 * dia),
    validoAte: new Date(AGORA.getTime() + 300 * dia),
  });
  certificadoId = (
    await enviarCertificado(
      admCtx(),
      { nomeArquivo: "rt.pfx", arquivo: p12.toString("base64"), senha: "s3nha" },
      empresa,
    )
  ).id;

  emissao = {
    db,
    armazenamento,
    chaveCertificado: chave,
    gerarPdf: gerarPdfPmoc,
    assinarPdf: assinarPdfComA1,
    urlVerificacao: (c) => `https://pmoc.exemplo.test/verificar/${c}`,
    versaoApp: "teste-1",
  };
  tipos = { a: await novoTipo("EMA"), b: await novoTipo("EMB") };
}, 180_000);

afterAll(async () => {
  await owner.end();
  await db.close();
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB} WITH (FORCE)`);
  await admin.end();
  rmSync(pasta, { recursive: true, force: true });
});

describe("RN-009: emissão numa transação", () => {
  it("grava versão 1, PDF assinado, ocorrências, visitas e notificações, conforme o resumo do PRONTO", async () => {
    const c = await cenario(tipos);
    const verificacao = await verificarEmissao(admCtx(), c.pmocId, deps, AGORA);
    expect(verificacao.pendencias).toEqual([]);
    const pdfsAntes = (await rastro(c.pmocId)).pdfs;

    const r = await emitir(c.pmocId);
    expect(r).toMatchObject({
      versao: 1,
      ocorrencias: verificacao.resumo.ocorrencias,
      visitas: verificacao.resumo.visitas,
      notificados: 2,
    });
    // 3 equipamentos ativos × (12 MM + 4 MT + 1 MA) e uma visita por mês (RN-060).
    expect(r.ocorrencias).toBe(3 * 17);
    expect(r.visitas).toBe(12);

    // RN-009 passo 3; HM-1: 1ª emissão marcada.
    const [pmoc] = await owner`SELECT status, current_version_number, first_issued_at
      FROM pmoc WHERE id = ${c.pmocId}`;
    expect(pmoc).toMatchObject({
      status: "EMITIDO",
      current_version_number: 1,
      first_issued_at: AGORA,
    });

    // VP-2; INT-21; RN-187.
    const [v] = await owner`SELECT * FROM pmoc_version WHERE id = ${r.versaoId}`;
    expect(v).toMatchObject({
      pmoc_id: c.pmocId,
      client_id: c.clienteId,
      version_number: 1,
      status: "AGUARDANDO_ASSINATURA",
      is_current: true,
      issue_reason: null,
      snapshot_schema_version: 1,
      pdf_file_id: r.arquivoId,
      rt_signature_method: "AUTOMATICA_A1",
      rt_certificate_id: certificadoId,
      rt_signed_at: AGORA,
      issued_at: AGORA,
      issued_by_user_id: admCtx().userId,
      renderer_version: "teste-1",
      superseded_at: null,
    });
    expect(v?.verification_code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(v?.snapshot.tipos).toHaveLength(2);
    expect(v?.snapshot.textos.anexo1.versao).toBe("rascunho-1");

    // PDF: arquivo novo do cliente, hash conferido, assinado pelo RT e com o código no rodapé.
    expect((await rastro(c.pmocId)).pdfs).toBe(pdfsAntes + 1);
    const [arquivo] = await owner`SELECT kind, client_id, storage_key, mime_type, size_bytes, sha256
      FROM stored_file WHERE id = ${r.arquivoId}`;
    expect(arquivo).toMatchObject({
      kind: "PMOC_PDF",
      client_id: c.clienteId,
      mime_type: "application/pdf",
    });
    const bytes = (await armazenamento.ler(arquivo?.storage_key)) as Buffer;
    expect(sha(bytes)).toBe(arquivo?.sha256);
    expect(v?.pdf_sha256).toBe(arquivo?.sha256);
    const pades = verificarPades(bytes);
    expect(pades.digestConfere && pades.assinaturaConfere && pades.byteRangeCobreTudo).toBe(true);
    const paginas = await textoDasPaginas(bytes);
    expect(paginas[0]).toContain(`Código de verificação: ${codigoImpresso(v?.verification_code)}`);
    expect(paginas[1]).toContain("Assinado digitalmente por Jose da Conceicao");

    // RN-009 passo 4 (HM-1, DM-04): só células previstas, todas PREVISTA, criadas pelo sistema.
    const ocorrencias = await owner`SELECT status, created_by_user_id, month_index FROM occurrence
      WHERE pmoc_id = ${c.pmocId}`;
    expect(ocorrencias).toHaveLength(r.ocorrencias);
    expect(new Set(ocorrencias.map((o) => o.status))).toEqual(new Set(["PREVISTA"]));
    expect(ocorrencias.every((o) => o.created_by_user_id === null)).toBe(true);

    // RN-060: uma visita A_AGENDAR por mês, com todas as ocorrências do mês e o cliente do local.
    const visitas = await owner`SELECT v.status, v.origin, v.client_id, v.site_id,
        v.reference_month_index AS mes,
        (SELECT count(*)::int FROM visit_occurrence vo WHERE vo.visit_id = v.id) AS ocorrencias,
        (SELECT count(*)::int FROM occurrence o
          WHERE o.pmoc_id = v.pmoc_id AND o.month_index = v.reference_month_index) AS do_mes
      FROM visit v WHERE v.pmoc_id = ${c.pmocId} ORDER BY v.reference_month_index`;
    expect(visitas.map((x) => x.mes)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const x of visitas) {
      expect(x).toMatchObject({
        status: "A_AGENDAR",
        origin: "AUTOMATICA",
        client_id: c.clienteId,
        site_id: c.localId,
      });
      expect(x.ocorrencias).toBe(x.do_mes);
    }

    // RN-101: só os usuários ATIVO do cliente.
    const notificacoes = await owner`SELECT recipient_user_id, event_type, title, entity_type
      FROM notification WHERE entity_id = ${c.pmocId}`;
    expect(notificacoes.map((n) => n.recipient_user_id).sort()).toEqual([...c.usuarios].sort());
    for (const n of notificacoes) {
      expect(n).toMatchObject({
        event_type: "PMOC_AGUARDANDO_ASSINATURA",
        title: "PMOC aguardando assinatura",
        entity_type: "pmoc",
      });
    }

    // Emitido não emite de novo pela 1ª emissão (nova versão é FL-09).
    expect((await erroDe(emitir(c.pmocId))).codigo).toBe("NAO_DISPONIVEL");
  });
});

describe("TL-120 aba Versões e Baixar PDF (RN-016, RN-126, RN-163, RN-166, RN-171)", () => {
  it("rascunho não tem versão; emitido lista a v1 atual com o PDF assinado pelo RT", async () => {
    const c = await cenario(tipos);
    expect((await obterPmoc(admCtx(), c.pmocId, deps))?.versoes).toEqual([]);

    const r = await emitir(c.pmocId);
    const p = await obterPmoc(admCtx(), c.pmocId, deps);
    expect(p?.versoes).toEqual([
      {
        id: r.versaoId,
        numero: 1,
        situacao: "AGUARDANDO_ASSINATURA",
        atual: true,
        emitidaEm: AGORA,
        emitidaPor: "ADM Teste",
        motivo: null,
        pdfArquivoId: r.arquivoId,
        assinadaPor: null,
        assinadaEm: null,
      },
    ]);
  });

  it("ADM e o próprio cliente baixam o PDF; outro cliente e o técnico recebem 404", async () => {
    const c = await cenario(tipos);
    const r = await emitir(c.pmocId);
    const [v] = await owner`SELECT pdf_sha256 FROM pmoc_version WHERE id = ${r.versaoId}`;

    const adm = await lerArquivo(admCtx(), r.arquivoId, arquivos);
    expect(adm?.mime).toBe("application/pdf");
    expect(sha(adm?.bytes as Buffer)).toBe(v?.pdf_sha256);

    const doCliente = buildContext({
      userId: c.usuarios[0] as string,
      role: "CLIENTE",
      clientId: c.clienteId,
      requestId: randomUUID(),
      source: "PORTAL_CLIENTE",
    });
    expect(sha((await lerArquivo(doCliente, r.arquivoId, arquivos))?.bytes as Buffer)).toBe(
      v?.pdf_sha256,
    );

    expect(await lerArquivo(clientCtx("A"), r.arquivoId, arquivos)).toBeNull(); // RN-162
    expect(await lerArquivo(technicianCtx(), r.arquivoId, arquivos)).toBeNull(); // RN-166
  });
});

describe("TL-007 Verificar documento (RN-187; INT-14; CA-26.2; AF-09)", () => {
  it("código do rodapé, digitado com hífen e minúscula: mostra só tipo, versão, datas, hash e situação", async () => {
    const c = await cenario(tipos);
    const r = await emitir(c.pmocId);
    const [v] = await owner`SELECT verification_code, pdf_sha256 FROM pmoc_version
      WHERE id = ${r.versaoId}`;
    const digitado = codigoImpresso(v?.verification_code).toLowerCase();

    // toEqual no objeto inteiro: nenhum campo além dos da INT-14 (sem pessoa nem cliente).
    expect(await verificarDocumento(digitado, "203.0.113.1", deps)).toEqual({
      estado: "ENCONTRADO",
      documento: {
        tipo: "PMOC",
        versao: 1,
        emitidoEm: AGORA,
        assinadoClienteEm: null,
        sha256: v?.pdf_sha256,
        sha256AssinadoCliente: null,
        situacao: "VIGENTE",
      },
    });
  });

  it("código no formato mas inexistente: NAO_ENCONTRADO; fora do formato: INVALIDO sem contar", async () => {
    const ip = "203.0.113.2";
    const naoExiste = "0".repeat(26);
    expect(await verificarDocumento(naoExiste, ip, deps)).toEqual({ estado: "NAO_ENCONTRADO" });
    expect(await verificarDocumento("abc", ip, deps)).toEqual({ estado: "INVALIDO" });

    const chave = `verificar:${sha(Buffer.from(ip))}`;
    const linhas =
      await owner`SELECT key, count FROM rate_limit_counter WHERE key LIKE 'verificar:%'`;
    expect(linhas.find((l) => l.key === chave)?.count).toBe(1); // só a consulta no formato contou
    expect(linhas.some((l) => String(l.key).includes(ip))).toBe(false); // IP nunca em claro
  });

  it("30 consultas por hora por IP; a 31ª recebe LIMITE e outro IP continua consultando", async () => {
    const ip = "203.0.113.3";
    const codigo = "1".repeat(26);
    for (let i = 0; i < 30; i++) {
      expect((await verificarDocumento(codigo, ip, deps)).estado).toBe("NAO_ENCONTRADO");
    }
    expect(await verificarDocumento(codigo, ip, deps)).toEqual({ estado: "LIMITE" });
    expect((await verificarDocumento(codigo, "203.0.113.4", deps)).estado).toBe("NAO_ENCONTRADO");
  });
});

describe("E-08.6: falha em qualquer passo desfaz tudo", () => {
  let pmocId: string;
  beforeAll(async () => {
    pmocId = (await cenario(tipos)).pmocId;
  });

  const nadaGravado = async (pdfsAntes: number) => {
    expect(await rastro(pmocId)).toEqual({
      status: "RASCUNHO",
      versoes: 0,
      ocorrencias: 0,
      visitas: 0,
      notificacoes: 0,
      pdfs: pdfsAntes,
    });
  };

  it.each([
    [
      "ao gerar o PDF",
      (): Partial<EmissaoDeps> => ({
        gerarPdf: async () => {
          throw new Error("falha do renderizador");
        },
      }),
    ],
    [
      "ao assinar (senha guardada não abre mais o certificado)",
      (): Partial<EmissaoDeps> => ({
        assinarPdf: async () => {
          throw new ErroAssinatura("SENHA");
        },
      }),
    ],
    [
      "ao gravar o PDF no armazenamento",
      (): Partial<EmissaoDeps> => ({
        armazenamento: {
          ...armazenamento,
          gravar: async () => {
            throw new Error("armazenamento fora do ar");
          },
        },
      }),
    ],
  ])("%s", async (_, falha) => {
    const pdfsAntes = (await rastro(pmocId)).pdfs;
    const e = await erroDe(emitir(pmocId, falha()));
    expect(e).toMatchObject({
      codigo: "FALHA_EMISSAO",
      message: "A emissão não foi concluída e nada foi alterado. Tente novamente.",
    });
    await nadaGravado(pdfsAntes);
  });

  it("chave de cifra diferente da usada no envio do certificado", async () => {
    const pdfsAntes = (await rastro(pmocId)).pdfs;
    const outra = chaveDeBase64(randomBytes(32).toString("base64"));
    const e = await erroDe(emitir(pmocId, { chaveCertificado: outra }));
    expect(e.codigo).toBe("FALHA_EMISSAO");
    expect(e.message).toMatch(/chave de cifra/);
    await nadaGravado(pdfsAntes);
  });

  it("no último passo (notificação): PDF, versão, ocorrências e visitas já gravados voltam", async () => {
    const pdfsAntes = (await rastro(pmocId)).pdfs;
    await owner.unsafe(`CREATE FUNCTION teste_falha_notificacao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'falha simulada na notificação'; END $$;
      CREATE TRIGGER teste_falha_notificacao BEFORE INSERT ON notification
        FOR EACH ROW EXECUTE FUNCTION teste_falha_notificacao();`);
    try {
      expect((await erroDe(emitir(pmocId))).codigo).toBe("FALHA_EMISSAO");
    } finally {
      await owner.unsafe(`DROP TRIGGER teste_falha_notificacao ON notification;
        DROP FUNCTION teste_falha_notificacao();`);
    }
    await nadaGravado(pdfsAntes);
    // Sem a falha, o mesmo PMOC emite normalmente.
    expect((await emitir(pmocId)).versao).toBe(1);
  });
});

describe("E-08.8 e UF-07: concorrência", () => {
  it("duas emissões ao mesmo tempo: uma vence; a outra recebe ALTERADO_POR_OUTRO na hora", async () => {
    const { pmocId } = await cenario(tipos);
    const versao = await rowVersion(pmocId);
    let liberar: () => void = () => {};
    let entrou: () => void = () => {};
    const dentro = new Promise<void>((r) => {
      entrou = r;
    });
    const lenta = emitirPmoc(
      admCtx(),
      { pmocId, rowVersion: versao },
      {
        ...emissao,
        gerarPdf: async (e) => {
          entrou();
          await new Promise<void>((r) => {
            liberar = r;
          });
          return gerarPdfPmoc(e);
        },
      },
      AGORA,
    );
    await dentro; // a primeira já travou o PMOC
    const segunda = await erroDe(
      emitirPmoc(admCtx(), { pmocId, rowVersion: versao }, emissao, AGORA),
    );
    expect(segunda.codigo).toBe("ALTERADO_POR_OUTRO");
    liberar();
    expect((await lenta).versao).toBe(1);
    expect((await rastro(pmocId)).versoes).toBe(1);
  });

  it("row_version velho: recusa sem gravar", async () => {
    const { pmocId } = await cenario(tipos);
    const e = await erroDe(
      emitirPmoc(admCtx(), { pmocId, rowVersion: (await rowVersion(pmocId)) + 1 }, emissao, AGORA),
    );
    expect(e.codigo).toBe("ALTERADO_POR_OUTRO");
    expect((await rastro(pmocId)).versoes).toBe(0);
  });
});

describe("pré-condições e permissões", () => {
  it("RN-007 (g): plano vazio → PENDENCIAS, nada gravado", async () => {
    const { pmocId } = await cenario(tipos);
    const p = await obterPmoc(admCtx(), pmocId, deps);
    for (const t of p?.tipos ?? []) {
      for (const a of t.atividades) {
        await removerAtividadeDoPlano(admCtx(), { id: a.id, rowVersion: a.rowVersion }, deps);
      }
    }
    expect((await erroDe(emitir(pmocId))).codigo).toBe("PENDENCIAS");
    expect((await rastro(pmocId)).versoes).toBe(0);
  });

  it("RF-03: TECNICO e CLIENTE não emitem", async () => {
    const { pmocId } = await cenario(tipos);
    for (const ctx of [technicianCtx(), clientCtx("A")]) {
      const e = await erroDe(emitirPmoc(ctx, { pmocId, rowVersion: 1 }, emissao, AGORA));
      expect(e.codigo).toBe("SEM_PERMISSAO");
    }
    expect((await rastro(pmocId)).status).toBe("RASCUNHO");
  });
});

describe("triggers da emissão (migração 0015)", () => {
  /** Comando como dono, com contexto de auditoria; devolve a restrição violada. */
  async function restricao(comando: (tx: postgres.TransactionSql) => Promise<unknown>) {
    try {
      await owner.begin(async (tx) => {
        await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
        await comando(tx);
      });
    } catch (e) {
      return (e as { constraint_name?: string }).constraint_name ?? String(e);
    }
    return null;
  }

  let emitido: Awaited<ReturnType<typeof cenario>>;
  let versaoId: string;
  beforeAll(async () => {
    emitido = await cenario(tipos);
    versaoId = (await emitir(emitido.pmocId)).versaoId;
  });

  it("doc 02 §7.3: PMOC emitido não volta a RASCUNHO", async () => {
    expect(
      await restricao((tx) => tx`UPDATE pmoc SET status = 'RASCUNHO' WHERE id = ${emitido.pmocId}`),
    ).toBe("pmoc_status_transition");
  });

  it("RNF-15: a versão emitida é imutável; status e is_current só nas transições de 03 §4.2", async () => {
    expect(
      await restricao(
        (tx) => tx`UPDATE pmoc_version SET pdf_sha256 = ${"0".repeat(64)} WHERE id = ${versaoId}`,
      ),
    ).toBe("pmoc_version_immutable");
    expect(
      await restricao(
        (tx) => tx`UPDATE pmoc_version SET snapshot = '{}'::jsonb WHERE id = ${versaoId}`,
      ),
    ).toBe("pmoc_version_immutable");
    expect(
      await restricao(
        (tx) => tx`UPDATE pmoc_version SET status = 'SUBSTITUIDA', is_current = false,
          superseded_at = now() WHERE id = ${versaoId}`,
      ),
    ).toBeNull();
    expect(
      await restricao(
        (tx) => tx`UPDATE pmoc_version SET status = 'AGUARDANDO_ASSINATURA' WHERE id = ${versaoId}`,
      ),
    ).toBe("pmoc_version_status_transition");
  });

  it("03 §2.7: ocorrência de equipamento de outro local é recusada", async () => {
    const outro = await cenario(tipos);
    const [eqOutro] =
      await owner`SELECT id FROM equipment WHERE site_id = ${outro.localId} LIMIT 1`;
    const [atividade] = await owner`SELECT pa.id FROM pmoc_activity pa
      JOIN equipment e ON e.equipment_type_id = pa.equipment_type_id
      WHERE pa.pmoc_id = ${emitido.pmocId} AND e.id = ${eqOutro?.id}`;
    expect(
      await restricao(
        (tx) => tx`INSERT INTO occurrence (pmoc_id, pmoc_activity_id, equipment_id, month_index,
          reference_month, due_date, status)
          VALUES (${emitido.pmocId}, ${atividade?.id}, ${eqOutro?.id}, 2, '2026-12-01', '2026-12-31', 'PREVISTA')`,
      ),
    ).toBe("occurrence_consistency");
  });

  it("03 §2.8: visita de outro local e ocorrência de outro mês são recusadas", async () => {
    const outro = await cenario(tipos);
    expect(
      await restricao(
        (
          tx,
        ) => tx`INSERT INTO visit (pmoc_id, site_id, reference_month_index, reference_month, origin)
          VALUES (${emitido.pmocId}, ${outro.localId}, 1, '2026-11-01', 'AVULSA')`,
      ),
    ).toBe("visit_site_of_contract");
    const [visita] = await owner`SELECT id FROM visit
      WHERE pmoc_id = ${emitido.pmocId} AND reference_month_index = 1`;
    const [deOutroMes] = await owner`SELECT id FROM occurrence
      WHERE pmoc_id = ${emitido.pmocId} AND month_index = 2 LIMIT 1`;
    expect(
      await restricao(
        (tx) => tx`INSERT INTO visit_occurrence (visit_id, occurrence_id)
          VALUES (${visita?.id}, ${deOutroMes?.id})`,
      ),
    ).toBe("visit_occurrence_month");
  });
});
