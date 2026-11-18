/**
 * Regras de apresentação do PDF do PMOC (RNF-07, RN-132), puras: o gerador do PDF (`src/server/pdf`)
 * só desenha o que sai daqui. Máscaras de `src/lib/formato.ts` (UF-03): o valor gravado é sempre o cru.
 */
import { formatarDataIso, formatarTelefone, mascararCep, mascararCnpj } from "@/lib/formato";
import type { MesDoContrato } from "@/modules/cronograma";
import type { Endereco, TipoDoSnapshot } from "./snapshot";

// ---------------------------------------------------------------------------------------------
// Campos opcionais (CA-12.2)
// ---------------------------------------------------------------------------------------------

/**
 * CA-12.2 e RNF-07 `[A VALIDAR: omitir ou deixar em branco]`: o que fazer com campo opcional vazio.
 * Padrão adotado: **omitir** o rótulo. Trocar para `"EM_BRANCO"` aqui muda todos os PDFs.
 */
export const CAMPO_VAZIO_NO_PDF: "OMITIR" | "EM_BRANCO" = "OMITIR";

export interface Campo {
  rotulo: string;
  valor: string;
}

const vazio = (v: string | null | undefined) => v == null || v.trim() === "";

/** Lista de rótulo e valor para o PDF, já sem `null`/`undefined` (CA-12.2). */
export function campos(lista: readonly (readonly [string, string | null | undefined])[]): Campo[] {
  const r: Campo[] = [];
  for (const [rotulo, valor] of lista) {
    if (!vazio(valor)) r.push({ rotulo, valor: (valor as string).trim() });
    else if (CAMPO_VAZIO_NO_PDF === "EM_BRANCO") r.push({ rotulo, valor: "" });
  }
  return r;
}

/** Telefone cru → máscara RNF-07; vazio continua vazio (a regra do vazio é de `campos`). */
export const telefone = (v: string | null | undefined) => (vazio(v) ? null : formatarTelefone(v));

/** Dois telefones do cliente, sem repetir (análise B7). */
export function telefones(a: string | null, b: string | null): string | null {
  const t = [a, b].filter((x): x is string => !vazio(x));
  const unicos = [...new Set(t)].map((x) => formatarTelefone(x));
  return unicos.length ? unicos.join(" / ") : null;
}

export const cnpj = (v: string) => mascararCnpj(v);
export const cep = (v: string) => mascararCep(v);
export const data = (iso: string) => formatarDataIso(iso);

// ---------------------------------------------------------------------------------------------
// Endereço (bloco [E])
// ---------------------------------------------------------------------------------------------

/** Número impresso: o número, ou "s/n" (CA-05.4). */
export const numero = (e: Endereco) => (e.semNumero ? "s/n" : (e.numero ?? ""));

/** Uma linha, para o cabeçalho: "Rua X, 100, KM 159, Bairro, Cidade/UF". */
export function enderecoEmLinha(e: Endereco): string {
  return [e.logradouro, numero(e), e.complemento, e.bairro, `${e.cidade}/${e.uf}`]
    .filter((x) => !vazio(x))
    .join(", ");
}

/** Campos do endereço nas seções 1 a 4 (análise §2.1; bairro só onde for informado). */
export function camposDeEndereco(e: Endereco): Campo[] {
  return campos([
    ["Endereço", e.logradouro],
    ["Nº", numero(e)],
    ["Complemento", e.complemento],
    ["Bairro", e.bairro],
    ["Cidade", e.cidade],
    ["UF", e.uf],
    ["CEP", cep(e.cep)],
  ]);
}

// ---------------------------------------------------------------------------------------------
// Identificação, capa e vigência (RN-010, RN-011)
// ---------------------------------------------------------------------------------------------

/**
 * RN-010 (CA-12.4): TH e revisão → `{TH}-{revisão}`; só TH → TH; sem TH → nada (revisão sem TH não é
 * impressa, [A VALIDAR]).
 */
export function identificacaoContrato(th: string | null, revisao: string | null): string | null {
  if (vazio(th)) return null;
  const t = (th as string).trim();
  return vazio(revisao) ? t : `${t}-${(revisao as string).trim()}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

/** `YYYY-MM-DD` → "1 de abril de 2025" (RN-011). */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** RN-011: "{cidade da empresa}, {início da vigência por extenso}". */
export const localEData = (cidadeEmpresa: string, inicio: string) =>
  `${cidadeEmpresa}, ${dataPorExtenso(inicio)}`;

/** Capa (análise §1.3), com datas `dd/mm/aaaa` (RNF-07). */
export const vigencia = (inicio: string, fim: string) =>
  `Vigência de ${data(inicio)} até ${data(fim)}`;

/** Coluna de mês da ficha: "Abr/25" (análise §1.5). */
export function mesCurto(m: MesDoContrato): string {
  const [a, mes] = m.referencia.split("-").map(Number) as [number, number];
  return `${MESES_CURTOS[mes - 1]}/${String(a).slice(2)}`;
}

// ---------------------------------------------------------------------------------------------
// Seção 5 – listagem de equipamentos (RN-050)
// ---------------------------------------------------------------------------------------------

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/**
 * Quantidade por extenso, no masculino (RN-050: "1 (um) Split", "2 (dois) Splits"), de 1 a 999 (o
 * sequencial da TAG vai até 999, 03 `equipment.tag_sequence`). Gênero do nome do tipo [A VALIDAR].
 */
export function porExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c] as string);
  if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10] as string);
  else {
    if (d) partes.push(DEZENAS[d] as string);
    if (u) partes.push(UNIDADES[u] as string);
  }
  return partes.join(" e ");
}

export interface LinhaDaListagem {
  /** "4 (quatro) Splits, tipo Hi-Wall". */
  texto: string;
  tags: string[];
}

/** "tipo {grupo}", sem repetir o rótulo quando o grupo já começa com "Tipo" (análise B12). */
const comRotuloTipo = (grupo: string) => (/^tipo\b/i.test(grupo.trim()) ? grupo : `tipo ${grupo}`);

/**
 * RN-050: equipamentos `ATIVO` agrupados por tipo + grupo, com a quantidade em número e por extenso,
 * o plural do tipo (03 `equipment_type.plural_name`, senão o nome) e as TAGs. Ordem: tipos como no
 * retrato (por nome), grupos por nome.
 */
export function listagemDeEquipamentos(tipos: readonly TipoDoSnapshot[]): LinhaDaListagem[] {
  const r: LinhaDaListagem[] = [];
  for (const t of tipos) {
    const grupos = [...new Set(t.equipamentos.map((e) => e.grupo))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    for (const g of grupos) {
      const tags = t.equipamentos.filter((e) => e.grupo === g).map((e) => e.tag);
      const n = tags.length;
      const nome = n === 1 ? t.nome : (t.nomePlural ?? t.nome);
      r.push({ texto: `${n} (${porExtenso(n)}) ${nome}, ${comRotuloTipo(g)}`, tags });
    }
  }
  return r;
}

/**
 * RN-052: número + unidade, em pt-BR ("18.000 BTU/h", "1,5 TR"); sem capacidade, nada. O número vem
 * como texto do `numeric(12,2)`.
 */
export function capacidade(valor: string | null, unidade: string | null): string | null {
  if (vazio(valor)) return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const v = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
  return vazio(unidade) ? v : `${v} ${(unidade as string).trim()}`;
}

// ---------------------------------------------------------------------------------------------
// Anexo 2 – ficha histórico (RF-16.1, RN-150, DEC-22)
// ---------------------------------------------------------------------------------------------

/** Enum `occurrence_status` (03 §4); `NAO_PREVISTA` também vale para o mês fora da periodicidade. */
export type EstadoDaCelula = "NAO_PREVISTA" | "PREVISTA" | "PENDENTE" | "OK" | "NOK";

/** RN-150 e 04 §1.5: `PREVISTA` é a célula vazia. */
export const ROTULO_CELULA: Record<EstadoDaCelula, string> = {
  NAO_PREVISTA: "Ø",
  PREVISTA: "",
  PENDENTE: "Pendente",
  OK: "OK",
  NOK: "NOK",
};

/** RN-150 (legenda de NOK pela decisão F1). Descrição de "Pendente" [A VALIDAR]. */
export const LEGENDA_FICHA = [
  "OK – efetuado",
  "NOK – não efetuado",
  "Ø – não previsto",
  "Pendente",
] as const;

/** DEC-22 e CA-12.3: a ficha cobre toda a duração do contrato, em blocos de 12 meses. */
export function blocosDeDozeMeses<T>(meses: readonly T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < meses.length; i += 12) r.push(meses.slice(i, i + 12));
  return r;
}

/**
 * Estado da célula na emissão: ainda não há registro, então o mês previsto é `PREVISTA` (vazio) e o
 * outro é Ø. A ficha atualizada (RN-131) passa o estado gravado em `occurrence`.
 */
export const estadoNaEmissao = (previstos: readonly number[], mes: number): EstadoDaCelula =>
  previstos.includes(mes) ? "PREVISTA" : "NAO_PREVISTA";
