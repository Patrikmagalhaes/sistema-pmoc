/** Formatos de exibição (04 UF-03, UF-05; RNF-07). O valor gravado é sempre o cru. */

const fuso = "America/Sao_Paulo";
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: fuso });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: fuso,
});

export const formatarData = (d: Date | null | undefined) => (d ? data.format(d) : "—");
export const formatarDataHora = (d: Date | null | undefined) => (d ? dataHora.format(d) : "—");

/** Telefone só com dígitos → (11) 99999-0000 / (11) 3333-0000. */
export function formatarTelefone(v: string | null | undefined): string {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

/** Máscara na digitação (UF-03): aplica o formato conforme os dígitos já digitados. */
export function mascararTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Rótulos (04 §1.5; (UI)). */
export const ROTULO_PERFIL = {
  ADM: "Administrador",
  TECNICO: "Técnico",
  CLIENTE: "Cliente",
} as const;
export const ROTULO_SITUACAO = { ATIVO: "Ativo", INATIVO: "Inativo" } as const;
