/**
 * Retrato fictício para os testes do PDF do PMOC (06 LG-06: nada de dado real). Tipos com o número de
 * atividades da análise §4 (até 23), como no spike S-01.
 */
import { ANEXO1, type DadosDoDocumento } from "../../src/modules/pmoc";

type Periodicidade = "MM" | "MB" | "MT" | "MS" | "MA";
const CICLO: Periodicidade[] = ["MM", "MB", "MT", "MT", "MS", "MA"];

const TIPOS = [
  { id: "t1", nome: "Split", nomePlural: "Splits", sigla: "SPL", atividades: 14, fatia: 0.6 },
  {
    id: "t2",
    nome: "VRF Condensador",
    nomePlural: null,
    sigla: "VRC",
    atividades: 23,
    fatia: 0.15,
  },
  { id: "t3", nome: "VRF Evaporador", nomePlural: null, sigla: "VRE", atividades: 11, fatia: 0.2 },
  {
    id: "t4",
    nome: "Fancolete",
    nomePlural: "Fancoletes",
    sigla: "FCL",
    atividades: 9,
    fatia: 0.05,
  },
];
const GRUPOS: Record<string, string[]> = {
  t1: ["Hi-Wall", "Tipo Piso-Teto", "Cassete"],
  t2: ["Condensadora"],
  t3: ["Cassete", "Built-in"],
  t4: ["Built-in"],
};

const endereco = {
  logradouro: "Rua das Palmeiras Fictícias",
  numero: "100",
  semNumero: false,
  complemento: null,
  bairro: "Centro",
  cidade: "Florianópolis",
  uf: "SC",
  cep: "88010000",
};

/** `n` equipamentos `ATIVO` distribuídos pelos tipos; contrato de `meses` meses a partir de abr/2025. */
export function dadosFicticios(n: number, meses = 12): DadosDoDocumento {
  const tipos = TIPOS.slice(0, n === 1 ? 1 : TIPOS.length);
  const equipamentos: DadosDoDocumento["equipamentos"][number][] = [];
  let resto = n;
  tipos.forEach((t, ti) => {
    const qtd = ti === tipos.length - 1 ? resto : Math.round(n * t.fatia);
    resto -= qtd;
    const grupos = GRUPOS[t.id] ?? ["Padrão"];
    for (let i = 1; i <= qtd; i++) {
      equipamentos.push({
        id: `${t.id}-e${i}`,
        tag: `L012-${t.sigla}-${String(i).padStart(3, "0")}`,
        tipoId: t.id,
        grupo: grupos[i % grupos.length] as string,
        localizacao: `Sala ${100 + (i % 40)}`,
        marca: i % 3 === 0 ? null : "Fabricante Fictício",
        modelo: i % 2 === 0 ? null : `MOD-${i}`,
        serie: null,
        capacidade: i % 4 === 0 ? null : `${9000 + (i % 4) * 3000}.00`,
        unidadeCapacidade: i % 4 === 0 ? null : "BTU/h",
        situacao: "ATIVO",
      });
    }
  });
  // Um inativo que não pode aparecer em lugar nenhum (RN-050).
  equipamentos.push({
    ...(equipamentos[0] as DadosDoDocumento["equipamentos"][number]),
    id: "inativo",
    tag: "L012-SPL-999",
    situacao: "INATIVO",
  });
  const atividades = tipos.flatMap((t) =>
    Array.from({ length: t.atividades }, (_, i) => {
      const medicao = i === 2;
      return {
        id: `${t.id}-a${i + 1}`,
        tipoId: t.id,
        titulo: medicao
          ? `Medição da corrente elétrica do ${t.nome.toLowerCase()} (A)`
          : `Verificação do componente ${i + 1} do ${t.nome.toLowerCase()} e conexões`,
        periodicidade: CICLO[i % CICLO.length] as Periodicidade,
        natureza: medicao ? ("MEDICAO" as const) : ("VERIFICACAO" as const),
        unidade: medicao ? "A" : null,
        ordem: i + 1,
        removida: false,
      };
    }),
  );
  return {
    empresa: {
      razaoSocial: "Empresa Fictícia de Climatização Ltda",
      cnpj: "11222333000181",
      telefone: "4830000000",
      crea: "000000-0",
      endereco,
      logoArquivoId: null,
    },
    rt: {
      nome: "Responsável Técnico Fictício",
      titulo: "Engenheiro Responsável",
      registro: "000000-0",
      telefone: "48999990000",
      email: "rt@exemplo.test",
      endereco,
    },
    cliente: {
      razaoSocial: "Cliente Fictício Comércio Ltda",
      nomeFantasia: "Loja Fictícia",
      cnpj: "11444777000161",
      telefone1: null,
      telefone2: null,
      endereco: { ...endereco, bairro: null },
    },
    local: {
      nome: "Loja Fictícia – Centro",
      codigo: "L012",
      telefone: null,
      endereco: { ...endereco, numero: null, semNumero: true, complemento: "KM 1", bairro: null },
    },
    contrato: {
      inicio: "2025-04-01",
      fim: meses === 12 ? "2026-03-31" : "2026-09-30",
      meses,
      art: "ART-FICTICIA-1",
      th: "TH12326",
      revisao: "R1",
    },
    textos: {
      recomendacoes: {
        versao: "1",
        paragrafos: ["Recomendações fictícias para falha e emergência."],
      },
      anexo1: {
        versao: ANEXO1.versao,
        titulo: ANEXO1.titulo,
        paragrafos: [...ANEXO1.paragrafos],
      },
    },
    tipos: tipos.map(({ id, nome, nomePlural, sigla }) => ({ id, nome, nomePlural, sigla })),
    atividades,
    equipamentos,
  };
}
