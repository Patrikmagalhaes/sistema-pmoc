/** RNF-07, RN-132; RN-010, RN-011, RN-050, RN-052, RN-150; CA-12.2, CA-12.3, CA-12.4. */
import { describe, expect, it } from "vitest";
import { mesesDoCronograma } from "@/modules/cronograma";
import {
  blocosDeDozeMeses,
  CAMPO_VAZIO_NO_PDF,
  campos,
  camposDeEndereco,
  capacidade,
  dataPorExtenso,
  enderecoEmLinha,
  estadoNaEmissao,
  identificacaoContrato,
  listagemDeEquipamentos,
  localEData,
  mesCurto,
  porExtenso,
  ROTULO_CELULA,
  telefone,
  telefones,
  vigencia,
} from "./documento";
import type { Endereco, TipoDoSnapshot } from "./snapshot";

const endereco: Endereco = {
  logradouro: "Rua São Ludgéro",
  numero: "1006",
  semNumero: false,
  complemento: null,
  bairro: "Barreiros",
  cidade: "São José",
  uf: "SC",
  cep: "88117320",
};

describe("RN-010 / CA-12.4: identificação TH-revisão", () => {
  it("TH e revisão → TH12326-R1", () => {
    expect(identificacaoContrato("TH12326", "R1")).toBe("TH12326-R1");
  });
  it("só TH → só o TH", () => {
    expect(identificacaoContrato("TH12326", null)).toBe("TH12326");
    expect(identificacaoContrato("TH12326", "  ")).toBe("TH12326");
  });
  it("sem TH → nada, mesmo com revisão", () => {
    expect(identificacaoContrato(null, null)).toBeNull();
    expect(identificacaoContrato(null, "R1")).toBeNull();
  });
});

describe("RN-011: capa", () => {
  it("cidade da empresa e início da vigência por extenso", () => {
    expect(dataPorExtenso("2025-04-01")).toBe("1 de abril de 2025");
    expect(localEData("São José", "2025-04-01")).toBe("São José, 1 de abril de 2025");
  });
  it("RNF-07: vigência com datas dd/mm/aaaa", () => {
    expect(vigencia("2025-04-01", "2026-04-30")).toBe("Vigência de 01/04/2025 até 30/04/2026");
  });
});

describe("CA-12.2: campo opcional vazio", () => {
  it(`padrão ${CAMPO_VAZIO_NO_PDF}: nunca imprime null nem o rótulo vazio`, () => {
    const r = campos([
      ["Fone", null],
      ["Marca", undefined],
      ["Modelo", "  "],
      ["Série", "1821B00535444"],
    ]);
    expect(r).toEqual([{ rotulo: "Série", valor: "1821B00535444" }]);
    expect(JSON.stringify(r)).not.toMatch(/null|undefined/);
  });

  it("endereço: s/n e bairro opcional sem rótulo vazio", () => {
    const e = { ...endereco, numero: null, semNumero: true, bairro: null };
    expect(camposDeEndereco(e).map((c) => `${c.rotulo}: ${c.valor}`)).toEqual([
      "Endereço: Rua São Ludgéro",
      "Nº: s/n",
      "Cidade: São José",
      "UF: SC",
      "CEP: 88117-320",
    ]);
    expect(enderecoEmLinha(endereco)).toBe("Rua São Ludgéro, 1006, Barreiros, São José/SC");
  });

  it("análise B7: dois telefones sem repetir, com máscara", () => {
    expect(telefones("4832594000", "4832594000")).toBe("(48) 3259-4000");
    expect(telefones("4832594000", "48999990000")).toBe("(48) 3259-4000 / (48) 99999-0000");
    expect(telefones(null, null)).toBeNull();
  });

  it("RNF-07: telefone com máscara; vazio continua vazio", () => {
    expect(telefone("4832594000")).toBe("(48) 3259-4000");
    expect(telefone("  ")).toBeNull();
    expect(telefone(null)).toBeNull();
  });

  it("endereço sem número e sem s/n: o Nº fica fora", () => {
    const e = { ...endereco, numero: null, semNumero: false };
    expect(camposDeEndereco(e).map((c) => c.rotulo)).not.toContain("Nº");
    expect(enderecoEmLinha(e)).toBe("Rua São Ludgéro, Barreiros, São José/SC");
  });
});

describe("RN-050: listagem de equipamentos", () => {
  it("quantidade por extenso", () => {
    expect(
      [1, 2, 3, 14, 16, 20, 21, 99, 100, 101, 115, 200, 999].map((n) => porExtenso(n)),
    ).toEqual([
      "um",
      "dois",
      "três",
      "catorze",
      "dezesseis",
      "vinte",
      "vinte e um",
      "noventa e nove",
      "cem",
      "cento e um",
      "cento e quinze",
      "duzentos",
      "novecentos e noventa e nove",
    ]);
  });

  it("fora de 1 a 999 (ou não inteiro), só o número", () => {
    expect([0, 1000, 1.5, -2].map((n) => porExtenso(n))).toEqual(["0", "1000", "1.5", "-2"]);
  });

  const eq = (tag: string, grupo: string) => ({
    id: tag,
    tag,
    grupo,
    localizacao: "Sala",
    marca: null,
    modelo: null,
    serie: null,
    capacidade: null,
    unidadeCapacidade: null,
  });
  const tipo = (
    nome: string,
    plural: string | null,
    equipamentos: ReturnType<typeof eq>[],
  ): TipoDoSnapshot => ({
    id: nome,
    nome,
    nomePlural: plural,
    sigla: "SPL",
    atividades: [],
    equipamentos,
  });

  it("agrupa por tipo + grupo, com concordância, plural e TAGs (B12, B13)", () => {
    const r = listagemDeEquipamentos([
      tipo("Split", "Splits", [
        eq("L1-SPL-001", "Hi-Wall"),
        eq("L1-SPL-002", "Tipo Piso-Teto"),
        eq("L1-SPL-003", "Hi-Wall"),
      ]),
      tipo("Fancolete", null, [eq("L1-FCL-001", "Built-in"), eq("L1-FCL-002", "Built-in")]),
    ]);
    expect(r).toEqual([
      { texto: "2 (dois) Splits, tipo Hi-Wall", tags: ["L1-SPL-001", "L1-SPL-003"] },
      { texto: "1 (um) Split, Tipo Piso-Teto", tags: ["L1-SPL-002"] },
      { texto: "2 (dois) Fancolete, tipo Built-in", tags: ["L1-FCL-001", "L1-FCL-002"] },
    ]);
  });
});

describe("RN-052: capacidade", () => {
  it("número pt-BR + unidade; vazio fica fora", () => {
    expect(capacidade("18000.00", "BTU/h")).toBe("18.000 BTU/h");
    expect(capacidade("1.50", "TR")).toBe("1,5 TR");
    expect(capacidade(null, "BTU/h")).toBeNull();
  });

  it("sem unidade, só o número; valor que não é número fica fora", () => {
    expect(capacidade("9000.00", null)).toBe("9.000");
    expect(capacidade("9000.00", " ")).toBe("9.000");
    expect(capacidade("abc", "BTU/h")).toBeNull();
  });
});

describe("Anexo 2: ficha histórico", () => {
  it("CA-12.3: contrato de 18 meses → blocos de 12 e 6, cobrindo os 18", () => {
    const meses = mesesDoCronograma("2025-04-01", 18);
    const blocos = blocosDeDozeMeses(meses);
    expect(blocos.map((b) => b.length)).toEqual([12, 6]);
    expect(blocos.flat()).toHaveLength(18);
    expect(mesCurto(meses[0] as (typeof meses)[number])).toBe("Abr/25");
    expect(mesCurto(meses[17] as (typeof meses)[number])).toBe("Set/26");
  });

  it("RN-150: na emissão, prevista = célula vazia, fora da periodicidade = Ø", () => {
    expect(ROTULO_CELULA[estadoNaEmissao([1, 4, 7, 10], 4)]).toBe("");
    expect(ROTULO_CELULA[estadoNaEmissao([1, 4, 7, 10], 5)]).toBe("Ø");
    expect(ROTULO_CELULA.PENDENTE).toBe("Pendente");
  });
});
