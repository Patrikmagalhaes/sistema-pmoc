/**
 * Spike S-01 (docs/05 §10.4): PMOC sintético com a estrutura da RF-12.2, para medir tempo e memória do
 * @react-pdf/renderer. Não é o layout final (Etapa 4, TL-121): só reproduz o volume (páginas, tabelas,
 * uma ficha histórico por equipamento em blocos de 12 meses, 01 §9 regra 3). Dados fictícios.
 */
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

const PER = { MM: 1, MB: 2, MT: 3, MS: 6, MA: 12 } as const;
type Per = keyof typeof PER;

/** Tipos com o número de atividades da análise §4 (VRF Condensador é o maior: 23). */
const TIPOS: { nome: string; sigla: string; grupo: string; atividades: number; fatia: number }[] = [
  { nome: "Split", sigla: "SPL", grupo: "Hi-Wall", atividades: 14, fatia: 0.6 },
  { nome: "VRF Condensador", sigla: "VRC", grupo: "Condensadora", atividades: 23, fatia: 0.15 },
  { nome: "VRF Evaporador", sigla: "VRE", grupo: "Cassete", atividades: 11, fatia: 0.2 },
  { nome: "Fancolete", sigla: "FCL", grupo: "Piso-teto", atividades: 9, fatia: 0.05 },
];
const CICLO: Per[] = ["MM", "MB", "MT", "MT", "MS", "MA"];

export type Atividade = { titulo: string; per: Per };
export type Tipo = { nome: string; sigla: string; grupo: string; atividades: Atividade[] };
export type Equipamento = {
  tag: string;
  tipo: Tipo;
  ambiente: string;
  marca: string;
  capacidade: string;
};

export function dadosSinteticos(n: number, meses: number) {
  const tipos: Tipo[] = TIPOS.map((t) => ({
    ...t,
    atividades: Array.from({ length: t.atividades }, (_, i) => ({
      titulo: `Verificação de componente ${i + 1} do ${t.nome.toLowerCase()} e conexões elétricas`,
      per: CICLO[i % CICLO.length] as Per,
    })),
  }));
  const equipamentos: Equipamento[] = [];
  let resto = n;
  tipos.forEach((tipo, ti) => {
    const qtd = ti === tipos.length - 1 ? resto : Math.round(n * (TIPOS[ti]?.fatia ?? 0));
    resto -= qtd;
    for (let i = 1; i <= qtd; i++) {
      equipamentos.push({
        tag: `L012-${tipo.sigla}-${String(i).padStart(3, "0")}`,
        tipo,
        ambiente: `Sala ${100 + (i % 40)} – bloco ${String.fromCharCode(65 + (i % 6))}`,
        marca: "Fabricante Fictício",
        capacidade: `${9000 + (i % 4) * 3000} BTU/h`,
      });
    }
  });
  return { tipos, equipamentos, meses };
}

/** 01 §9 regra 3: prevista nos meses 1, 1+k, 1+2k, … dentro da duração. */
const prevista = (per: Per, mes: number) => (mes - 1) % PER[per] === 0;

const s = StyleSheet.create({
  page: {
    paddingTop: 70,
    paddingBottom: 50,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: { position: "absolute", top: 20, left: 32, right: 32, borderBottom: 1, paddingBottom: 6 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  h1: { fontSize: 14, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottom: 0.5 },
  cell: { padding: 2, borderRight: 0.5 },
  th: { fontFamily: "Helvetica-Bold" },
});

function Cabecalho() {
  return (
    <View style={s.header} fixed>
      <Text>Empresa Fictícia de Climatização Ltda · CNPJ 00.000.000/0001-91</Text>
      <Text>Rua Exemplo, 100 – Centro – Florianópolis/SC – CEP 88000-000</Text>
    </View>
  );
}

/** RNF-07: `Página {n} de {total}`, data de geração, TH-revisão (quando houver) e versão/código (RN-187). */
function Rodape({ registro }: { registro?: string[] }) {
  return (
    <View style={s.footer} fixed>
      <Text>Gerado em 12/11/2026 · TH12326-R1 · v1 · Código ABCD-EFGH</Text>
      <Text
        render={({ pageNumber, totalPages }) => {
          const t = `Página ${pageNumber} de ${totalPages}`;
          registro?.push(t);
          return t;
        }}
      />
    </View>
  );
}

function Linha({ cols, w, th }: { cols: string[]; w: number[]; th?: boolean }) {
  return (
    <View style={s.row} wrap={false}>
      {cols.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas, nunca reordenadas
        <Text key={i} style={[s.cell, { width: w[i] }, th ? s.th : {}]}>
          {c}
        </Text>
      ))}
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <View>
      <Text style={s.h1}>{titulo}</Text>
      {children}
    </View>
  );
}

export function PmocSintetico({
  dados,
  registro,
}: {
  dados: ReturnType<typeof dadosSinteticos>;
  registro?: string[];
}) {
  const { tipos, equipamentos, meses } = dados;
  /** Índice de cada bloco de 12 meses da ficha (DEC-22: toda a duração do contrato). */
  const blocos = [...Array(Math.ceil(meses / 12)).keys()];
  const texto =
    "Texto padrão de recomendações para falha e emergência, com acentuação: ação, manutenção. ";
  return (
    <Document title="PMOC sintético" creationDate={new Date("2026-11-12T12:00:00Z")}>
      <Page size="A4" style={s.page}>
        <Cabecalho />
        <Text style={[s.h1, { marginTop: 200, textAlign: "center" }]}>
          PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE – PMOC
        </Text>
        <Text style={{ textAlign: "center" }}>TH12326-R1</Text>
        <Rodape registro={registro} />
      </Page>
      <Page size="A4" style={s.page}>
        <Cabecalho />
        <Secao titulo="1. Dados da instalação">
          <Text>Local L012 – Edifício Fictício · CEP 88000-000</Text>
        </Secao>
        <Secao titulo="2. Dados do proprietário">
          <Text>Cliente Fictício S.A. · CNPJ 00.000.000/0002-72</Text>
        </Secao>
        <Secao titulo="3. Dados da empresa executora">
          <Text>Empresa Fictícia de Climatização Ltda</Text>
        </Secao>
        <Secao titulo="4. Dados do responsável técnico">
          <Text>Responsável Fictício · CREA 000000-0</Text>
        </Secao>
        <Secao titulo="5. Listagem de equipamentos">
          <Linha
            th
            cols={["TAG", "Tipo", "Grupo", "Ambiente", "Capacidade"]}
            w={[80, 90, 70, 180, 80]}
          />
          {equipamentos.map((e) => (
            <Linha
              key={e.tag}
              cols={[e.tag, e.tipo.nome, e.tipo.grupo, e.ambiente, e.capacidade]}
              w={[80, 90, 70, 180, 80]}
            />
          ))}
        </Secao>
        <Rodape registro={registro} />
      </Page>
      <Page size="A4" style={s.page}>
        <Cabecalho />
        <Secao titulo="6. Cronograma">
          {tipos.map((t) => (
            <View key={t.sigla} style={{ marginBottom: 10 }}>
              <Text style={s.th}>{t.nome}</Text>
              <Linha
                th
                cols={["Atividade", "MM", "MB", "MT", "MS", "MA"]}
                w={[330, 36, 36, 36, 36, 36]}
              />
              {t.atividades.map((a) => (
                <Linha
                  key={a.titulo}
                  cols={[
                    a.titulo,
                    ...(Object.keys(PER) as Per[]).map((p) => (p === a.per ? "X" : "")),
                  ]}
                  w={[330, 36, 36, 36, 36, 36]}
                />
              ))}
            </View>
          ))}
        </Secao>
        <Secao titulo="Recomendações para falha e emergência">
          <Text>{texto.repeat(30)}</Text>
        </Secao>
        <Secao titulo="Anexo 1 – Portaria MS 3.523/1998">
          <Text>{texto.repeat(120)}</Text>
        </Secao>
        <Rodape registro={registro} />
      </Page>
      {equipamentos.flatMap((e) =>
        blocos.map((b) => (
          <Page
            key={`${e.tag}-${b}`}
            size="A4"
            orientation="portrait"
            style={[s.page, { paddingTop: 32 }]}
          >
            <Text style={s.h1}>
              Anexo 2 – Ficha histórico · {e.tag} · {e.ambiente}
            </Text>
            <Linha
              th
              cols={["Atividade", ...Array.from({ length: 12 }, (_, m) => String(b * 12 + m + 1))]}
              w={[195, ...Array(12).fill(28)]}
            />
            {e.tipo.atividades.map((a) => (
              <Linha
                key={a.titulo}
                cols={[
                  a.titulo,
                  ...Array.from({ length: 12 }, (_, m) => {
                    const mes = b * 12 + m + 1;
                    return mes <= meses && prevista(a.per, mes) ? "X" : "";
                  }),
                ]}
                w={[195, ...Array(12).fill(28)]}
              />
            ))}
            <Rodape registro={registro} />
          </Page>
        )),
      )}
    </Document>
  );
}

export function gerarPmocSintetico(n: number, meses = 12, registro?: string[]) {
  return renderToBuffer(<PmocSintetico dados={dadosSinteticos(n, meses)} registro={registro} />);
}
