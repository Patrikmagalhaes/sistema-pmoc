/**
 * Retrato da emissão (`pmoc_version.snapshot`, 03 §2.6 e §6.2): todos os dados usados para gerar o
 * PDF do PMOC, imutável depois do `INSERT`. Mesmo retrato → mesmo conteúdo (RNF-07). Sem banco: recebe
 * o que a emissão leu na transação e só seleciona e ordena. Tudo aqui é serializável em JSON.
 */
import { ordenarAtividades, type Periodicidade } from "@/modules/biblioteca";
import { type MesDoContrato, mesesDoCronograma, mesesPrevistos } from "@/modules/cronograma";

/** Versão do formato do retrato (`pmoc_version.snapshot_schema_version`). */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Bloco `[E]` (03 §1): endereço cru, sem máscara. */
export interface Endereco {
  logradouro: string;
  numero: string | null;
  semNumero: boolean;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string;
}

export interface EmpresaDoDocumento {
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  crea: string;
  endereco: Endereco;
  /** `executor_company.logo_file_id`: o logo do cabeçalho (RNF-07). */
  logoArquivoId: string | null;
}

export interface RtDoDocumento {
  nome: string;
  titulo: string;
  registro: string;
  telefone: string;
  email: string;
  endereco: Endereco;
}

export interface ClienteDoDocumento {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  telefone1: string | null;
  telefone2: string | null;
  endereco: Endereco;
}

export interface LocalDoDocumento {
  nome: string;
  codigo: string;
  telefone: string | null;
  endereco: Endereco;
}

export interface ContratoDoDocumento {
  /** `YYYY-MM-DD`. */
  inicio: string;
  fim: string;
  meses: number;
  art: string;
  th: string | null;
  revisao: string | null;
}

export interface TipoLido {
  id: string;
  nome: string;
  /** `equipment_type.plural_name` (RN-050 [A VALIDAR]); sem plural, usa o nome. */
  nomePlural: string | null;
  sigla: string;
}

export interface AtividadeLida {
  id: string;
  tipoId: string;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: "VERIFICACAO" | "MEDICAO";
  unidade: string | null;
  ordem: number;
  removida: boolean;
}

export interface EquipamentoLido {
  id: string;
  tag: string;
  tipoId: string;
  grupo: string;
  localizacao: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  /** `numeric(12,2)` como texto (ex.: `"18000.00"`), para não perder casas. */
  capacidade: string | null;
  unidadeCapacidade: string | null;
  situacao: "ATIVO" | "INATIVO";
}

/** Texto fixo com a versão usada (para regerar igual, INT-22). */
export interface TextoDoDocumento {
  versao: string;
  paragrafos: string[];
}

export interface TextosDoDocumento {
  /** `standard_text` `RECOMENDACOES_PMOC` (DEC-19; P2). */
  recomendacoes: TextoDoDocumento;
  /** Anexo 1: Portaria MS 3.523/1998 (P3). */
  anexo1: TextoDoDocumento & { titulo: string };
}

/** O que a emissão lê na transação para montar o retrato. */
export interface DadosDoDocumento {
  empresa: EmpresaDoDocumento;
  rt: RtDoDocumento;
  cliente: ClienteDoDocumento;
  local: LocalDoDocumento;
  contrato: ContratoDoDocumento;
  textos: TextosDoDocumento;
  tipos: readonly TipoLido[];
  atividades: readonly AtividadeLida[];
  equipamentos: readonly EquipamentoLido[];
}

export interface AtividadeDoSnapshot {
  id: string;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: "VERIFICACAO" | "MEDICAO";
  unidade: string | null;
  /** RN-023: meses previstos do contrato (1..N). */
  previstos: number[];
}

export interface EquipamentoDoSnapshot {
  id: string;
  tag: string;
  grupo: string;
  localizacao: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  capacidade: string | null;
  unidadeCapacidade: string | null;
}

export interface TipoDoSnapshot {
  id: string;
  nome: string;
  nomePlural: string | null;
  sigla: string;
  /** Na ordem da RN-051 (vale para o cronograma e para todas as fichas do tipo). */
  atividades: AtividadeDoSnapshot[];
  /** Por TAG. */
  equipamentos: EquipamentoDoSnapshot[];
}

export interface SnapshotPmocV1 {
  schema: typeof SNAPSHOT_SCHEMA_VERSION;
  empresa: EmpresaDoDocumento;
  rt: RtDoDocumento;
  cliente: ClienteDoDocumento;
  local: LocalDoDocumento;
  contrato: ContratoDoDocumento;
  textos: TextosDoDocumento;
  /** RN-021: meses 1..N com o mês de calendário. */
  calendario: MesDoContrato[];
  /** Só os tipos presentes (com equipamento `ATIVO`), por nome (RN-051: uma tabela por tipo). */
  tipos: TipoDoSnapshot[];
}

const porTexto = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/**
 * Monta o retrato. Entram só os equipamentos `ATIVO` (RN-023, RN-050) e as atividades não removidas
 * dos tipos presentes, as mesmas que o `buildSchedule` da emissão usa. Tipo presente sem atividade
 * fica com a lista vazia (a seção 5 ainda lista os equipamentos dele).
 */
export function montarSnapshot(d: DadosDoDocumento): SnapshotPmocV1 {
  const { meses } = d.contrato;
  const ativos = d.equipamentos.filter((e) => e.situacao === "ATIVO");
  const tipos = d.tipos
    .filter((t) => ativos.some((e) => e.tipoId === t.id))
    .sort((a, b) => porTexto(a.nome, b.nome) || porTexto(a.id, b.id))
    .map(
      (t): TipoDoSnapshot => ({
        id: t.id,
        nome: t.nome,
        nomePlural: t.nomePlural,
        sigla: t.sigla,
        atividades: ordenarAtividades(
          d.atividades.filter((a) => a.tipoId === t.id && !a.removida),
        ).map((a) => ({
          id: a.id,
          titulo: a.titulo,
          periodicidade: a.periodicidade,
          natureza: a.natureza,
          unidade: a.unidade,
          previstos: mesesPrevistos(a.periodicidade, meses),
        })),
        equipamentos: ativos
          .filter((e) => e.tipoId === t.id)
          .sort((a, b) => porTexto(a.tag, b.tag))
          .map((e) => ({
            id: e.id,
            tag: e.tag,
            grupo: e.grupo,
            localizacao: e.localizacao,
            marca: e.marca,
            modelo: e.modelo,
            serie: e.serie,
            capacidade: e.capacidade,
            unidadeCapacidade: e.unidadeCapacidade,
          })),
      }),
    );
  return {
    schema: SNAPSHOT_SCHEMA_VERSION,
    empresa: d.empresa,
    rt: d.rt,
    cliente: d.cliente,
    local: d.local,
    contrato: d.contrato,
    textos: d.textos,
    calendario: mesesDoCronograma(d.contrato.inicio, meses),
    tipos,
  };
}
