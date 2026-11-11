import "server-only";
import { type ArquivosDeps, confirmarEnvioNaTransacao } from "@/modules/arquivos";
import { can } from "@/modules/autorizacao";
import type { RequestContext } from "@/server/context";
import { type ChaveCifra, cifrar } from "@/server/crypto";
import type { Database, Tx } from "@/server/db";
import { restricaoViolada } from "@/server/db/errors";
import {
  CERTIFICADO_MAX,
  type DadosCertificado,
  diasParaVencer,
  ErroPkcs12,
  type EstadoCertificado,
  estadoDoCertificado,
  extensaoAceita,
  lerPkcs12,
  titularConfere,
} from "./domain/certificado";
import * as repo from "./repo";
import {
  type EnviarCertificadoInput,
  enviarCertificadoSchema,
  type SalvarEmpresaInput,
  type SalvarRtInput,
  salvarEmpresaSchema,
  salvarRtSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroEmpresa extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "ALTERADO_POR_OUTRO"
      | "SEM_RT"
      | "CERTIFICADO"
      | "NAO_CONFIGURADO"
      | "VALIDACAO",
    message: string,
    readonly campo?: string,
  ) {
    super(message);
  }
}

export interface EmpresaDeps {
  db: Database;
  arquivos: ArquivosDeps;
  /** `CERT_ENCRYPTION_KEY` (05 §3.13). `null` = não configurada: o envio do certificado recusa. */
  chaveCertificado: ChaveCifra | null;
}

/** RF-03: empresa, RT e certificado são só do ADM. */
const exigir = (ctx: RequestContext) => {
  if (!can(ctx, "empresa.gerenciar")) {
    throw new ErroEmpresa("SEM_PERMISSAO", "Sem permissão para alterar a empresa e o RT.");
  }
};

const conflito = () =>
  new ErroEmpresa(
    "ALTERADO_POR_OUTRO",
    "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  );

/** Escrita com tradução das restrições do banco (a transação já foi desfeita aqui). */
async function escrever<T>(ctx: RequestContext, deps: EmpresaDeps, fn: (tx: Tx) => Promise<T>) {
  try {
    return await deps.db.withTransaction(ctx, fn);
  } catch (e) {
    // Dois "primeiro salvar" ao mesmo tempo, ou dois certificados atuais (CA-04.1; índice parcial).
    const r = restricaoViolada(e);
    if (
      r === "executor_company_singleton_key" ||
      r === "technical_responsible_singleton_key" ||
      r === "rt_certificate_current_uq"
    ) {
      throw conflito();
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Leitura (TL-102, TL-103)
// ---------------------------------------------------------------------------------------------

export interface CertificadoExibido extends repo.Certificado {
  estado: EstadoCertificado;
  diasParaVencer: number;
}

export interface Configuracao {
  /** `null` = primeiro acesso: "Configure a empresa executora" (TL-102 Vazio). */
  empresa: repo.Empresa | null;
  rt: repo.Rt | null;
  /** RN-153 calculado agora. */
  certificadoAtual: CertificadoExibido | null;
  historico: CertificadoExibido[];
  /** E-02.7. */
  houveEmissao: boolean;
}

/** TL-102 e TL-103 abertos. Só ADM; os demais recebem `null` (a área já é só do ADM). */
export async function obterConfiguracao(
  ctx: RequestContext,
  deps: EmpresaDeps,
  agora = new Date(),
): Promise<Configuracao | null> {
  if (!can(ctx, "empresa.gerenciar")) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const exibir = (c: repo.Certificado): CertificadoExibido => ({
      ...c,
      estado: estadoDoCertificado(c.validoAte, agora),
      diasParaVencer: diasParaVencer(c.validoAte, agora),
    });
    const certificados = (await repo.listarCertificados(tx)).map(exibir);
    return {
      empresa: await repo.buscarEmpresa(tx),
      rt: await repo.buscarRt(tx),
      certificadoAtual: certificados.find((c) => c.atual) ?? null,
      historico: certificados.filter((c) => !c.atual),
      houveEmissao: await repo.houveEmissao(tx),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Escrita (FL-02)
// ---------------------------------------------------------------------------------------------

/**
 * FL-02 passo 2 / TL-102 "Salvar empresa". Sem empresa, cria (com logo obrigatório); com empresa,
 * edita (nunca "criar outra", CA-04.1). O logo novo é confirmado na mesma transação (SEG-53).
 * Alterar não muda PMOC emitido (RF-04.5): o PDF emitido é imutável.
 */
export async function salvarEmpresa(
  ctx: RequestContext,
  input: SalvarEmpresaInput,
  deps: EmpresaDeps,
): Promise<void> {
  exigir(ctx);
  const v = salvarEmpresaSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const atual = await repo.buscarEmpresa(tx);
    if (!atual && !v.logo) throw new ErroEmpresa("VALIDACAO", "Envie o logo da empresa.", "logo");
    // Já existe e a tela achava que não (ou o contrário): outro ADM salvou antes.
    if (Boolean(atual) !== (v.rowVersion !== null)) throw conflito();
    const logoId = v.logo
      ? (await confirmarEnvioNaTransacao(tx, ctx, v.logo, "LOGO_EMPRESA", deps.arquivos)).id
      : null;
    if (!atual) return repo.inserirEmpresa(tx, v, logoId as string);
    if (!(await repo.atualizarEmpresa(tx, v, logoId, v.rowVersion as number))) throw conflito();
  });
}

/** FL-02 passo 3 / TL-102 "Salvar RT": cria o registro único ou edita (DEC-14, DEC-29). */
export async function salvarRt(
  ctx: RequestContext,
  input: SalvarRtInput,
  deps: EmpresaDeps,
): Promise<void> {
  exigir(ctx);
  const v = salvarRtSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const atual = await repo.buscarRt(tx);
    if (Boolean(atual) !== (v.rowVersion !== null)) throw conflito();
    if (!atual) return repo.inserirRt(tx, v);
    if (!(await repo.atualizarRt(tx, v, v.rowVersion as number))) throw conflito();
  });
}

const fmtData = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

/**
 * FL-02 passos 4–6 / TL-103 "Enviar certificado" (RF-04.4; DM-11; SEG-54): o arquivo é lido em memória,
 * aberto com a senha e gravado cifrado com a senha (AES-256-GCM). Nada é gravado se a senha está
 * errada (E-02.3), se o arquivo é ilegível (E-02.4) ou se já venceu (E-02.5). Titular diferente do RT
 * só avisa (E-02.6). Arquivo e senha nunca vão para log nem para a tela (RN-121).
 */
export async function enviarCertificado(
  ctx: RequestContext,
  input: EnviarCertificadoInput,
  deps: EmpresaDeps,
  agora = new Date(),
): Promise<{ id: string; titular: string; validoAte: Date; aviso: string | null }> {
  exigir(ctx);
  const v = enviarCertificadoSchema.parse(input);
  const chave = deps.chaveCertificado;
  if (!chave) {
    throw new ErroEmpresa(
      "NAO_CONFIGURADO",
      "A chave de cifra do certificado não está configurada no servidor.",
    );
  }
  if (!extensaoAceita(v.nomeArquivo)) {
    throw new ErroEmpresa(
      "CERTIFICADO",
      "Envie o arquivo .pfx ou .p12 do certificado A1.",
      "arquivo",
    );
  }
  const bytes = Buffer.from(v.arquivo, "base64");
  if (bytes.length === 0 || bytes.length > CERTIFICADO_MAX) {
    throw new ErroEmpresa("CERTIFICADO", "O arquivo do certificado tem até 50 KB.", "arquivo");
  }
  let dados: DadosCertificado;
  try {
    dados = lerPkcs12(bytes, v.senha);
  } catch (e) {
    if (!(e instanceof ErroPkcs12)) throw e;
    throw new ErroEmpresa("CERTIFICADO", e.message, e.codigo === "SENHA" ? "senha" : "arquivo");
  }
  // E-02.5 [A VALIDAR] (DFT-02): vencido no envio bloqueia.
  if (dados.validoAte.getTime() < agora.getTime()) {
    throw new ErroEmpresa(
      "CERTIFICADO",
      `Certificado vencido em ${fmtData(dados.validoAte)}.`,
      "arquivo",
    );
  }
  return escrever(ctx, deps, async (tx) => {
    const rt = await repo.buscarRt(tx);
    if (!rt)
      throw new ErroEmpresa("SEM_RT", "Cadastre o responsável técnico antes do certificado.");
    const id = await repo.substituirCertificadoAtual(tx, {
      rtId: rt.id,
      pkcs12: cifrar(chave, bytes, "rt_certificate:pkcs12"),
      senha: cifrar(chave, Buffer.from(v.senha, "utf8"), "rt_certificate:senha"),
      chaveRef: chave.ref,
      ...dados,
      usuarioId: ctx.userId,
    });
    // E-02.6: a cadeia ICP-Brasil não é verificada [A VALIDAR]; só o nome do titular.
    const aviso = titularConfere(dados.titular, rt.nome)
      ? null
      : `O titular do certificado (${dados.titular}) é diferente do RT cadastrado.`;
    return { id, titular: dados.titular, validoAte: dados.validoAte, aviso };
  });
}
