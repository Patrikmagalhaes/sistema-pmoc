/** Retrato da emissão (03 §6.2; RNF-07 "mesmo dado → mesmo conteúdo"); RN-023, RN-050, RN-051. */
import { describe, expect, it } from "vitest";
import {
  type AtividadeLida,
  type DadosDoDocumento,
  type EquipamentoLido,
  montarSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
} from "./snapshot";

const endereco = {
  logradouro: "Rua A",
  numero: "1",
  semNumero: false,
  complemento: null,
  bairro: null,
  cidade: "Florianópolis",
  uf: "SC",
  cep: "88000000",
};

const atv = (id: string, tipoId: string, p: AtividadeLida["periodicidade"], ordem: number) =>
  ({
    id,
    tipoId,
    titulo: id,
    periodicidade: p,
    natureza: "VERIFICACAO",
    unidade: null,
    ordem,
    removida: false,
  }) satisfies AtividadeLida;

const equip = (tag: string, tipoId: string, situacao: "ATIVO" | "INATIVO" = "ATIVO") =>
  ({
    id: tag,
    tag,
    tipoId,
    grupo: "G",
    localizacao: "Sala",
    marca: null,
    modelo: null,
    serie: null,
    capacidade: null,
    unidadeCapacidade: null,
    situacao,
  }) satisfies EquipamentoLido;

const dados = (o: Partial<DadosDoDocumento> = {}): DadosDoDocumento => ({
  empresa: {
    razaoSocial: "Empresa",
    cnpj: "11222333000181",
    telefone: "4830000000",
    crea: "1",
    endereco,
    logoArquivoId: null,
  },
  rt: {
    nome: "RT",
    titulo: "Eng.",
    registro: "1",
    telefone: "4830000000",
    email: "rt@exemplo.test",
    endereco,
  },
  cliente: {
    razaoSocial: "Cliente",
    nomeFantasia: null,
    cnpj: "11222333000181",
    telefone1: null,
    telefone2: null,
    endereco,
  },
  local: { nome: "Loja", codigo: "L001", telefone: null, endereco },
  contrato: {
    inicio: "2025-04-01",
    fim: "2026-09-30",
    meses: 18,
    art: "ART",
    th: null,
    revisao: null,
  },
  textos: {
    recomendacoes: { versao: "1", paragrafos: ["Recomendações."] },
    anexo1: { versao: "rascunho-1", titulo: "Portaria", paragrafos: ["Art. 1º"] },
  },
  tipos: [
    { id: "t-split", nome: "Split", nomePlural: "Splits", sigla: "SPL" },
    { id: "t-fan", nome: "Fancolete", nomePlural: null, sigla: "FCL" },
    { id: "t-vazio", nome: "Ausente", nomePlural: null, sigla: "AUS" },
  ],
  atividades: [
    atv("s-ma", "t-split", "MA", 1),
    atv("s-mm-2", "t-split", "MM", 2),
    atv("s-mm-1", "t-split", "MM", 1),
    { ...atv("s-removida", "t-split", "MM", 0), removida: true },
    atv("a-ausente", "t-vazio", "MM", 1),
  ],
  equipamentos: [
    equip("L001-SPL-002", "t-split"),
    equip("L001-SPL-001", "t-split"),
    equip("L001-SPL-003", "t-split", "INATIVO"),
    equip("L001-FCL-001", "t-fan"),
    equip("L001-AUS-001", "t-vazio", "INATIVO"),
  ],
  ...o,
});

describe("montarSnapshot", () => {
  const s = montarSnapshot(dados());

  it("versão do formato e calendário do contrato inteiro (RN-021, CA-12.3)", () => {
    expect(s.schema).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(s.calendario).toHaveLength(18);
    expect(s.calendario[0]?.referencia).toBe("2025-04-01");
  });

  it("só tipos presentes (com equipamento ATIVO), por nome (RN-051)", () => {
    expect(s.tipos.map((t) => t.id)).toEqual(["t-fan", "t-split"]);
  });

  it("tipo presente sem atividade fica com a lista vazia", () => {
    expect(s.tipos[0]?.atividades).toEqual([]);
    expect(s.tipos[0]?.equipamentos.map((e) => e.tag)).toEqual(["L001-FCL-001"]);
  });

  it("RN-051: atividades por periodicidade e ordem, sem as removidas", () => {
    expect(s.tipos[1]?.atividades.map((a) => a.id)).toEqual(["s-mm-1", "s-mm-2", "s-ma"]);
  });

  it("RN-023: meses previstos de cada atividade", () => {
    const [mm, , ma] = s.tipos[1]?.atividades ?? [];
    expect(mm?.previstos).toHaveLength(18);
    expect(ma?.previstos).toEqual([1, 13]);
  });

  it("RN-050: só equipamentos ATIVO, por TAG", () => {
    expect(s.tipos[1]?.equipamentos.map((e) => e.tag)).toEqual(["L001-SPL-001", "L001-SPL-002"]);
  });

  it("RNF-07: tipos com o mesmo nome saem na mesma ordem, qualquer que seja a de entrada", () => {
    const gemeos = [
      { id: "t-b", nome: "Split", nomePlural: null, sigla: "SPB" },
      { id: "t-a", nome: "Split", nomePlural: null, sigla: "SPA" },
    ];
    const equipamentos = [equip("L001-SPB-001", "t-b"), equip("L001-SPA-001", "t-a")];
    const ida = montarSnapshot(dados({ tipos: gemeos, atividades: [], equipamentos }));
    const volta = montarSnapshot(
      dados({ tipos: [...gemeos].reverse(), atividades: [], equipamentos }),
    );
    expect(ida.tipos.map((t) => t.id)).toEqual(["t-a", "t-b"]);
    expect(volta.tipos.map((t) => t.id)).toEqual(["t-a", "t-b"]);
  });

  it("serializável e determinístico (RNF-07)", () => {
    const json = JSON.stringify(s);
    expect(JSON.parse(json)).toEqual(s);
    expect(JSON.stringify(montarSnapshot(dados()))).toBe(json);
  });
});
