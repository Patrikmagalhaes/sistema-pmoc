/**
 * TL-007 – Verificar documento (RN-187; 06 INT-14; decisões B7 a, R2 2.8 b; AF-09). Regras puras do
 * resultado público: só tipo, versão, datas, hash e situação; nunca nome de pessoa nem dado do cliente.
 */

/** INT-14 / AF-09: 30 consultas por hora por IP (`rate_limit_counter`, chave `verificar:{sha256 do IP}`). */
export const LIMITE_VERIFICACAO_POR_IP = { janelaMs: 60 * 60 * 1000, max: 30 } as const;

/** Prefixo da chave em `rate_limit_counter` (03 §2.11). */
export const CHAVE_LIMITE_VERIFICACAO = "verificar";

export type SituacaoVerificada = "VIGENTE" | "SUBSTITUIDO" | "ASSINADO" | "ASSINADO_SUBSTITUIDO";

/**
 * Situação da versão encontrada (INT-14: "vigente, substituído, assinado"). Versão assinada que depois
 * ganhou versão mais nova continua assinada e também é substituída (VP-2: só a não assinada vira
 * `SUBSTITUIDA`).
 */
export function situacaoVerificada(
  status: "AGUARDANDO_ASSINATURA" | "ASSINADO_CLIENTE" | "SUBSTITUIDA",
  atual: boolean,
): SituacaoVerificada {
  if (status === "ASSINADO_CLIENTE") return atual ? "ASSINADO" : "ASSINADO_SUBSTITUIDO";
  if (status === "SUBSTITUIDA" || !atual) return "SUBSTITUIDO";
  return "VIGENTE";
}

/** Rótulos (UI) da TL-007. */
export const ROTULO_SITUACAO_VERIFICADA: Record<SituacaoVerificada, string> = {
  VIGENTE: "Vigente",
  SUBSTITUIDO: "Substituído por versão mais nova",
  ASSINADO: "Assinado pelo cliente",
  ASSINADO_SUBSTITUIDO: "Assinado pelo cliente e substituído por versão mais nova",
};
