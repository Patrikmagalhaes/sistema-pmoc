/**
 * Etapa 3 – empresa executora, RT e certificado (RF-04; FL-02; TL-102, TL-103; DM-11) e envio de
 * arquivo (06 SEG-50 a SEG-54; INT-11). CA-04.1; E-02.1 a E-02.7; RN-121, RN-153. Banco próprio, migrado
 * do zero, porque o compartilhado já tem empresa e RT no seed (primeiro acesso, FL-02 passo 1).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runMigrations } from "../../db/migrate";
import { type ArquivosDeps, lerArquivo, prepararEnvio } from "../../src/modules/arquivos";
import {
  type EmpresaDeps,
  enviarCertificado,
  obterConfiguracao,
  salvarEmpresa,
  salvarRt,
} from "../../src/modules/empresa";
import { chaveDeBase64, decifrar } from "../../src/server/crypto";
import { createDatabase, type Database } from "../../src/server/db";
import { type ArmazenamentoLocal, armazenamentoLocal } from "../../src/server/storage";
import { gerarPkcs12 } from "../fixtures/certificado";
import { admCtx, clientCtx, technicianCtx } from "./helpers";

const NOME_DB = "pmoc_empresa";
const trocarDb = (url: string) => {
  const u = new URL(url);
  u.pathname = `/${NOME_DB}`;
  return u.toString();
};

let admin: postgres.Sql;
let owner: postgres.Sql;
let db: Database;
let pasta: string;
let armazenamento: ArmazenamentoLocal;
let arquivos: ArquivosDeps;
let deps: EmpresaDeps;
const chave = chaveDeBase64(randomBytes(32).toString("base64"));

beforeAll(async () => {
  admin = postgres(inject("dbAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB}`);
  await admin.unsafe(`CREATE DATABASE ${NOME_DB}`);
  await runMigrations({
    adminUrl: trocarDb(inject("dbAdminUrl")),
    ownerUrl: trocarDb(inject("dbOwnerUrl")),
  });
  db = createDatabase(trocarDb(inject("dbAppUrl")), { max: 2 });
  owner = postgres(trocarDb(inject("dbOwnerUrl")), { max: 1, onnotice: () => {} });
  // O ADM dos contextos de teste (o certificado guarda quem enviou, com FK para app_user).
  await owner.begin(async (tx) => {
    await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
    await tx`INSERT INTO auth_user (id, name, email) VALUES ('auth-adm', 'ADM Teste', 'adm@teste.test')`;
    await tx`INSERT INTO app_user (id, name, email, auth_user_id, role)
      VALUES (${admCtx().userId}, 'ADM Teste', 'adm@teste.test', 'auth-adm', 'ADM')`;
  });
  pasta = mkdtempSync(join(tmpdir(), "pmoc-armazenamento-"));
  armazenamento = armazenamentoLocal(pasta, "segredo-de-teste");
  arquivos = { db, armazenamento, segredo: "segredo-de-teste" };
  deps = { db, arquivos, chaveCertificado: chave };
}, 120_000);

afterAll(async () => {
  await owner.end();
  await db.close();
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NOME_DB} WITH (FORCE)`);
  await admin.end();
  rmSync(pasta, { recursive: true, force: true });
});

const endereco = {
  logradouro: "Rua das Palmeiras",
  numero: "100",
  semNumero: false,
  bairro: "Centro",
  cidade: "Joinville",
  uf: "SC" as const,
  cep: "89201000",
};

const dadosEmpresa = {
  razaoSocial: "Climatização Teste Ltda",
  cnpj: "11.222.333/0001-81",
  telefone: "(47) 3333-0000",
  crea: "1388695",
  endereco,
};

const dadosRt = {
  nome: "José da Conceição",
  titulo: "Engenheiro Responsável",
  registro: "REG-123",
  telefone: "47999990000",
  email: "rt@exemplo.test",
  endereco,
};

/** PNG mínimo (assinatura `89 50 4E 47`, SEG-53) e conteúdo aleatório para o hash mudar. */
const png = () => Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), randomBytes(32)]);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const tokenDaUrl = (url: string) => new URL(url, "http://x").searchParams.get("t") ?? "";

/** Preparo + PUT no armazenamento local (o navegador faz o mesmo). `enviados` = bytes que chegam. */
async function enviarLogo(
  declarado: Buffer,
  o: { enviados?: Buffer; mime?: string; ctx?: ReturnType<typeof admCtx> } = {},
) {
  const mime = o.mime ?? "image/png";
  const p = await prepararEnvio(
    o.ctx ?? admCtx(),
    {
      finalidade: "LOGO_EMPRESA",
      nome: "logo.png",
      mime,
      tamanho: declarado.length,
      sha256: sha(declarado),
    },
    arquivos,
  );
  expect(await armazenamento.receber(tokenDaUrl(p.url), o.enviados ?? declarado, mime)).toBe("OK");
  return p.comprovante;
}

const contarArquivos = async () =>
  (await owner`SELECT count(*)::int AS n FROM stored_file`)[0]?.n as number;

const validade = (dias: number) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

describe("primeiro acesso (FL-02 passo 1; CA-04.1)", () => {
  it("sem empresa, RT nem certificado", async () => {
    expect(await obterConfiguracao(admCtx(), deps)).toEqual({
      empresa: null,
      rt: null,
      certificadoAtual: null,
      historico: [],
      houveEmissao: false,
    });
  });

  it("certificado antes do RT é recusado e nada é gravado", async () => {
    const p12 = gerarPkcs12({
      nome: "Rui",
      senha: "x",
      validoDe: validade(-1),
      validoAte: validade(365),
    });
    await expect(
      enviarCertificado(
        admCtx(),
        { nomeArquivo: "rt.pfx", arquivo: p12.toString("base64"), senha: "x" },
        deps,
      ),
    ).rejects.toThrow(/Cadastre o responsável técnico antes/);
    expect((await owner`SELECT count(*)::int AS n FROM rt_certificate`)[0]?.n).toBe(0);
  });

  it("criar a empresa exige o logo; depois cria com o logo conferido (SEG-53, INT-11)", async () => {
    await expect(
      salvarEmpresa(admCtx(), { rowVersion: null, ...dadosEmpresa }, deps),
    ).rejects.toThrow("Envie o logo da empresa.");
    const bytes = png();
    await salvarEmpresa(
      admCtx(),
      { rowVersion: null, logo: await enviarLogo(bytes), ...dadosEmpresa },
      deps,
    );
    const c = await obterConfiguracao(admCtx(), deps);
    expect(c?.empresa).toMatchObject({
      razaoSocial: "Climatização Teste Ltda",
      cnpj: "11222333000181",
      telefone: "4733330000",
      endereco: { bairro: "Centro" },
    });
    const [f] =
      await owner`SELECT kind, storage_key, original_filename, mime_type, size_bytes, sha256
      FROM stored_file WHERE id = ${c?.empresa?.logoId as string}`;
    expect(f).toMatchObject({
      kind: "LOGO_EMPRESA",
      original_filename: "logo.png",
      mime_type: "image/png",
      sha256: sha(bytes),
    });
    expect(Number(f?.size_bytes)).toBe(bytes.length);
    // SEG-50: a chave é do servidor, sem o nome original.
    expect(f?.storage_key).toMatch(/^logo_empresa\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
  });

  it("CA-04.1: não cria uma segunda empresa; editar usa a versão (UF-07) e mantém o logo", async () => {
    const antes = (await obterConfiguracao(admCtx(), deps))?.empresa;
    await expect(
      salvarEmpresa(
        admCtx(),
        { rowVersion: null, logo: await enviarLogo(png()), ...dadosEmpresa },
        deps,
      ),
    ).rejects.toThrow(/alterado por outra pessoa/);
    await salvarEmpresa(
      admCtx(),
      { rowVersion: antes?.rowVersion as number, ...dadosEmpresa, crea: "999" },
      deps,
    );
    const depois = (await obterConfiguracao(admCtx(), deps))?.empresa;
    expect(depois).toMatchObject({ crea: "999", logoId: antes?.logoId });
    await expect(
      salvarEmpresa(admCtx(), { rowVersion: antes?.rowVersion as number, ...dadosEmpresa }, deps),
    ).rejects.toThrow(/alterado por outra pessoa/);
    expect((await owner`SELECT count(*)::int AS n FROM executor_company`)[0]?.n).toBe(1);
  });

  it("E-02.1: CNPJ inválido, telefone e bairro faltando", async () => {
    const v = (await obterConfiguracao(admCtx(), deps))?.empresa?.rowVersion as number;
    await expect(
      salvarEmpresa(
        admCtx(),
        {
          rowVersion: v,
          ...dadosEmpresa,
          cnpj: "12345678000196",
          telefone: "",
          endereco: { ...endereco, bairro: "" },
        },
        deps,
      ),
    ).rejects.toThrow(/CNPJ inválido[\s\S]*Informe o telefone[\s\S]*bairro/);
  });
});

describe("envio de arquivo (SEG-50 a SEG-53)", () => {
  const versao = async () =>
    (await obterConfiguracao(admCtx(), deps))?.empresa?.rowVersion as number;

  it("E-02.2: tipo ou tamanho não aceitos recusam no preparo (SVG proibido)", async () => {
    for (const [mime, tamanho] of [
      ["image/svg+xml", 100],
      ["image/png", 2 * 1024 * 1024 + 1],
      ["image/gif", 100],
    ] as const) {
      await expect(
        prepararEnvio(
          admCtx(),
          { finalidade: "LOGO_EMPRESA", nome: "x", mime, tamanho, sha256: "0".repeat(64) },
          arquivos,
        ),
      ).rejects.toThrow("Envie uma imagem PNG ou JPEG de até 2 MB.");
    }
  });

  it("conteúdo diferente do declarado ou que não é PNG: recusa e não referencia (SEG-53)", async () => {
    const n = await contarArquivos();
    const declarado = png();
    // os bytes que chegam diferem do hash declarado
    const outro = await enviarLogo(declarado, { enviados: png() });
    await expect(
      salvarEmpresa(admCtx(), { rowVersion: await versao(), logo: outro, ...dadosEmpresa }, deps),
    ).rejects.toThrow("Envie uma imagem PNG ou JPEG de até 2 MB.");
    // hash certo, mas não é PNG
    const falso = Buffer.concat([Buffer.from("GIF89a"), randomBytes(30)]);
    const naoPng = await enviarLogo(falso);
    await expect(
      salvarEmpresa(admCtx(), { rowVersion: await versao(), logo: naoPng, ...dadosEmpresa }, deps),
    ).rejects.toThrow("Envie uma imagem PNG ou JPEG de até 2 MB.");
    expect(await contarArquivos()).toBe(n);
  });

  it("arquivo não enviado, comprovante alterado ou de outro usuário: recusa", async () => {
    const bytes = png();
    const p = await prepararEnvio(
      admCtx(),
      {
        finalidade: "LOGO_EMPRESA",
        nome: null,
        mime: "image/png",
        tamanho: bytes.length,
        sha256: sha(bytes),
      },
      arquivos,
    );
    await expect(
      salvarEmpresa(
        admCtx(),
        { rowVersion: await versao(), logo: p.comprovante, ...dadosEmpresa },
        deps,
      ),
    ).rejects.toThrow("O arquivo não chegou.");
    const [carga, assinatura] = p.comprovante.split(".");
    const alterado = `${carga}x.${assinatura}`;
    await expect(
      salvarEmpresa(
        admCtx(),
        { rowVersion: await versao(), logo: alterado, ...dadosEmpresa },
        deps,
      ),
    ).rejects.toThrow(/Envio inválido ou expirado/);
  });

  it("a URL de envio é de uso único, com prazo, tipo e tamanho (armazenamento local)", async () => {
    const agora = Date.now();
    const local = armazenamentoLocal(pasta, "segredo-de-teste", () => agora);
    const chaveObj = `logo_empresa/2026/11/${randomUUID()}.png`;
    const url = await local.urlDeEnvio(chaveObj, { mime: "image/png", tamanho: 40, segundos: 60 });
    const t = tokenDaUrl(url);
    expect(await local.receber(t, Buffer.concat([png(), png()]).subarray(0, 41), "image/png")).toBe(
      "TAMANHO",
    );
    expect(await local.receber(t, png().subarray(0, 40), "image/jpeg")).toBe("TIPO");
    expect(await local.receber(`${t}x`, png().subarray(0, 40), "image/png")).toBe("INVALIDO");
    expect(await local.receber(t, png().subarray(0, 40), "image/png")).toBe("OK");
    expect(await local.receber(t, png().subarray(0, 40), "image/png")).toBe("JA_ENVIADO");
    const depois = armazenamentoLocal(pasta, "segredo-de-teste", () => agora + 61_000);
    expect(await depois.receber(t, png().subarray(0, 40), "image/png")).toBe("EXPIRADO");
    await expect(
      local.urlDeEnvio("../fora.png", { mime: "image/png", tamanho: 1, segundos: 1 }),
    ).rejects.toThrow(/Chave de armazenamento inválida/);
  });

  it("o logo só é lido pelo ADM (RN-162: os demais recebem 404)", async () => {
    const id = (await obterConfiguracao(admCtx(), deps))?.empresa?.logoId as string;
    const a = await lerArquivo(admCtx(), id, arquivos);
    expect(a?.mime).toBe("image/png");
    expect(a?.bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(await lerArquivo(clientCtx("A"), id, arquivos)).toBeNull();
    expect(await lerArquivo(technicianCtx(), id, arquivos)).toBeNull();
    expect(await lerArquivo(admCtx(), randomUUID(), arquivos)).toBeNull();
  });
});

describe("RT (RF-04.3)", () => {
  it("cria o registro único e edita com a versão; e-mail inválido recusa", async () => {
    await expect(
      salvarRt(admCtx(), { rowVersion: null, ...dadosRt, email: "x" }, deps),
    ).rejects.toThrow(/E-mail inválido/);
    await salvarRt(admCtx(), { rowVersion: null, ...dadosRt }, deps);
    const rt = (await obterConfiguracao(admCtx(), deps))?.rt;
    expect(rt).toMatchObject({ nome: "José da Conceição", telefone: "47999990000" });
    await salvarRt(
      admCtx(),
      { rowVersion: rt?.rowVersion as number, ...dadosRt, titulo: "Eng." },
      deps,
    );
    expect((await obterConfiguracao(admCtx(), deps))?.rt?.titulo).toBe("Eng.");
    await expect(salvarRt(admCtx(), { rowVersion: null, ...dadosRt }, deps)).rejects.toThrow(
      /alterado por outra pessoa/,
    );
  });
});

describe("certificado do RT (RF-04.4; DM-11; RN-121, RN-153)", () => {
  const enviar = (p12: Buffer, senha: string, nomeArquivo = "rt.pfx", d = deps) =>
    enviarCertificado(admCtx(), { nomeArquivo, arquivo: p12.toString("base64"), senha }, d);
  const contar = async () => (await owner`SELECT count(*)::int AS n FROM rt_certificate`)[0]?.n;

  it("E-02.3 a E-02.5 e extensão/tamanho: nada é gravado", async () => {
    const p12 = gerarPkcs12({
      nome: "José da Conceição",
      senha: "certa",
      validoDe: validade(-10),
      validoAte: validade(300),
    });
    await expect(enviar(p12, "errada")).rejects.toThrow("Senha do certificado incorreta.");
    await expect(enviar(Buffer.from("lixo"), "certa")).rejects.toThrow(
      "Arquivo de certificado inválido.",
    );
    await expect(enviar(p12, "certa", "rt.pem")).rejects.toThrow(/\.pfx ou \.p12/);
    await expect(enviar(randomBytes(50 * 1024 + 1), "certa")).rejects.toThrow(/até 50 KB/);
    const vencido = gerarPkcs12({
      nome: "José da Conceição",
      senha: "certa",
      validoDe: new Date("2024-01-01T00:00:00Z"),
      validoAte: new Date("2025-03-10T15:00:00Z"),
    });
    await expect(enviar(vencido, "certa")).rejects.toThrow("Certificado vencido em 10/03/2025.");
    await expect(
      enviar(p12, "certa", "rt.pfx", { ...deps, chaveCertificado: null }),
    ).rejects.toThrow(/chave de cifra/);
    expect(await contar()).toBe(0);
  });

  it("grava cifrado (arquivo e senha), sem nada em claro, nem na auditoria; vira o atual", async () => {
    const p12 = gerarPkcs12({
      nome: "Jose da Conceicao",
      senha: "s3nh@-forte",
      validoDe: validade(-10),
      validoAte: validade(20),
    });
    const r = await enviar(p12, "s3nh@-forte");
    // E-02.6: sem acento confere com o RT
    expect(r).toMatchObject({ titular: "Jose da Conceicao", aviso: null });
    const [row] = await owner`SELECT encrypted_pkcs12, encrypted_password, encryption_key_ref,
        holder_name, serial_number, issuer_name, is_current, created_by_user_id
      FROM rt_certificate WHERE id = ${r.id}`;
    const blobP12 = row?.encrypted_pkcs12 as Buffer;
    const blobSenha = row?.encrypted_password as Buffer;
    expect(blobP12.includes(p12.subarray(0, 64))).toBe(false);
    expect(blobSenha.includes(Buffer.from("s3nh@-forte"))).toBe(false);
    expect(decifrar(chave, blobP12, "rt_certificate:pkcs12").equals(p12)).toBe(true);
    expect(decifrar(chave, blobSenha, "rt_certificate:senha").toString()).toBe("s3nh@-forte");
    expect(row).toMatchObject({
      encryption_key_ref: chave.ref,
      holder_name: "Jose da Conceicao",
      serial_number: "0A1B2C3D",
      issuer_name: "AC Teste PMOC",
      is_current: true,
      created_by_user_id: admCtx().userId,
    });
    const [audit] = await owner`SELECT new_values::text AS v FROM audit_log
      WHERE table_name = 'rt_certificate' AND record_id = ${r.id} AND action = 'INSERT'`;
    expect(audit?.v).toContain('"encrypted_pkcs12": "***"');
    expect(audit?.v).toContain('"encrypted_password": "***"');
    // RN-153: 20 dias para vencer → A_VENCER
    const c = await obterConfiguracao(admCtx(), deps);
    expect(c?.certificadoAtual).toMatchObject({ id: r.id, estado: "A_VENCER", diasParaVencer: 20 });
    expect(Object.keys(c?.certificadoAtual ?? {})).not.toContain("encrypted_pkcs12");
  });

  it("E-02.6: titular diferente avisa sem bloquear; o novo substitui o atual e o anterior vai ao histórico", async () => {
    const p12 = gerarPkcs12({
      nome: "Maria Silva",
      senha: "x",
      validoDe: validade(-1),
      validoAte: validade(400),
    });
    const r = await enviar(p12, "x");
    expect(r.aviso).toBe("O titular do certificado (Maria Silva) é diferente do RT cadastrado.");
    const c = await obterConfiguracao(admCtx(), deps);
    expect(c?.certificadoAtual).toMatchObject({ id: r.id, estado: "VALIDO", atual: true });
    expect(c?.historico).toHaveLength(1);
    expect(c?.historico[0]?.atual).toBe(false);
    expect(
      (await owner`SELECT count(*)::int AS n FROM rt_certificate WHERE is_current`)[0]?.n,
    ).toBe(1);
  });
});

describe("permissões (RF-03)", () => {
  it("CLIENTE e TECNICO não leem nem gravam empresa, RT, certificado ou logo", async () => {
    for (const ctx of [clientCtx("A"), technicianCtx()]) {
      expect(await obterConfiguracao(ctx, deps)).toBeNull();
      await expect(salvarEmpresa(ctx, { rowVersion: 1, ...dadosEmpresa }, deps)).rejects.toThrow(
        /Sem permissão/,
      );
      await expect(salvarRt(ctx, { rowVersion: 1, ...dadosRt }, deps)).rejects.toThrow(
        /Sem permissão/,
      );
      await expect(
        enviarCertificado(ctx, { nomeArquivo: "rt.pfx", arquivo: "AA==", senha: "x" }, deps),
      ).rejects.toThrow(/Sem permissão/);
      await expect(
        prepararEnvio(
          ctx,
          {
            finalidade: "LOGO_EMPRESA",
            nome: null,
            mime: "image/png",
            tamanho: 10,
            sha256: "0".repeat(64),
          },
          arquivos,
        ),
      ).rejects.toThrow(/Sem permissão/);
    }
  });
});

describe("E-02.7 (RF-04.5)", () => {
  it("depois da 1ª emissão de algum PMOC, a configuração avisa", async () => {
    await owner.begin(async (tx) => {
      await tx`SELECT set_config('app.source', 'SISTEMA', true)`;
      const [c] = await tx`INSERT INTO client (legal_name, cnpj, address_street, address_number,
          address_city, address_state, address_zip)
        VALUES ('Cliente E-02.7', '11222333000181', 'Rua', '1', 'Joinville', 'SC', '89201000') RETURNING id`;
      const [s] = await tx`INSERT INTO site (client_id, name, address_street, address_number,
          address_city, address_state, address_zip)
        VALUES (${c?.id}, 'Unidade', 'Rua', '1', 'Joinville', 'SC', '89201000') RETURNING id`;
      const [k] = await tx`INSERT INTO contract (site_id, start_date, end_date, art_number, status)
        VALUES (${s?.id}, '2026-01-01', '2026-12-31', 'ART', 'VIGENTE') RETURNING id`;
      await tx`INSERT INTO pmoc (contract_id, status, current_version_number, first_issued_at)
        VALUES (${k?.id}, 'EMITIDO', 1, now())`;
    });
    expect((await obterConfiguracao(admCtx(), deps))?.houveEmissao).toBe(true);
  });
});
