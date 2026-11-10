/**
 * Normaliza a resposta de uma server action (next-safe-action + `Resultado`) para as telas:
 * sessão expirada vai ao login com retorno (SESSAO_EXPIRADA); `ALTERADO_POR_OUTRO` vira conflito
 * (UF-07); erro de regra traz a mensagem e os campos (UF-02).
 */
type Falha = { ok: false; codigo: string; mensagem: string; campos?: Record<string, string> };

export type Desfecho<D> =
  | { tipo: "ok"; dados: Extract<D, { ok: true }> }
  | { tipo: "conflito" }
  | { tipo: "erro"; mensagem: string; campos?: Record<string, string> };

export async function chamarAcao<D extends { ok: true } | Falha>(
  p: Promise<{ data?: D; serverError?: string } | undefined>,
): Promise<Desfecho<D>> {
  let r: { data?: D; serverError?: string } | undefined;
  try {
    r = await p;
  } catch {
    return { tipo: "erro", mensagem: "Sem conexão. Tente novamente." };
  }
  if (r?.serverError === "SESSAO_EXPIRADA") {
    window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
    return { tipo: "erro", mensagem: "Sua sessão expirou." };
  }
  const d = r?.data;
  if (!d) return { tipo: "erro", mensagem: r?.serverError ?? "Não foi possível concluir." };
  if (d.ok === false) {
    const f = d as Falha;
    if (f.codigo === "ALTERADO_POR_OUTRO") return { tipo: "conflito" };
    return { tipo: "erro", mensagem: f.mensagem, campos: f.campos };
  }
  return { tipo: "ok", dados: d as Extract<D, { ok: true }> };
}
