import type { RequestContext } from "@/server/context";

/**
 * Ações da matriz de permissões (docs/00 §3.2) e das regras RN-160 a RN-168.
 * Ação fora desta lista não existe: `can` nega por padrão (SEG-20).
 */
export const ACTIONS = [
  "usuario.gerenciar",
  "empresa.gerenciar", // empresa executora, RT e certificado e-CPF
  "cadastro.escrever", // clientes, locais, contratos
  "cadastro.ler",
  "biblioteca.gerenciar", // tipos de equipamento e atividades
  "equipamento.escrever",
  "equipamento.ler",
  "pmoc.periodicidade.alterar",
  "pmoc.emitir",
  "pmoc.ler", // ver e baixar
  "pmoc.assinar",
  "visita.gerenciar", // agendar, remarcar, trocar técnico, cancelar
  "visita.ler",
  "execucao.registrar",
  "relatorio.escrever", // gerar, editar e enviar
  "relatorio.ler",
  "relatorio.assinar",
  "pendencia.resolver",
  "auditoria.ler",
  "notificacao.receber",
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Dados do recurso que a regra precisa. O dono é lido do banco pelo serviço e nunca vem do navegador (SEG-22).
 * Campo ausente quando a regra o exige = negado (falha fechada).
 */
export interface Resource {
  /** Cliente dono do recurso. */
  clientId?: string | null;
  /** Técnico a quem a visita está atribuída. */
  assignedTechnicianUserId?: string | null;
  /** Usuário que finalizou a visita (RN-165, RN-167). */
  finalizedByUserId?: string | null;
  /** Estado da visita (RN-164). */
  visitStatus?: string | null;
}

type Rule = boolean | ((ctx: RequestContext, r: Resource) => boolean);

const ownClient = (ctx: RequestContext, r: Resource) =>
  ctx.clientId != null && r.clientId != null && r.clientId === ctx.clientId;

/** "próprias" do técnico: atribuídas a ele ou finalizadas por ele (RN-165). */
const ownVisit = (ctx: RequestContext, r: Resource) =>
  ctx.userId != null &&
  (r.assignedTechnicianUserId === ctx.userId || r.finalizedByUserId === ctx.userId);

type Matrix = Partial<Record<Action, Partial<Record<RequestContext["role"], Rule>>>>;

/** `SISTEMA` não aparece: jobs não têm permissões até a etapa que os define (doc 07, Etapa 5). */
const MATRIX: Matrix = {
  "usuario.gerenciar": { ADM: true },
  "empresa.gerenciar": { ADM: true },
  "cadastro.escrever": { ADM: true },
  "cadastro.ler": { ADM: true, CLIENTE: ownClient },
  "biblioteca.gerenciar": { ADM: true },
  "equipamento.escrever": { ADM: true },
  "equipamento.ler": { ADM: true, TECNICO: ownVisit, CLIENTE: ownClient },
  "pmoc.periodicidade.alterar": { ADM: true },
  "pmoc.emitir": { ADM: true },
  "pmoc.ler": { ADM: true, CLIENTE: ownClient }, // técnico não vê o PMOC (decisão B1, RN-166)
  "pmoc.assinar": { CLIENTE: ownClient }, // ADM nunca assina (RN-133)
  "visita.gerenciar": { ADM: true },
  "visita.ler": { ADM: true, TECNICO: ownVisit, CLIENTE: ownClient },
  // RN-164: o técnico só grava em visita sua que esteja EM_ANDAMENTO.
  "execucao.registrar": {
    ADM: true,
    TECNICO: (ctx, r) =>
      ctx.userId != null &&
      r.assignedTechnicianUserId === ctx.userId &&
      r.visitStatus === "EM_ANDAMENTO",
  },
  // RN-167: o técnico gera, edita e envia o relatório só das visitas que ele finalizou.
  "relatorio.escrever": {
    ADM: true,
    TECNICO: (ctx, r) => ctx.userId != null && r.finalizedByUserId === ctx.userId,
  },
  "relatorio.ler": { ADM: true, TECNICO: ownVisit, CLIENTE: ownClient },
  "relatorio.assinar": { CLIENTE: ownClient },
  "pendencia.resolver": { ADM: true },
  "auditoria.ler": { ADM: true },
  "notificacao.receber": { ADM: true, TECNICO: true, CLIENTE: true },
};

/**
 * Helper `can(ctx, acao, recurso)` (MOD-04; 06 SEG-20): nega por padrão.
 * Ação sem entrada na matriz, perfil sem regra ou recurso sem os dados exigidos = `false`.
 */
export function can(ctx: RequestContext, action: Action, resource: Resource = {}): boolean {
  const rule = MATRIX[action]?.[ctx.role];
  if (rule === undefined) return false;
  if (typeof rule === "boolean") return rule;
  return rule(ctx, resource);
}
