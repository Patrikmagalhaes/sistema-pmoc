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

/** CNPJ cru (14, alfanumérico, DM-13) → 12.ABC.345/01DE-35; na digitação, até onde houver. */
export function mascararCnpj(v: string | null | undefined): string {
  const c = (v ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);
  const partes = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12)];
  let r = partes[0] ?? "";
  if (c.length > 2) r += `.${partes[1]}`;
  if (c.length > 5) r += `.${partes[2]}`;
  if (c.length > 8) r += `/${partes[3]}`;
  if (c.length > 12) r += `-${partes[4]}`;
  return r;
}

/** CEP cru (8 dígitos) → 01001-000; na digitação, até onde houver. */
export function mascararCep(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Rótulos (04 §1.5; (UI)). */
export const ROTULO_PERFIL = {
  ADM: "Administrador",
  TECNICO: "Técnico",
  CLIENTE: "Cliente",
} as const;
export const ROTULO_SITUACAO = { ATIVO: "Ativo", INATIVO: "Inativo" } as const;
export const ROTULO_PMOC: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EMITIDO: "Aguardando assinatura do cliente",
  ASSINADO_CLIENTE: "Assinado",
  HISTORICO: "Histórico",
};
export const ROTULO_CONTRATO: Record<string, string> = {
  A_INICIAR: "A iniciar",
  VIGENTE: "Vigente",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

/** Data de negócio `YYYY-MM-DD` (sem fuso) → dd/mm/aaaa. */
export const formatarDataIso = (d: string | null | undefined) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—";

/** TL-005 "navegador e sistema (do User-Agent)": leitura aproximada, só para exibição. */
export function descreverDispositivo(ua: string | null | undefined): string {
  if (!ua) return "Dispositivo desconhecido";
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const sistema = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "sistema desconhecido";
  return `${navegador} em ${sistema}`;
}
