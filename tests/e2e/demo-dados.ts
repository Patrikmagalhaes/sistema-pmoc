/**
 * Dados fictícios do ambiente de demonstração (`demo.ts`): empresa com logo, RT e certificado A1 de
 * teste, 2 tipos de equipamento com atividades, um cliente com local, 4 equipamentos, um contrato de
 * 12 meses a partir do mês atual e o PMOC em `RASCUNHO`, pronto para "Emitir PMOC". Tudo pelos
 * serviços dos módulos, como a tela faria. Só para ver o sistema; nunca use dados reais aqui.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { SEED } from "../../db/seed/data";
import { type ArquivosDeps, prepararEnvio } from "../../src/modules/arquivos";
import { criarTipo, incluirAtividade, obterTipo } from "../../src/modules/biblioteca";
import { criarCliente, criarContrato, criarLocal } from "../../src/modules/clientes";
import {
  type EmpresaDeps,
  enviarCertificado,
  salvarEmpresa,
  salvarRt,
} from "../../src/modules/empresa";
import { criarEquipamento } from "../../src/modules/equipamentos";
import { criarPmoc } from "../../src/modules/pmoc";
import { buildContext } from "../../src/server/context";
import { chaveDeBase64 } from "../../src/server/crypto";
import type { Database } from "../../src/server/db";
import { armazenamentoLocal } from "../../src/server/storage";
import { gerarPkcs12 } from "../fixtures/certificado";

const ENDERECO = {
  logradouro: "Rua das Palmeiras",
  numero: "100",
  semNumero: false,
  bairro: "Centro",
  cidade: "Joinville",
  uf: "SC" as const,
  cep: "89201000",
};

/** CNPJ válido (dígitos verificadores calculados) a partir de uma base fixa de 12 dígitos. */
function cnpjDeDemonstracao(base = "123456780001"): string {
  const dv = (s: string, pesos: number[]) => {
    const r = pesos.reduce((a, p, i) => a + Number(s[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${dv(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}

export interface DadosDeDemo {
  clienteId: string;
  localId: string;
  contratoId: string;
  pmocId: string;
}

/**
 * Usa o ADM do seed (`SEED.admUserId`) como autor dos registros. `storageDir` e `segredo` são os mesmos
 * do `next dev` da demonstração, para ele achar o logo gravado aqui.
 */
export async function popularDemo(
  db: Database,
  o: { storageDir: string; segredo: string; certKey: string },
): Promise<DadosDeDemo> {
  const adm = () =>
    buildContext({
      userId: SEED.admUserId,
      role: "ADM",
      requestId: randomUUID(),
      source: "WEB_ADM",
    });
  const armazenamento = armazenamentoLocal(o.storageDir, o.segredo);
  const arquivos: ArquivosDeps = { db, armazenamento, segredo: o.segredo };
  const empresa: EmpresaDeps = {
    db,
    arquivos,
    chaveCertificado: chaveDeBase64(o.certKey),
  };
  const deps = { db };

  // Empresa e RT do seed apontam para um logo que não existe no armazenamento: refaz com logo de verdade.
  const [versoes] = (await db.withTransaction(adm(), (tx) =>
    tx.execute(sql`SELECT (SELECT row_version FROM executor_company LIMIT 1) AS empresa,
      (SELECT row_version FROM technical_responsible LIMIT 1) AS rt`),
  )) as unknown as { empresa: number; rt: number }[];

  const logo = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), randomBytes(32)]);
  const envio = await prepararEnvio(
    adm(),
    {
      finalidade: "LOGO_EMPRESA",
      nome: "logo.png",
      mime: "image/png",
      tamanho: logo.length,
      sha256: createHash("sha256").update(logo).digest("hex"),
    },
    arquivos,
  );
  const token = new URL(envio.url, "http://x").searchParams.get("t") ?? "";
  if ((await armazenamento.receber(token, logo, "image/png")) !== "OK") {
    throw new Error("não gravou o logo da demonstração");
  }
  await salvarEmpresa(
    adm(),
    {
      rowVersion: versoes?.empresa ?? null,
      logo: envio.comprovante,
      razaoSocial: "Climatização Demonstração Ltda",
      cnpj: "11.222.333/0001-81",
      telefone: "(47) 3333-0000",
      crea: "1388695",
      endereco: ENDERECO,
    },
    empresa,
  );
  await salvarRt(
    adm(),
    {
      rowVersion: versoes?.rt ?? null,
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
  const agora = Date.now();
  const p12 = gerarPkcs12({
    nome: "Jose da Conceicao",
    senha: "s3nha",
    validoDe: new Date(agora - 10 * dia),
    validoAte: new Date(agora + 300 * dia),
  });
  await enviarCertificado(
    adm(),
    { nomeArquivo: "rt-demonstracao.pfx", arquivo: p12.toString("base64"), senha: "s3nha" },
    empresa,
  );

  // Biblioteca: 2 tipos com 3 atividades cada (mensal, trimestral, anual).
  async function novoTipo(nome: string, sigla: string) {
    const { id } = await criarTipo(adm(), { nome, sigla, grupos: ["Padrão"] }, deps);
    const base = { tipoId: id, exigeFoto: false, natureza: "VERIFICACAO" as const };
    const atividades = [
      ["Verificar filtros de ar", "MM"],
      ["Limpar bandeja de condensado", "MT"],
      ["Inspeção geral e relatório anual", "MA"],
    ] as const;
    for (const [i, [titulo, periodicidade]] of atividades.entries()) {
      await incluirAtividade(adm(), { ...base, titulo, periodicidade, ordem: i + 1 }, deps);
    }
    const t = await obterTipo(adm(), id, deps);
    return { id, grupoId: t?.grupos[0]?.id as string };
  }
  const fancoil = await novoTipo("Fan coil (demonstração)", "FCD");
  const chiller = await novoTipo("Chiller (demonstração)", "CHD");

  // Cliente, local, equipamentos, contrato (12 meses a partir do mês atual) e o PMOC em rascunho.
  const { id: clienteId } = await criarCliente(
    adm(),
    {
      razaoSocial: "Hospital Demonstração S.A.",
      cnpj: cnpjDeDemonstracao(),
      endereco: ENDERECO,
    },
    deps,
  );
  const { id: localId } = await criarLocal(
    adm(),
    { clienteId, nome: "Unidade Centro", endereco: ENDERECO },
    deps,
  );
  const equipamentos = [
    [fancoil, "Sala de espera"],
    [fancoil, "Recepção"],
    [fancoil, "Consultório 1"],
    [chiller, "Casa de máquinas"],
  ] as const;
  for (const [t, ambiente] of equipamentos) {
    await criarEquipamento(adm(), { localId, tipoId: t.id, grupoId: t.grupoId, ambiente }, deps);
  }
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getFullYear() + 1, hoje.getMonth(), 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { id: contratoId } = await criarContrato(
    adm(),
    { localId, inicio: iso(inicio), fim: iso(fim), art: "ART-DEMO-1" },
    deps,
  );
  const { id: pmocId } = await criarPmoc(adm(), { contratoId, copiarDoAnterior: false }, deps);
  return { clienteId, localId, contratoId, pmocId };
}
