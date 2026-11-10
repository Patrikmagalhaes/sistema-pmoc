import "server-only";
import { can } from "@/modules/autorizacao";
import type { RequestContext } from "@/server/context";
import type { Database, Tx } from "@/server/db";
import { restricaoViolada } from "@/server/db/errors";
import {
  deixariaSemGrupoAtivo,
  ordenarAtividades,
  podeExcluir,
  unidadeDaAtividade,
} from "./domain/biblioteca";
import * as repo from "./repo";
import {
  type AtualizarAtividadeInput,
  type AtualizarTipoInput,
  atualizarAtividadeSchema,
  atualizarTipoSchema,
  type CriarTipoInput,
  comVersaoSchema,
  criarTipoSchema,
  type IncluirAtividadeInput,
  incluirAtividadeSchema,
  incluirGrupoSchema,
  renomearGrupoSchema,
} from "./schemas";

/** Erro de regra do módulo; `codigo` é estável e `campo` leva a mensagem ao campo (UF-02). */
export class ErroBiblioteca extends Error {
  constructor(
    readonly codigo:
      | "SEM_PERMISSAO"
      | "NAO_ENCONTRADO"
      | "ALTERADO_POR_OUTRO"
      | "DUPLICADO"
      | "SIGLA_TRAVADA"
      | "EM_USO"
      | "SEM_GRUPO_ATIVO"
      | "TEM_FILHOS"
      | "VALIDACAO",
    message: string,
    readonly campo?: string,
  ) {
    super(message);
  }
}

export interface BibliotecaDeps {
  db: Database;
}

const exigir = (ctx: RequestContext) => {
  if (!can(ctx, "biblioteca.gerenciar")) {
    throw new ErroBiblioteca("SEM_PERMISSAO", "Sem permissão para gerenciar a biblioteca.");
  }
};

const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

const naoEncontrado = (o = "Tipo") => new ErroBiblioteca("NAO_ENCONTRADO", `${o} não encontrado.`);

const conflito = () =>
  new ErroBiblioteca(
    "ALTERADO_POR_OUTRO",
    "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  );

/** Restrições do banco → mensagem no campo (E-03.1, E-03.4, E-03.6). */
const RESTRICOES: Record<string, [ErroBiblioteca["codigo"], string, string]> = {
  equipment_type_acronym_live_uq: ["DUPLICADO", "sigla", "Esta sigla já está em uso."],
  equipment_type_name_live_uq: ["DUPLICADO", "nome", "Já existe um tipo com este nome."],
  equipment_group_name_live_uq: [
    "DUPLICADO",
    "nome",
    "Já existe um grupo com este nome neste tipo.",
  ],
  activity_template_title_live_uq: [
    "DUPLICADO",
    "titulo",
    "Já existe uma atividade com este título neste tipo.",
  ],
  equipment_type_acronym_locked: [
    "SIGLA_TRAVADA",
    "sigla",
    "A sigla compõe as TAGs e não pode mudar.",
  ],
};

/** Escrita com tradução das restrições (a transação já foi desfeita quando o erro chega aqui). */
async function escrever<T>(
  ctx: RequestContext,
  deps: BibliotecaDeps,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await deps.db.withTransaction(ctx, fn);
  } catch (e) {
    const r = RESTRICOES[restricaoViolada(e) ?? ""];
    if (r) throw new ErroBiblioteca(r[0], r[2], r[1]);
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Leitura (TL-104, TL-105)
// ---------------------------------------------------------------------------------------------

/** TL-104. */
export async function listarTipos(
  ctx: RequestContext,
  filtro: { mostrarInativos?: boolean },
  deps: BibliotecaDeps,
): Promise<repo.LinhaTipo[]> {
  exigir(ctx);
  return deps.db.withTransaction(ctx, (tx) =>
    repo.listarTipos(tx, Boolean(filtro.mostrarInativos)),
  );
}

export interface TipoCompleto {
  tipo: repo.Tipo;
  grupos: repo.Grupo[];
  /** Ordenadas por periodicidade e ordem (RN-051). */
  atividades: repo.Atividade[];
}

/** TL-105 aberto. `null` = não encontrado (inclui id malformado e tipo excluído). */
export async function obterTipo(
  ctx: RequestContext,
  id: string,
  deps: BibliotecaDeps,
): Promise<TipoCompleto | null> {
  exigir(ctx);
  if (!ehUuid(id)) return null;
  return deps.db.withTransaction(ctx, async (tx) => {
    const tipo = await repo.buscarTipo(tx, id);
    if (!tipo) return null;
    const [grupos, atividades] = [
      await repo.listarGrupos(tx, id),
      await repo.listarAtividades(tx, id),
    ];
    return { tipo, grupos, atividades: ordenarAtividades(atividades) };
  });
}

// ---------------------------------------------------------------------------------------------
// Tipo
// ---------------------------------------------------------------------------------------------

/** FL-03 passo 2: tipo e grupos numa transação (RN-040: ≥ 1 grupo). */
export async function criarTipo(
  ctx: RequestContext,
  input: CriarTipoInput,
  deps: BibliotecaDeps,
): Promise<{ id: string }> {
  exigir(ctx);
  const v = criarTipoSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    const id = await repo.inserirTipo(tx, {
      nome: v.nome,
      plural: v.plural ?? null,
      sigla: v.sigla,
    });
    for (const g of v.grupos) await repo.inserirGrupo(tx, id, g);
    return { id };
  });
}

/** TL-105 "Salvar" do tipo. Sigla travada com equipamento (E-03.4; trigger na 0010). */
export async function atualizarTipo(
  ctx: RequestContext,
  input: AtualizarTipoInput,
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = atualizarTipoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const atual = await repo.buscarTipo(tx, v.id);
    if (!atual) throw naoEncontrado();
    if (atual.siglaTravada && v.sigla !== atual.sigla) {
      throw new ErroBiblioteca(
        "SIGLA_TRAVADA",
        "A sigla compõe as TAGs e não pode mudar.",
        "sigla",
      );
    }
    const ok = await repo.atualizarTipo(
      tx,
      v.id,
      { nome: v.nome, plural: v.plural ?? null, sigla: v.sigla },
      v.rowVersion,
    );
    if (!ok) throw conflito();
  });
}

/** Inativar (RN-044) ou reativar o tipo. Reativar exige um grupo ativo (RN-040, E-03.2). */
export async function alterarSituacaoTipo(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; situacao: "ATIVO" | "INATIVO" },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    await repo.travarTipo(tx, v.id);
    if (!(await repo.buscarTipo(tx, v.id))) throw naoEncontrado();
    if (input.situacao === "ATIVO") {
      const grupos = await repo.listarGrupos(tx, v.id);
      if (!grupos.some((g) => g.situacao === "ATIVO")) {
        throw new ErroBiblioteca("SEM_GRUPO_ATIVO", "Inclua ao menos um grupo.");
      }
    }
    if (!(await repo.alterarSituacao(tx, "equipment_type", v.id, input.situacao, v.rowVersion))) {
      throw conflito();
    }
  });
}

/** Motivo de não poder excluir o tipo (TL-105 mostra no botão desabilitado, como E-04.7). */
export const SEM_EXCLUIR_TIPO_FILHOS = "Exclua antes os grupos e as atividades deste tipo.";

/**
 * Excluir tipo sem uso (EL-4; CA-08.2). Com uso: só inativar. Sem cascata (EL-7): grupos e atividades
 * vivos bloqueiam; para tirar o último grupo, o tipo precisa estar inativo (RN-040).
 */
export async function excluirTipo(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    await repo.travarTipo(tx, v.id);
    const t = await repo.buscarTipo(tx, v.id);
    if (!t) throw naoEncontrado();
    if (!podeExcluir(t)) {
      throw new ErroBiblioteca("EM_USO", "Este tipo já foi usado. Use Inativar.");
    }
    if (t.filhosVivos) throw new ErroBiblioteca("TEM_FILHOS", SEM_EXCLUIR_TIPO_FILHOS);
    if (!(await repo.excluirLogico(tx, "equipment_type", v.id, ctx.userId, v.rowVersion))) {
      throw conflito();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Grupo
// ---------------------------------------------------------------------------------------------

export async function incluirGrupo(
  ctx: RequestContext,
  input: { tipoId: string; nome: string },
  deps: BibliotecaDeps,
): Promise<{ id: string }> {
  exigir(ctx);
  const v = incluirGrupoSchema.parse(input);
  return escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarTipo(tx, v.tipoId))) throw naoEncontrado();
    return { id: await repo.inserirGrupo(tx, v.tipoId, v.nome) };
  });
}

export async function renomearGrupo(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; nome: string },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = renomearGrupoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarGrupo(tx, v.id))) throw naoEncontrado("Grupo");
    if (!(await repo.renomearGrupo(tx, v.id, v.nome, v.rowVersion))) throw conflito();
  });
}

/** Tira um grupo de uso (inativar ou excluir) sem deixar tipo ativo sem grupo ativo (E-03.2). */
async function grupoParaRetirar(tx: Tx, id: string) {
  const g = await repo.buscarGrupo(tx, id);
  if (!g) throw naoEncontrado("Grupo");
  await repo.travarTipo(tx, g.tipoId);
  const tipo = await repo.buscarTipo(tx, g.tipoId);
  if (!tipo) throw naoEncontrado();
  const grupos = await repo.listarGrupos(tx, g.tipoId);
  const ativos = grupos.map((x) => ({ id: x.id, ativo: x.situacao === "ATIVO" }));
  if (g.situacao === "ATIVO" && deixariaSemGrupoAtivo(tipo.situacao === "ATIVO", ativos, id)) {
    throw new ErroBiblioteca("SEM_GRUPO_ATIVO", "Inclua ao menos um grupo.");
  }
  return g;
}

export async function alterarSituacaoGrupo(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; situacao: "ATIVO" | "INATIVO" },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    if (input.situacao === "INATIVO") await grupoParaRetirar(tx, v.id);
    else if (!(await repo.buscarGrupo(tx, v.id))) throw naoEncontrado("Grupo");
    if (!(await repo.alterarSituacao(tx, "equipment_group", v.id, input.situacao, v.rowVersion))) {
      throw conflito();
    }
  });
}

/** Excluir grupo sem equipamento (FL-03 passo 4; EL-4). */
export async function excluirGrupo(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const g = await grupoParaRetirar(tx, v.id);
    if (!podeExcluir(g)) {
      throw new ErroBiblioteca("EM_USO", "Este grupo já tem equipamentos. Use Inativar.");
    }
    if (!(await repo.excluirLogico(tx, "equipment_group", v.id, ctx.userId, v.rowVersion))) {
      throw conflito();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Atividade padrão
// ---------------------------------------------------------------------------------------------

function dadosDaAtividade(v: {
  titulo: string;
  periodicidade: repo.DadosAtividade["periodicidade"];
  natureza: repo.DadosAtividade["natureza"];
  unidade?: string | null;
  exigeFoto: boolean;
  ordem: number;
}): repo.DadosAtividade {
  const u = unidadeDaAtividade(v.natureza, v.unidade); // RN-042; CA-08.1
  if (!u.ok) throw new ErroBiblioteca("VALIDACAO", u.problema.mensagem, u.problema.campo);
  return {
    titulo: v.titulo,
    periodicidade: v.periodicidade,
    natureza: v.natureza,
    unidade: u.unidade,
    exigeFoto: v.exigeFoto,
    ordem: v.ordem,
  };
}

export async function incluirAtividade(
  ctx: RequestContext,
  input: IncluirAtividadeInput,
  deps: BibliotecaDeps,
): Promise<{ id: string }> {
  exigir(ctx);
  const v = incluirAtividadeSchema.parse(input);
  const dados = dadosDaAtividade(v);
  return escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarTipo(tx, v.tipoId))) throw naoEncontrado();
    return { id: await repo.inserirAtividade(tx, v.tipoId, dados) };
  });
}

/**
 * TL-105 "Salvar" da atividade. `periodicidadeMudou` liga o aviso E-03.5: a biblioteca é padrão e
 * PMOCs já criados ficam com a cópia deles (RN-003; CA-08.3).
 */
export async function atualizarAtividade(
  ctx: RequestContext,
  input: AtualizarAtividadeInput,
  deps: BibliotecaDeps,
): Promise<{ periodicidadeMudou: boolean }> {
  exigir(ctx);
  const v = atualizarAtividadeSchema.parse(input);
  const dados = dadosDaAtividade(v);
  return escrever(ctx, deps, async (tx) => {
    const atual = await repo.buscarAtividade(tx, v.id);
    if (!atual) throw naoEncontrado("Atividade");
    if (!(await repo.atualizarAtividade(tx, v.id, dados, v.rowVersion))) throw conflito();
    return { periodicidadeMudou: atual.periodicidade !== dados.periodicidade };
  });
}

export async function alterarSituacaoAtividade(
  ctx: RequestContext,
  input: { id: string; rowVersion: number; situacao: "ATIVO" | "INATIVO" },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    if (!(await repo.buscarAtividade(tx, v.id))) throw naoEncontrado("Atividade");
    if (
      !(await repo.alterarSituacao(tx, "activity_template", v.id, input.situacao, v.rowVersion))
    ) {
      throw conflito();
    }
  });
}

/** Excluir atividade que nunca entrou em PMOC (EL-4; RN-044). */
export async function excluirAtividade(
  ctx: RequestContext,
  input: { id: string; rowVersion: number },
  deps: BibliotecaDeps,
): Promise<void> {
  exigir(ctx);
  const v = comVersaoSchema.parse(input);
  await escrever(ctx, deps, async (tx) => {
    const a = await repo.buscarAtividade(tx, v.id);
    if (!a) throw naoEncontrado("Atividade");
    if (!podeExcluir(a)) {
      throw new ErroBiblioteca("EM_USO", "Esta atividade já está em PMOC. Use Inativar.");
    }
    if (!(await repo.excluirLogico(tx, "activity_template", v.id, ctx.userId, v.rowVersion))) {
      throw conflito();
    }
  });
}
