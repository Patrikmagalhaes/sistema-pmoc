import { z } from "zod";

/** 03 §4: user_role + SISTEMA (jobs; 05 §4.2 item 6). */
export type ActorRole = "ADM" | "TECNICO" | "CLIENTE" | "SISTEMA";
/** 03 §4: audit_source. */
export type AuditSource = "WEB_ADM" | "PORTAL_CLIENTE" | "PWA_TECNICO" | "SISTEMA";

/** MOD-04: contexto da requisição, passado a toda função de serviço. */
export interface RequestContext {
  /** `null` apenas para `SISTEMA`. */
  readonly userId: string | null;
  readonly role: ActorRole;
  /** Preenchido só para `CLIENTE` (RN-169). */
  readonly clientId: string | null;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly source: AuditSource;
  /** Motivo informado pelo usuário (remarcação, correção); vai para `audit_log.reason`. */
  readonly reason: string | null;
}

const input = z.object({
  userId: z.uuid(),
  role: z.enum(["ADM", "TECNICO", "CLIENTE"]),
  clientId: z.uuid().nullish(),
  requestId: z.uuid(),
  ipAddress: z.union([z.ipv4(), z.ipv6()]).nullish(),
  source: z.enum(["WEB_ADM", "PORTAL_CLIENTE", "PWA_TECNICO"]),
  reason: z.string().nullish(),
});

export type ContextInput = z.input<typeof input>;

/** Canal coerente com o perfil (03 §4 audit_source). */
const sourcesByRole = {
  ADM: ["WEB_ADM"],
  TECNICO: ["PWA_TECNICO", "WEB_ADM"],
  CLIENTE: ["PORTAL_CLIENTE"],
} as const;

/**
 * Monta o contexto de um usuário autenticado. O `clientId` vem do `app_user` no banco, nunca do navegador
 * (SEG-22). Rejeita combinações incoerentes (CLIENTE sem cliente, ADM com cliente...).
 */
export function buildContext(raw: ContextInput): RequestContext {
  const v = input.parse(raw);
  if ((v.role === "CLIENTE") !== (v.clientId != null)) {
    throw new Error(
      "clientId é obrigatório para CLIENTE e proibido para os demais perfis (RN-169)",
    );
  }
  if (!(sourcesByRole[v.role] as readonly string[]).includes(v.source)) {
    throw new Error(`canal ${v.source} incompatível com o perfil ${v.role}`);
  }
  return {
    userId: v.userId,
    role: v.role,
    clientId: v.clientId ?? null,
    requestId: v.requestId,
    ipAddress: v.ipAddress ?? null,
    source: v.source,
    reason: v.reason?.trim() ? v.reason.trim() : null,
  };
}

/** Contexto de job/gancho de autenticação: ator vazio, `source = 'SISTEMA'` (03 §2.1 regra 6). */
export function systemContext(requestId: string, reason: string | null = null): RequestContext {
  return {
    userId: null,
    role: "SISTEMA",
    clientId: null,
    requestId: z.uuid().parse(requestId),
    ipAddress: null,
    source: "SISTEMA",
    reason,
  };
}
