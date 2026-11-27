/**
 * Isolamento das Server Actions e rotas de API (decisão B13; 05 §3.11; 06 SEG-20 a SEG-25; RN-162).
 *
 * 1. Inventário: toda action (`src/app/**\/actions.ts`) e toda rota (`src/app/api/**\/route.ts`) precisa
 *    estar no registro abaixo; action ou rota nova sem caso de isolamento quebra o CI (05 §3.11).
 * 2. Ações só do ADM: o layout da área `/adm` não protege Server Action (ela é um POST direto), então a
 *    barreira é o `can` do serviço (MOD-04). `TECNICO` e `CLIENTE` recebem `SEM_PERMISSAO` e nada é
 *    gravado. O `CLIENTE` A tenta com IDs do B.
 * 3. Leitura: `CLIENTE` A pedindo cadastro ou PMOC do B recebe `null` (a tela devolve 404, RN-162).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  atualizarUsuario,
  criarUsuario,
  inativarUsuario,
  reativarUsuario,
  redefinirSegundoFator,
  reenviarLinkSenha,
} from "../../src/modules/acesso";
import { prepararEnvio } from "../../src/modules/arquivos";
import {
  alterarSituacaoAtividade,
  alterarSituacaoGrupo,
  alterarSituacaoTipo,
  atualizarAtividade,
  atualizarTipo,
  criarTipo,
  excluirAtividade,
  excluirGrupo,
  excluirTipo,
  incluirAtividade,
  incluirGrupo,
  renomearGrupo,
} from "../../src/modules/biblioteca";
import {
  atualizarCliente,
  atualizarContrato,
  atualizarLocal,
  cancelarContrato,
  confirmarRenovacao,
  criarCliente,
  criarContrato,
  criarLocal,
  excluirCliente,
  excluirContrato,
  excluirLocal,
  listarClientes,
  listarContratosDoLocal,
  obterCliente,
  obterContrato,
  obterLocal,
} from "../../src/modules/clientes";
import { enviarCertificado, salvarEmpresa, salvarRt } from "../../src/modules/empresa";
import {
  alterarSituacaoEquipamento,
  atualizarEquipamento,
  criarEquipamento,
  excluirEquipamento,
  listarEquipamentosDoLocal,
  obterEquipamento,
} from "../../src/modules/equipamentos";
import {
  alterarPeriodicidade,
  criarPmoc,
  emitirPmoc,
  incluirAtividadeDaBiblioteca,
  incluirAtividadeNova,
  obterPmoc,
  previaDaMudancaNoPlano,
  removerAtividadeDoPlano,
  restaurarAtividadeDoPlano,
  verificarEmissao,
} from "../../src/modules/pmoc";
import type { RequestContext } from "../../src/server/context";
import { appDatabase, clientCtx, ensureSeed, SEED, technicianCtx } from "../integration/helpers";

const db = appDatabase();
let owner: postgres.Sql;

beforeAll(async () => {
  await ensureSeed(db);
  owner = postgres(inject("dbOwnerUrl"), { max: 1, onnotice: () => {} });
});
afterAll(async () => {
  await owner.end();
  await db.close();
});

// Deps mínimas: a recusa acontece antes de qualquer uso de Storage, Better Auth ou cifra. Se um serviço
// deixar de checar a permissão primeiro, ele quebra aqui com outro erro, e o teste falha.
const d = { db } as never;
const nada = {} as never;
const S = SEED;
const v = { rowVersion: 1, motivo: null };

type Chamada = (ctx: RequestContext) => Promise<unknown>;

type Caso =
  /** Só o ADM: `TECNICO` e `CLIENTE` recebem `SEM_PERMISSAO` e nada é gravado. */
  | { tipo: "SO_ADM"; chamadas: Chamada[] }
  /** Acessível a todo perfil logado, sobre o próprio usuário: coberto pelo teste citado. */
  | { tipo: "PROPRIO_USUARIO"; arquivo: string; teste: string }
  /** Sem sessão: a autorização é outra (token, código público) e o teste citado a cobre. */
  | { tipo: "SEM_SESSAO"; arquivo: string; teste: string };

/** Chave: caminho em `src/app` sem os grupos de rota `(x)`, mais o nome exportado. */
const ACTIONS: Record<string, Caso> = {
  // Clientes, locais e contratos (TL-108 a TL-112)
  "adm/clientes#criarClienteAction": soAdm((c) => criarCliente(c, nada, d)),
  "adm/clientes#atualizarClienteAction": soAdm((c) =>
    atualizarCliente(c, { id: S.clientBId, ...v } as never, d),
  ),
  "adm/clientes#excluirClienteAction": soAdm((c) =>
    excluirCliente(c, { id: S.clientBId, ...v }, d),
  ),
  "adm/clientes#criarLocalAction": soAdm((c) =>
    criarLocal(c, { clientId: S.clientBId } as never, d),
  ),
  "adm/clientes#atualizarLocalAction": soAdm((c) =>
    atualizarLocal(c, { id: S.siteBId, ...v } as never, d),
  ),
  "adm/clientes#excluirLocalAction": soAdm((c) => excluirLocal(c, { id: S.siteBId, ...v }, d)),
  "adm/clientes#criarContratoAction": soAdm((c) =>
    criarContrato(c, { localId: S.siteBId } as never, d),
  ),
  "adm/clientes#atualizarContratoAction": soAdm((c) =>
    atualizarContrato(c, { id: S.contractBId, ...v } as never, d),
  ),
  "adm/clientes#cancelarContratoAction": soAdm((c) =>
    cancelarContrato(c, { id: S.contractBId, ...v } as never, d),
  ),
  "adm/clientes#confirmarRenovacaoAction": soAdm((c) =>
    confirmarRenovacao(c, { id: S.contractBId, rowVersion: 1 }, d),
  ),
  "adm/clientes#excluirContratoAction": soAdm((c) =>
    excluirContrato(c, { id: S.contractBId, ...v }, d),
  ),
  // Empresa, RT e certificado (TL-102, TL-103)
  "adm/empresa#salvarEmpresaAction": soAdm((c) => salvarEmpresa(c, nada, d)),
  "adm/empresa#salvarRtAction": soAdm((c) => salvarRt(c, nada, d)),
  "adm/empresa#enviarCertificadoAction": soAdm((c) => enviarCertificado(c, nada, d)),
  // Equipamentos (TL-111)
  "adm/equipamentos#criarEquipamentoAction": soAdm((c) =>
    criarEquipamento(c, { localId: S.siteBId } as never, d),
  ),
  "adm/equipamentos#atualizarEquipamentoAction": soAdm((c) =>
    atualizarEquipamento(c, { id: S.equipmentBId, ...v } as never, d),
  ),
  "adm/equipamentos#alterarSituacaoEquipamentoAction": soAdm((c) =>
    alterarSituacaoEquipamento(c, { id: S.equipmentBId, ...v } as never, d),
  ),
  "adm/equipamentos#excluirEquipamentoAction": soAdm((c) =>
    excluirEquipamento(c, { id: S.equipmentBId, ...v } as never, d),
  ),
  // PMOC (TL-120, TL-121; FL-09)
  "adm/pmocs#previaDaMudancaAction": soAdm((c) =>
    previaDaMudancaNoPlano(c, { acao: "PERIODICIDADE", id: S.pmocBId, periodicidade: "MM" }, d),
  ),
  "adm/pmocs#criarPmocAction": soAdm((c) =>
    criarPmoc(c, { contratoId: S.contractBId } as never, d),
  ),
  "adm/pmocs#verificarEmissaoAction": soAdm((c) => verificarEmissao(c, S.pmocBId, d)),
  "adm/pmocs#emitirPmocAction": soAdm((c) =>
    emitirPmoc(c, { pmocId: S.pmocBId, rowVersion: 1 }, d),
  ),
  "adm/pmocs#alterarPeriodicidadeAction": soAdm((c) =>
    alterarPeriodicidade(c, { id: S.pmocBId, ...v } as never, d),
  ),
  "adm/pmocs#removerAtividadeAction": soAdm((c) =>
    removerAtividadeDoPlano(c, { id: S.pmocBId, ...v } as never, d),
  ),
  "adm/pmocs#restaurarAtividadeAction": soAdm((c) =>
    restaurarAtividadeDoPlano(c, { id: S.pmocBId, ...v } as never, d),
  ),
  "adm/pmocs#incluirDaBibliotecaAction": soAdm((c) =>
    incluirAtividadeDaBiblioteca(c, { pmocId: S.pmocBId } as never, d),
  ),
  "adm/pmocs#incluirNovaAction": soAdm((c) =>
    incluirAtividadeNova(c, { pmocId: S.pmocBId } as never, d),
  ),
  // Biblioteca (TL-104, TL-105)
  "adm/tipos#criarTipoAction": soAdm((c) => criarTipo(c, nada, d)),
  "adm/tipos#atualizarTipoAction": soAdm((c) =>
    atualizarTipo(c, { id: S.equipmentTypeId, ...v } as never, d),
  ),
  "adm/tipos#alterarSituacaoAction": soAdm(
    (c) => alterarSituacaoTipo(c, { id: S.equipmentTypeId, ...v } as never, d),
    (c) => alterarSituacaoGrupo(c, { id: S.equipmentGroupId, ...v } as never, d),
    (c) => alterarSituacaoAtividade(c, { id: S.equipmentTypeId, ...v } as never, d),
  ),
  "adm/tipos#excluirAction": soAdm(
    (c) => excluirTipo(c, { id: S.equipmentTypeId, ...v } as never, d),
    (c) => excluirGrupo(c, { id: S.equipmentGroupId, ...v } as never, d),
    (c) => excluirAtividade(c, { id: S.equipmentTypeId, ...v } as never, d),
  ),
  "adm/tipos#incluirGrupoAction": soAdm((c) =>
    incluirGrupo(c, { tipoId: S.equipmentTypeId, nome: "X" } as never, d),
  ),
  "adm/tipos#renomearGrupoAction": soAdm((c) =>
    renomearGrupo(c, { id: S.equipmentGroupId, ...v } as never, d),
  ),
  "adm/tipos#incluirAtividadeAction": soAdm((c) =>
    incluirAtividade(c, { tipoId: S.equipmentTypeId } as never, d),
  ),
  "adm/tipos#atualizarAtividadeAction": soAdm((c) =>
    atualizarAtividade(c, { id: S.equipmentTypeId, ...v } as never, d),
  ),
  // Usuários (TL-106, TL-107)
  "adm/usuarios#criarUsuarioAction": soAdm((c) => criarUsuario(c, nada, nada, d)),
  "adm/usuarios#atualizarUsuarioAction": soAdm((c) =>
    atualizarUsuario(c, { id: S.clientBUserId, ...v } as never, d),
  ),
  "adm/usuarios#inativarUsuarioAction": soAdm((c) =>
    inativarUsuario(c, { id: S.clientBUserId, ...v } as never, nada, d),
  ),
  "adm/usuarios#reativarUsuarioAction": soAdm((c) =>
    reativarUsuario(c, { id: S.clientBUserId, ...v } as never, nada, d),
  ),
  "adm/usuarios#redefinirSegundoFatorAction": soAdm((c) =>
    redefinirSegundoFator(c, { id: S.admUserId } as never, nada, d),
  ),
  "adm/usuarios#reenviarLinkAction": soAdm((c) => reenviarLinkSenha(c, S.clientBUserId, d)),
  // Minha conta (TL-005): todo perfil, só sobre o próprio usuário
  "conta#salvarMeusDadosAction": {
    tipo: "PROPRIO_USUARIO",
    arquivo: "tests/integration/acesso.test.ts",
    teste: "cada um corrige só os próprios dados, com row_version",
  },
  "conta#encerrarSessaoAction": {
    tipo: "PROPRIO_USUARIO",
    arquivo: "tests/integration/acesso.test.ts",
    teste: "não alcança a sessão de outro usuário (RN-162)",
  },
  "conta#encerrarOutrasSessoesAction": {
    tipo: "PROPRIO_USUARIO",
    arquivo: "tests/integration/acesso.test.ts",
    teste: "lista as próprias sessões, encerra uma e depois todas as outras (SEG-13)",
  },
  // Definir senha (TL-003): sem sessão; o token do link é a autorização
  "senha/definir#definirSenhaAction": {
    tipo: "SEM_SESSAO",
    arquivo: "tests/integration/acesso.test.ts",
    teste:
      "TL-003 sem sessão: link inventado ou já usado devolve LINK_INVALIDO e não troca a senha",
  },
};

/** Rotas de API: chave é o caminho sob `src/app/api`. */
const ROTAS: Record<string, Caso> = {
  // Prepara a URL de envio (logo da empresa, SEG-50): só o ADM
  arquivos: soAdm((c) =>
    prepararEnvio(
      c,
      {
        finalidade: "LOGO_EMPRESA",
        nome: null,
        mime: "image/png",
        tamanho: 10,
        sha256: "0".repeat(64),
      },
      d,
    ),
  ),
  // Download: ADM e o cliente dono; os outros recebem 404 (RN-162, RN-163, RN-166)
  "arquivos/[id]": {
    tipo: "SEM_SESSAO",
    arquivo: "tests/isolation/arquivos.test.ts",
    teste: "CLIENTE A baixa o do A e recebe 404 no do B (e vice-versa)",
  },
  // PUT do armazenamento local (SEG-50): o token assinado é a autorização; em produção não existe
  "arquivos/envio": {
    tipo: "SEM_SESSAO",
    arquivo: "tests/integration/empresa.test.ts",
    teste: "a URL de envio é de uso único, com prazo, tipo e tamanho (armazenamento local)",
  },
  // Better Auth (AF-04): login, senha e segundo fator, cobertos pelo S-04 e pelos testes de acesso
  "auth/[...all]": {
    tipo: "SEM_SESSAO",
    arquivo: "tests/integration/acesso.test.ts",
    teste: "inativar bane e derruba a sessão ativa; o login passa a ser recusado",
  },
};

function soAdm(...chamadas: Chamada[]): Caso {
  return { tipo: "SO_ADM", chamadas };
}

// ---------------------------------------------------------------------------------------------
// 1. Inventário
// ---------------------------------------------------------------------------------------------

const APP = join(process.cwd(), "src", "app");

function arquivos(dir: string, nome: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return arquivos(p, nome);
    return f === nome ? [p] : [];
  });
}

/** `src/app/(adm)/adm/pmocs/actions.ts` → `adm/pmocs`. */
const semGrupos = (p: string) =>
  relative(APP, p)
    .split(sep)
    .slice(0, -1)
    .filter((s) => !/^\(.*\)$/.test(s))
    .join("/");

function actionsNoCodigo(): string[] {
  return arquivos(APP, "actions.ts").flatMap((p) =>
    [...readFileSync(p, "utf8").matchAll(/^export const (\w+)\s*=/gm)].map(
      (m) => `${semGrupos(p)}#${m[1]}`,
    ),
  );
}

function rotasNoCodigo(): string[] {
  const api = join(APP, "api");
  return arquivos(api, "route.ts").map((p) => relative(api, p).split(sep).slice(0, -1).join("/"));
}

describe("inventário (05 §3.11: rota ou action nova sem teste quebra o CI)", () => {
  it("toda Server Action tem caso de isolamento, e o registro não tem action que sumiu", () => {
    expect(actionsNoCodigo().sort()).toEqual(Object.keys(ACTIONS).sort());
  });

  it("toda rota de API tem caso de isolamento, e o registro não tem rota que sumiu", () => {
    expect(rotasNoCodigo().sort()).toEqual(Object.keys(ROTAS).sort());
  });

  it("o teste citado em cada caso existe", () => {
    for (const c of [...Object.values(ACTIONS), ...Object.values(ROTAS)]) {
      if (c.tipo === "SO_ADM") continue;
      expect(readFileSync(join(process.cwd(), c.arquivo), "utf8"), c.teste).toContain(c.teste);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Ações só do ADM
// ---------------------------------------------------------------------------------------------

const soDoAdm = Object.entries({ ...ACTIONS, ...ROTAS }).flatMap(([nome, c]) =>
  c.tipo === "SO_ADM" ? c.chamadas.map((chamar, i) => ({ nome: `${nome} [${i}]`, chamar })) : [],
);

const linhasDeAuditoria = async () =>
  (await owner`SELECT count(*)::int AS n FROM audit_log`)[0]?.n as number;

describe.each([
  ["TECNICO", technicianCtx],
  ["CLIENTE A (com IDs do B)", () => clientCtx("A")],
])("%s não executa ação do ADM (MOD-04; SEG-20)", (_perfil, ctx) => {
  it.each(soDoAdm)("$nome", async ({ chamar }) => {
    const antes = await linhasDeAuditoria();
    const erro = await chamar(ctx()).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro, "a ação deveria ter sido recusada").not.toBeNull();
    expect((erro as { codigo?: string }).codigo).toBe("SEM_PERMISSAO");
    expect(await linhasDeAuditoria()).toBe(antes);
  });
});

// ---------------------------------------------------------------------------------------------
// 3. Leitura de outro cliente
// ---------------------------------------------------------------------------------------------

describe("CLIENTE A pedindo dado do B recebe null, que a tela devolve como 404 (RN-162)", () => {
  const a = () => clientCtx("A");
  it.each([
    ["cliente", () => obterCliente(a(), S.clientBId, d)],
    ["local", () => obterLocal(a(), S.siteBId, d)],
    ["contratos do local", () => listarContratosDoLocal(a(), S.siteBId, d)],
    ["contrato", () => obterContrato(a(), S.contractBId, d)],
    ["equipamentos do local", () => listarEquipamentosDoLocal(a(), S.siteBId, {}, d)],
    ["equipamento", () => obterEquipamento(a(), S.equipmentBId, d)],
    ["PMOC", () => obterPmoc(a(), S.pmocBId, d)],
  ])("%s", async (_o, ler) => {
    expect(await ler()).toBeNull();
  });

  it("a lista de clientes é só do ADM", async () => {
    const erro = await listarClientes(a(), {}, d).then(
      () => null,
      (e: unknown) => e,
    );
    expect((erro as { codigo?: string } | null)?.codigo).toBe("SEM_PERMISSAO");
  });
});
