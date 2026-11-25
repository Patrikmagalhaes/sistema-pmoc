import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { gravarArquivoGeradoNaTransacao, lerArquivoNaTransacao } from "@/modules/arquivos";
import { can } from "@/modules/autorizacao";
import { ordenarAtividades, unidadeDaAtividade } from "@/modules/biblioteca";
import {
  buildSchedule,
  type MesDoContrato,
  mesesDoCronograma,
  mesesPrevistos,
} from "@/modules/cronograma";
import {
  certificadoParaAssinarNaTransacao,
  diasParaVencer,
  ErroEmpresa,
  estadoDoCertificado,
} from "@/modules/empresa";
import type { RequestContext } from "@/server/context";
import type { ChaveCifra } from "@/server/crypto";
import type { Database, Tx } from "@/server/db";
import { linhaTravada, restricaoViolada } from "@/server/db/errors";
import type { OpcoesAssinatura } from "@/server/pdf/assinar";
import type { EntradaPdfPmoc } from "@/server/pdf/pmoc";
import type { Armazenamento } from "@/server/storage";
import { codigoDeBytes, codigoImpresso } from "./domain/codigo-verificacao";
import { type VerificacaoPura, verificarPreCondicoes } from "./domain/emissao";
import { montarSnapshot } from "./domain/snapshot";
import { ANEXO1 } from "./domain/textos";
import * as repo from "./repo";
import {
  type AlterarPeriodicidadeInput,
  alterarPeriodicidadeSchema,
  type CriarPmocInput,
  comVersaoSchema,
  criarPmocSchema,
  emitirSchema,
  type IncluirNovaAtividadeInput,
  incluirDaBibliotecaSchema,
  incluirNovaSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroPmoc extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "ALTERADO_POR_OUTRO"
      | "JA_EXISTE"
      | "ESTADO"
      | "NAO_DISPONIVEL"
      | "VALIDACAO"
      | "PENDENCIAS"
      | "FALHA_EMISSAO",
    message: string,
    readonly campo?: string,
  ) {
    super(message);
  }
}

export interface PmocDeps {
  db: Database;
}

const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

const naoEncontrado = (o = "PMOC") => new ErroPmoc("NAO_ENCONTRADO", `${o} não encontrado.`);
const conflito = () =>
  new ErroPmoc(
    "ALTERADO_POR_OUTRO",
    "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  );
const jaExiste = () => new ErroPmoc("JA_EXISTE", "Este contrato já tem PMOC."); // E-08.1

/** Mensagem única para o que depende do recálculo pós-emissão (FL-09; RN-032, RN-065, RN-183). */
export const SEM_MUDAR_PLANO_EMITIDO = "Alterar o plano de PMOC emitido ainda não está disponível.";

/**
 * Montar o plano faz parte do fluxo de emissão (FL-08 passos 1–4): `pmoc.emitir`. Periodicidade tem
 * linha própria na matriz (DEC-07): `pmoc.periodicidade.alterar`. As duas são só do ADM (RN-168).
 */
function exigir(ctx: RequestContext, acao: "pmoc.emitir" | "pmoc.periodicidade.alterar") {
  if (!can(ctx, acao)) throw new ErroPmoc("SEM_PERMISSAO", "Sem permissão para alterar o PMOC.");
}

/** Escrita com tradução das restrições do banco (a transação já foi desfeita aqui). */
async function escrever<T>(
  ctx: RequestContext,
  deps: PmocDeps,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await deps.db.withTransaction(ctx, fn);
  } catch (e) {
    const r = restricaoViolada(e);
    if (r === "pmoc_contract_id_key") throw jaExiste();
    if (r === "pmoc_activity_template_uq") {
      throw new ErroPmoc("VALIDACAO", "A atividade já está no plano.");
    }
    throw e;
  }
}

/**
 * Trava o PMOC e confere que o plano pode mudar: só em `RASCUNHO` por enquanto (RN-006). `HISTORICO`
 * é somente leitura (RN-146); emitido espera o recálculo pós-emissão (FL-09).
 */
async function pmocEditavel(tx: Tx, pmocId: string): Promise<repo.Pmoc> {
  const p = await repo.buscarPmoc(tx, pmocId, true);
  if (!p) throw naoEncontrado();
  if (p.situacao === "HISTORICO") {
    throw new ErroPmoc("ESTADO", "PMOC histórico: somente leitura.");
  }
  if (p.situacao !== "RASCUNHO") throw new ErroPmoc("NAO_DISPONIVEL", SEM_MUDAR_PLANO_EMITIDO);
  return p;
}

/** Atividade do plano com o PMOC dela já travado e editável. */
async function atividadeEditavel(tx: Tx, id: string) {
  const a = await repo.buscarAtividade(tx, id);
  if (!a) throw naoEncontrado("Atividade");
  const p = await pmocEditavel(tx, a.pmocId);
  return { a, p };
}

/**
 * RN-014: PMOC do contrato → `HISTORICO`. Recebe a transação de quem chama (cancelamento, RN-144;
 * "Confirmar renovação", RN-192), para a mudança do contrato e a do PMOC valerem juntas ou nenhuma.
 * A permissão é conferida por quem chama, antes de abrir a transação (MOD-04).
 */
export function tornarHistoricoNaTransacao(tx: Tx, contratoId: string): Promise<boolean> {
  return repo.tornarHistorico(tx, contratoId);
}

// ---------------------------------------------------------------------------------------------
// Criação (FL-08 passos 1–3)
// ---------------------------------------------------------------------------------------------

/**
 * TL-112 "Criar PMOC": `RASCUNHO` com o plano copiado da biblioteca (RN-002) ou, se o ADM pediu, do
 * PMOC do contrato anterior (RN-004). Tipo presente que a cópia do anterior não trouxe recebe as
 * atividades da biblioteca, como o tipo novo da FL-07 passo 5 (inferido de RN-002). Local sem
 * equipamento `ATIVO` dá plano vazio (E-08.2).
 */
export async function criarPmoc(
  ctx: RequestContext,
  input: CriarPmocInput,
  deps: PmocDeps,
): Promise<{ id: string }> {
  exigir(ctx, "pmoc.emitir");
  const v = criarPmocSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    const k = await repo.travarContrato(tx, v.contratoId);
    if (!k) throw naoEncontrado("Contrato");
    if (k.situacao === "ENCERRADO" || k.situacao === "CANCELADO") {
      throw new ErroPmoc("ESTADO", "Contrato encerrado não emite PMOC."); // RN-017, E-08.5
    }
    if (k.pmocId) throw jaExiste();
    if (v.copiarDoAnterior && !k.anteriorPmocId) {
      throw new ErroPmoc("VALIDACAO", "O contrato anterior não tem PMOC para copiar.");
    }
    const anterior = v.copiarDoAnterior ? k.anteriorPmocId : null;
    const id = await repo.inserirPmoc(tx, k.id, anterior);
    if (anterior) await repo.copiarDoAnterior(tx, id, anterior, k.localId);
    await repo.copiarDaBiblioteca(tx, id, k.localId);
    return { id };
  });
}

/**
 * FL-07 passo 5 (DFT-05): equipamento de um tipo que não estava no plano entrou no local (inclusão
 * ou reativação). Cada PMOC `RASCUNHO` do local recebe as atividades `ATIVO` desse tipo, com a
 * periodicidade padrão. Tipo que já tem linha no plano (mesmo removida) não muda: a escolha do ADM
 * vale. Recebe a transação de quem chama (MOD-05a); a permissão é conferida por ele.
 */
export async function incluirTipoNoPlanoNaTransacao(
  tx: Tx,
  localId: string,
  tipoId: string,
): Promise<void> {
  for (const pmocId of await repo.rascunhosDoLocal(tx, localId)) {
    await repo.copiarDaBiblioteca(tx, pmocId, localId, tipoId);
  }
}

// ---------------------------------------------------------------------------------------------
// Leitura (TL-120)
// ---------------------------------------------------------------------------------------------

export interface AtividadeNoPlano extends repo.AtividadePlano {
  /** RN-023: meses previstos no contrato (aba Cronograma). */
  previstos: number[];
}

export interface TipoNoPlano extends repo.TipoDoPlano {
  /** Atividades do plano, na ordem da RN-051. */
  atividades: AtividadeNoPlano[];
  /** Retiradas do plano (RF-10.3); voltam pela mesma linha (RN-184). */
  removidas: repo.AtividadePlano[];
  /** Da biblioteca, `ATIVO`, ainda fora do plano ("Incluir atividade"). */
  disponiveis: repo.ModeloDisponivel[];
}

export interface PmocCompleto extends repo.Pmoc {
  tipos: TipoNoPlano[];
  /** Colunas do cronograma: meses 1..N com mês/ano (RN-021). */
  calendario: MesDoContrato[];
  /** Células previstas do cronograma (equipamento × atividade × mês, DM-04). */
  ocorrenciasPrevistas: number;
  /** Aba Plano editável: `RASCUNHO` e ADM. */
  podeAlterarPlano: boolean;
  /** Aba "Versões e assinaturas", da mais nova para a mais antiga (vazia em `RASCUNHO`). */
  versoes: repo.VersaoDoPmoc[];
}

/**
 * TL-120. `null` = não encontrado ou sem acesso: de outro cliente (RN-162), ou rascunho e histórico
 * nunca emitido para quem não é ADM (RN-147).
 */
export async function obterPmoc(
  ctx: RequestContext,
  id: string,
  deps: PmocDeps,
): Promise<PmocCompleto | null> {
  if (!ehUuid(id)) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const p = await repo.buscarPmoc(tx, id);
    if (!p || !can(ctx, "pmoc.ler", { clientId: p.clienteId })) return null;
    if (ctx.role !== "ADM" && !p.emitidoAlgumaVez) return null;

    const [plano, tipos, equipamentos, versoes] = await Promise.all([
      repo.listarPlano(tx, p.id),
      repo.tiposDoPlano(tx, p.id, p.localId),
      repo.equipamentosAtivos(tx, p.localId),
      repo.listarVersoes(tx, p.id),
    ]);
    const disponiveis = await repo.modelosDisponiveis(
      tx,
      p.id,
      tipos.map((t) => t.id),
    );
    const vivas = plano.filter((a) => !a.removida);
    return {
      ...p,
      tipos: tipos.map((t) => ({
        ...t,
        atividades: ordenarAtividades(vivas.filter((a) => a.tipoId === t.id)).map((a) => ({
          ...a,
          previstos: mesesPrevistos(a.periodicidade, p.meses),
        })),
        removidas: plano.filter((a) => a.removida && a.tipoId === t.id),
        disponiveis: disponiveis.filter((d) => d.tipoId === t.id),
      })),
      calendario: mesesDoCronograma(p.inicio, p.meses),
      ocorrenciasPrevistas: buildSchedule(p, vivas, equipamentos).length,
      podeAlterarPlano: p.situacao === "RASCUNHO" && can(ctx, "pmoc.emitir"),
      versoes,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Verificação da emissão (FL-08 passo 7; TL-121 `VERIFICANDO` → `PENDENCIAS` | `PRONTO`)
// ---------------------------------------------------------------------------------------------

export interface VerificacaoEmissao extends VerificacaoPura {
  /** Resumo do estado `PRONTO` da TL-121. */
  resumo: {
    equipamentos: number;
    atividades: number;
    ocorrencias: number;
    /** RN-060: uma visita `A_AGENDAR` por mês com ≥ 1 ocorrência prevista. */
    visitas: number;
  };
}

/**
 * TL-121: confere **todas** as pré-condições (RN-007, RN-008, RN-017) sem gravar nada (E-08.3). Só
 * para a 1ª emissão, a partir de `RASCUNHO`; nova versão (FL-09) chega depois. A emissão volta a
 * conferir na própria transação, então esta leitura é só para a tela.
 */
export async function verificarEmissao(
  ctx: RequestContext,
  pmocId: string,
  deps: PmocDeps,
  agora = new Date(),
): Promise<VerificacaoEmissao> {
  exigir(ctx, "pmoc.emitir");
  if (!ehUuid(pmocId)) throw naoEncontrado();
  return deps.db.withTransaction(ctx, async (tx) => {
    const p = await repo.buscarPmoc(tx, pmocId);
    if (!p) throw naoEncontrado();
    if (p.situacao !== "RASCUNHO") {
      throw new ErroPmoc(
        "NAO_DISPONIVEL",
        "Nova versão de PMOC emitido ainda não está disponível.",
      );
    }
    const [d, plano, equipamentos] = await Promise.all([
      repo.dadosParaEmissao(tx, p),
      repo.listarPlano(tx, p.id),
      repo.equipamentosAtivos(tx, p.localId),
    ]);
    const c = d.certificado;
    const v = verificarPreCondicoes({
      empresaCadastrada: d.empresaCadastrada,
      rtCadastrado: d.rtCadastrado,
      certificado: c && {
        tipo: c.tipo,
        estado: estadoDoCertificado(c.validoAte, agora),
        dias: diasParaVencer(c.validoAte, agora),
      },
      art: d.art,
      situacaoContrato: p.situacaoContrato,
      equipamentosAtivos: equipamentos.length,
      atividadesNoPlano: d.atividadesNoPlano,
    });
    const ocorrencias = buildSchedule(
      p,
      plano.filter((a) => !a.removida),
      equipamentos,
    );
    return {
      ...v,
      resumo: {
        equipamentos: equipamentos.length,
        atividades: d.atividadesNoPlano,
        ocorrencias: ocorrencias.length,
        visitas: new Set(ocorrencias.map((o) => o.indice)).size,
      },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Plano (RF-10; FL-08 passos 4–5)
// ---------------------------------------------------------------------------------------------

/**
 * TL-120 "Periodicidade": vale para todos os equipamentos do tipo neste PMOC (RN-026; CA-10.1) e não
 * toca a biblioteca (RN-003). Em `RASCUNHO`, o cronograma é recalculado na leitura (RN-006, DM-05).
 * A auditoria guarda quem, quando e os valores anterior e novo (CA-10.2), por trigger.
 */
export async function alterarPeriodicidade(
  ctx: RequestContext,
  input: AlterarPeriodicidadeInput,
  deps: PmocDeps,
): Promise<void> {
  exigir(ctx, "pmoc.periodicidade.alterar");
  const v = alterarPeriodicidadeSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const { a } = await atividadeEditavel(tx, v.id);
    if (a.removida) throw new ErroPmoc("ESTADO", "A atividade não está no plano.");
    if (!(await repo.alterarPeriodicidade(tx, v.id, v.periodicidade, v.rowVersion))) {
      throw conflito();
    }
  });
}

/** TL-120 "Remover" (RF-10.3 [A VALIDAR]): a linha fica com `removed_at` (EL-8). */
export async function removerAtividadeDoPlano(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: PmocDeps,
): Promise<void> {
  exigir(ctx, "pmoc.emitir");
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const { a } = await atividadeEditavel(tx, v.id);
    if (a.removida) throw new ErroPmoc("ESTADO", "A atividade já foi removida do plano.");
    if (!(await repo.removerAtividade(tx, v.id, ctx.userId, v.rowVersion))) throw conflito();
  });
}

/** TL-120 "Incluir" de uma atividade removida: volta pela mesma linha (RN-184; RF-10.3). */
export async function restaurarAtividadeDoPlano(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: PmocDeps,
): Promise<void> {
  exigir(ctx, "pmoc.emitir");
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const { a } = await atividadeEditavel(tx, v.id);
    if (!a.removida) throw new ErroPmoc("ESTADO", "A atividade já está no plano.");
    if (!(await repo.restaurarAtividade(tx, v.id, v.rowVersion))) throw conflito();
  });
}

/** Tipos em que o plano aceita atividade: os do plano e os presentes no local (aba Plano). */
async function tipoDoPlano(tx: Tx, p: repo.Pmoc, tipoId: string): Promise<void> {
  const tipos = await repo.tiposDoPlano(tx, p.id, p.localId);
  if (!tipos.some((t) => t.id === tipoId)) {
    throw new ErroPmoc("VALIDACAO", "O tipo não está neste PMOC.", "tipoId");
  }
}

/**
 * TL-120 "Incluir" da biblioteca (RF-10.3 [A VALIDAR]): atividade `ATIVO` (RN-152) de um tipo do
 * PMOC, ainda sem linha no plano, com a periodicidade padrão (RN-002).
 */
export async function incluirAtividadeDaBiblioteca(
  ctx: RequestContext,
  input: { pmocId: string; modeloId: string },
  deps: PmocDeps,
): Promise<{ id: string }> {
  exigir(ctx, "pmoc.emitir");
  const v = incluirDaBibliotecaSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    const p = await pmocEditavel(tx, v.pmocId);
    const tipos = await repo.tiposDoPlano(tx, p.id, p.localId);
    const disponiveis = await repo.modelosDisponiveis(
      tx,
      p.id,
      tipos.map((t) => t.id),
    );
    if (!disponiveis.some((d) => d.id === v.modeloId)) {
      throw new ErroPmoc("VALIDACAO", "Esta atividade não pode ser incluída neste plano.");
    }
    const id = await repo.incluirModelo(tx, p.id, v.modeloId);
    if (!id) throw new ErroPmoc("VALIDACAO", "Esta atividade não pode ser incluída neste plano.");
    return { id };
  });
}

/**
 * TL-120 "Incluir" de atividade nova (RF-10.3 [A VALIDAR]; 03 `pmoc_activity.activity_template_id`
 * `NULL`): só deste PMOC, com os campos da RN-043 e a unidade da RN-042. Título repetido no tipo é
 * recusado, como na biblioteca (inferido de 03 `activity_template`).
 */
export async function incluirAtividadeNova(
  ctx: RequestContext,
  input: IncluirNovaAtividadeInput,
  deps: PmocDeps,
): Promise<{ id: string }> {
  exigir(ctx, "pmoc.emitir");
  const v = incluirNovaSchema.parse(input);
  const u = unidadeDaAtividade(v.natureza, v.unidade);
  if (!u.ok) throw new ErroPmoc("VALIDACAO", u.problema.mensagem, u.problema.campo);
  return escrever(ctx, deps, async (tx) => {
    const p = await pmocEditavel(tx, v.pmocId);
    await tipoDoPlano(tx, p, v.tipoId);
    const titulo = v.titulo.toLocaleLowerCase("pt-BR");
    const repetida = (await repo.listarPlano(tx, p.id)).some(
      (a) => !a.removida && a.tipoId === v.tipoId && a.titulo.toLocaleLowerCase("pt-BR") === titulo,
    );
    if (repetida) {
      throw new ErroPmoc("VALIDACAO", "Já existe atividade com este título no tipo.", "titulo");
    }
    const id = await repo.incluirNova(tx, p.id, v.tipoId, {
      titulo: v.titulo,
      periodicidade: v.periodicidade,
      natureza: v.natureza,
      unidade: u.unidade,
      exigeFoto: v.exigeFoto,
    });
    return { id };
  });
}

// ---------------------------------------------------------------------------------------------
// Emissão (FL-08 passo 11; TL-121 `PROCESSANDO` → `CONCLUIDO` | `ERRO`)
// ---------------------------------------------------------------------------------------------

/**
 * O que a emissão usa fora do banco. Injetado por quem chama (MOD-04): o módulo não importa o gerador
 * nem o assinador (`src/server/pdf`), e os testes trocam cada passo para provar que a falha desfaz tudo.
 */
export interface EmissaoDeps extends PmocDeps {
  armazenamento: Armazenamento;
  /** `CERT_ENCRYPTION_KEY` (05 §3.13). */
  chaveCertificado: ChaveCifra | null;
  gerarPdf(e: EntradaPdfPmoc): Promise<Buffer>;
  assinarPdf(
    pdf: Buffer,
    certificado: { pkcs12: Buffer; senha: string },
    o: OpcoesAssinatura,
  ): Promise<Buffer>;
  /** Link do rodapé para a TL-007 (`/verificar/{codigo}`). */
  urlVerificacao(codigo: string): string;
  /** `APP_VERSION` (INT-21). */
  versaoApp: string;
  /** 16 bytes aleatórios do código de verificação (os testes fixam). */
  bytesAleatorios?: () => Uint8Array;
}

export interface ResultadoEmissao {
  versao: number;
  versaoId: string;
  arquivoId: string;
  ocorrencias: number;
  visitas: number;
  notificados: number;
}

/** E-08.6: a mensagem da tela nunca leva o detalhe técnico (que vai só para o log). */
const FALHA_EMISSAO = "A emissão não foi concluída e nada foi alterado. Tente novamente.";

type PassoEmissao =
  | "VERIFICAR"
  | "RETRATO"
  | "GERAR_PDF"
  | "ASSINAR"
  | "GRAVAR_PDF"
  | "VERSAO"
  | "OCORRENCIAS"
  | "VISITAS"
  | "NOTIFICAR";

/** Parágrafos do texto padrão: separados por linha em branco. */
const paragrafos = (corpo: string) =>
  corpo
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * RN-009: em **uma** transação e nesta ordem, (1) gera o PDF, (2) assina com o A1 do RT (RN-120),
 * (3) grava a versão 1 `AGUARDANDO_ASSINATURA` e passa o PMOC a `EMITIDO`, (4) grava o cronograma em
 * `occurrence` (HM-1), (5) cria as visitas `A_AGENDAR` (RN-060) e (6) notifica os usuários do cliente
 * (RN-101). Falha em qualquer passo desfaz todos (E-08.6). Síncrona (RN-188).
 *
 * O PMOC fica travado do início ao fim: outra emissão simultânea recebe `ALTERADO_POR_OUTRO` na hora
 * (E-08.8), sem esperar. As pré-condições (RN-007, RN-008, RN-017) são conferidas de novo aqui; faltando
 * algo, nada é gravado (`PENDENCIAS`).
 */
export async function emitirPmoc(
  ctx: RequestContext,
  input: { pmocId: string; rowVersion: number },
  deps: EmissaoDeps,
  agora = new Date(),
): Promise<ResultadoEmissao> {
  exigir(ctx, "pmoc.emitir");
  const v = emitirSchema.parse(input);
  let passo: PassoEmissao = "VERIFICAR";
  try {
    return await deps.db.withTransaction(ctx, async (tx) => {
      const p = await repo.buscarPmoc(tx, v.pmocId, "SEM_ESPERAR");
      if (!p) throw naoEncontrado();
      if (p.rowVersion !== v.rowVersion) throw conflito();
      if (p.situacao !== "RASCUNHO") {
        throw new ErroPmoc(
          "NAO_DISPONIVEL",
          "Nova versão de PMOC emitido ainda não está disponível.",
        );
      }
      const d = await repo.dadosParaEmissao(tx, p);
      const c = d.certificado;
      const ativos = await repo.equipamentosAtivos(tx, p.localId);
      const { pendencias } = verificarPreCondicoes({
        empresaCadastrada: d.empresaCadastrada,
        rtCadastrado: d.rtCadastrado,
        certificado: c && {
          tipo: c.tipo,
          estado: estadoDoCertificado(c.validoAte, agora),
          dias: diasParaVencer(c.validoAte, agora),
        },
        art: d.art,
        situacaoContrato: p.situacaoContrato,
        equipamentosAtivos: ativos.length,
        atividadesNoPlano: d.atividadesNoPlano,
      });
      if (pendencias.length > 0) {
        throw new ErroPmoc("PENDENCIAS", "Falta completar dados antes de emitir. Confira a lista.");
      }

      passo = "RETRATO";
      const dados = await repo.dadosDoDocumento(tx, p);
      const recomendacoes = await repo.textoPadrao(tx, "RECOMENDACOES_PMOC");
      if (!dados || !recomendacoes) throw new Error("retrato incompleto");
      const snapshot = montarSnapshot({
        ...dados,
        textos: {
          recomendacoes: {
            versao: String(recomendacoes.versao),
            paragrafos: paragrafos(recomendacoes.corpo),
          },
          anexo1: {
            versao: ANEXO1.versao,
            titulo: ANEXO1.titulo,
            paragrafos: [...ANEXO1.paragrafos],
          },
        },
      });
      const logo = dados.empresa.logoArquivoId
        ? await lerArquivoNaTransacao(tx, dados.empresa.logoArquivoId, deps.armazenamento)
        : null;
      const codigo = codigoDeBytes(deps.bytesAleatorios?.() ?? randomBytes(16));
      const versao = 1;

      passo = "GERAR_PDF";
      const pdf = await deps.gerarPdf({
        snapshot,
        versao,
        codigoVerificacao: codigoImpresso(codigo),
        urlVerificacao: deps.urlVerificacao(codigo),
        geradoEm: agora,
        logo: logo && {
          dados: logo.bytes,
          formato: logo.mime === "image/png" ? "png" : "jpg",
        },
        assinaturaRt: { em: agora },
      });

      passo = "ASSINAR";
      const certificado = await certificadoParaAssinarNaTransacao(tx, deps.chaveCertificado);
      if (!certificado) throw new Error("sem certificado A1 vigente");
      const { endereco } = snapshot.empresa;
      const assinado = await deps.assinarPdf(pdf, certificado, {
        nome: snapshot.rt.nome,
        motivo: "Responsável técnico pelo PMOC",
        local: `${endereco.cidade}/${endereco.uf}`,
        quando: agora,
      });

      passo = "GRAVAR_PDF";
      const arquivo = await gravarArquivoGeradoNaTransacao(
        tx,
        { tipo: "PMOC_PDF", clienteId: p.clienteId, bytes: assinado },
        deps.armazenamento,
        agora,
      );

      passo = "VERSAO";
      const versaoId = await repo.inserirVersao(tx, {
        pmocId: p.id,
        numero: versao,
        motivo: null,
        snapshot,
        arquivoId: arquivo.id,
        sha256: arquivo.sha256,
        certificadoId: certificado.id,
        emitidaEm: agora,
        emitidaPor: ctx.userId as string,
        versaoRenderizador: deps.versaoApp,
        codigoVerificacao: codigo,
      });
      if (!(await repo.marcarEmitido(tx, p.id, versao, agora))) throw conflito();

      passo = "OCORRENCIAS";
      const plano = dados.atividades.filter((a) => !a.removida);
      const ocorrencias = await repo.inserirOcorrencias(
        tx,
        p.id,
        buildSchedule(snapshot.contrato, plano, ativos),
      );

      passo = "VISITAS";
      const visitas = await repo.criarVisitasDoCronograma(tx, p.id, p.localId);

      passo = "NOTIFICAR";
      const notificados = await repo.notificarClientes(tx, p, versao);

      return { versao, versaoId, arquivoId: arquivo.id, ocorrencias, visitas, notificados };
    });
  } catch (e) {
    if (e instanceof ErroPmoc || e instanceof z.ZodError) throw e;
    if (linhaTravada(e)) throw conflito(); // E-08.8: outra emissão do mesmo PMOC em andamento
    const r = restricaoViolada(e);
    if (r === "pmoc_version_pmoc_id_version_number_key" || r === "pmoc_version_current_uq") {
      throw conflito();
    }
    // E-08.6: detalhe só no log do servidor, sem dados do certificado (RN-121, LG-30).
    const codigoErro =
      e instanceof ErroEmpresa
        ? e.codigo
        : ((e as { codigo?: string })?.codigo ?? (e as Error)?.name);
    console.error(
      JSON.stringify({ evento: "emissao_pmoc_falhou", pmocId: v.pmocId, passo, erro: codigoErro }),
    );
    if (e instanceof ErroEmpresa && e.codigo === "NAO_CONFIGURADO") {
      throw new ErroPmoc("FALHA_EMISSAO", `${FALHA_EMISSAO} ${e.message}`);
    }
    throw new ErroPmoc("FALHA_EMISSAO", FALHA_EMISSAO);
  }
}
