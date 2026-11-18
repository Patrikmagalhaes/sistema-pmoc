/**
 * PDF do PMOC (RF-12.2, RNF-07, RN-132; layout herdado da análise §1, melhorado pela DEC-01). Só
 * desenha: todo dado vem do retrato (`pmoc_version.snapshot`) e toda regra de apresentação vem do
 * módulo `pmoc` (domain/documento.ts). Fontes padrão do PDF (Helvetica, WinAnsi), sem imagens além do
 * logo da empresa: é o que o spike S-01 mediu.
 */
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { formatarData } from "@/lib/formato";
import { PERIODICIDADES } from "@/modules/biblioteca";
import {
  blocosDeDozeMeses,
  type Campo,
  campos,
  camposDeEndereco,
  capacidade,
  cnpj,
  type EstadoDaCelula,
  enderecoEmLinha,
  estadoNaEmissao,
  identificacaoContrato,
  LEGENDA_FICHA,
  listagemDeEquipamentos,
  localEData,
  mesCurto,
  ROTULO_CELULA,
  type SnapshotPmocV1,
  type TipoDoSnapshot,
  telefone,
  telefones,
  vigencia,
} from "@/modules/pmoc";

export interface LogoDoPdf {
  dados: Buffer;
  formato: "png" | "jpg";
}

export interface EntradaPdfPmoc {
  snapshot: SnapshotPmocV1;
  /** `pmoc_version.version_number` (RN-187). */
  versao: number;
  /** `pmoc_version.verification_code` (RN-187, INT-14). */
  codigoVerificacao: string;
  /** Link do rodapé para a TL-007 (`/verificar/{codigo}`). */
  urlVerificacao: string;
  /** Data de geração do rodapé e do metadado do PDF (mesmo dado → mesmo PDF, RNF-07). */
  geradoEm: Date;
  logo: LogoDoPdf | null;
  /**
   * RF-13.2: indicação de assinatura digital do RT na seção 4. `null` na ficha atualizada (RN-131),
   * que não é assinada.
   */
  assinaturaRt: { em: Date } | null;
  /**
   * Estado de cada célula da ficha (RN-150). Sem a função, vale o da emissão (prevista vazia, Ø);
   * a ficha atualizada (RN-131) passa o estado gravado em `occurrence`.
   */
  estadoDaCelula?: (equipamentoId: string, atividadeId: string, mes: number) => EstadoDaCelula;
}

// Sem hifenização automática: ela é de inglês e quebra palavras em português ("Condiciona-do").
Font.registerHyphenationCallback((palavra) => [palavra]);

const CINZA = "#d9d9d9";
/** A4 retrato em pontos (RNF-07). */
const A4_ALTURA = 841.89;
const PRETO = "#000000";

/** Borda de um lado. O atalho `borderBottom: 0.5` não é lido pelo react-pdf: precisa de largura, cor e estilo. */
const borda = (lado: "Top" | "Bottom" | "Left" | "Right", largura = 0.5) => ({
  [`border${lado}Width`]: largura,
  [`border${lado}Color`]: PRETO,
  [`border${lado}Style`]: "solid" as const,
});

const s = StyleSheet.create({
  pagina: {
    paddingTop: 78,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },
  paginaFicha: { paddingTop: 36 },
  cabecalho: {
    position: "absolute",
    top: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    ...borda("Bottom", 0.75),
    paddingBottom: 6,
  },
  logo: { width: 90, height: 40, objectFit: "contain", marginRight: 10 },
  cabecalhoTexto: { flex: 1, textAlign: "center", fontSize: 8 },
  negrito: { fontFamily: "Helvetica-Bold" },
  rodape: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 7,
    ...borda("Top"),
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rodapeLink: { color: "#000000", textDecoration: "none" },
  rodapeMeio: { flex: 1, paddingLeft: 70, textAlign: "center" },
  rodapeDireita: { width: 70, textAlign: "right" },
  // Por `top`: com `bottom`, o react-pdf 4.9 posiciona texto com `render` fora da página.
  paginacao: { position: "absolute", top: A4_ALTURA - 41, left: 36, width: 70, fontSize: 7 },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6 },
  subtitulo: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  campos: { flexDirection: "row", flexWrap: "wrap" },
  campo: { width: "50%", marginBottom: 2 },
  paragrafo: { marginBottom: 5, textAlign: "justify" },
  capa: { flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" },
  capaCliente: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 24 },
  capaTitulo: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 6, lineHeight: 1.3 },
  rosto: { flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" },
  linha: { flexDirection: "row", ...borda("Bottom"), ...borda("Left") },
  linhaTopo: borda("Top"),
  celula: { padding: 2, ...borda("Right") },
  centro: { textAlign: "center" },
  cinza: { backgroundColor: CINZA },
  assinatura: {
    marginTop: 8,
    padding: 6,
    borderWidth: 0.5,
    borderColor: PRETO,
    borderStyle: "solid",
  },
  legenda: { marginTop: 4, fontSize: 7 },
});

// ---------------------------------------------------------------------------------------------
// Blocos repetidos (análise §1.2; RNF-07; INT-25)
// ---------------------------------------------------------------------------------------------

function Cabecalho({ e, logo }: { e: EntradaPdfPmoc; logo: LogoDoPdf | null }) {
  const emp = e.snapshot.empresa;
  return (
    <View style={s.cabecalho} fixed>
      {logo ? <Image style={s.logo} src={{ data: logo.dados, format: logo.formato }} /> : null}
      <View style={s.cabecalhoTexto}>
        <Text style={s.negrito}>{emp.razaoSocial}</Text>
        <Text>{enderecoEmLinha(emp.endereco)}</Text>
        <Text>Telefone {telefone(emp.telefone)}</Text>
      </View>
    </View>
  );
}

/** RNF-07 e INT-25: página, data de geração, TH-revisão (se houver), versão, código e o sistema. */
function Rodape({ e }: { e: EntradaPdfPmoc }) {
  const id = identificacaoContrato(e.snapshot.contrato.th, e.snapshot.contrato.revisao);
  const meio = [`PMOC gerado digitalmente em ${formatarData(e.geradoEm)}`, id, `v${e.versao}`]
    .filter(Boolean)
    .join(" · ");
  // A paginação é um `Text` fixo próprio: dentro do bloco do rodapé, o `render` desloca o bloco
  // inteiro para fora da página (posição `bottom` recalculada errada no react-pdf 4.9).
  return (
    <>
      <View style={s.rodape} fixed>
        <View style={s.rodapeMeio}>
          <Text>{meio}</Text>
          <Link src={e.urlVerificacao} style={s.rodapeLink}>
            Código de verificação: {e.codigoVerificacao}
          </Link>
        </View>
        <Text style={[s.negrito, s.rodapeDireita]}>{APP_NAME}</Text>
      </View>
      <Text
        style={s.paginacao}
        fixed
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </>
  );
}

function PaginaComCabecalho({ e, children }: { e: EntradaPdfPmoc; children: ReactNode }) {
  return (
    <Page size="A4" style={s.pagina}>
      <Cabecalho e={e} logo={e.logo} />
      {children}
      <Rodape e={e} />
    </Page>
  );
}

function Campos({ lista }: { lista: Campo[] }) {
  return (
    <View style={s.campos}>
      {lista.map((c) => (
        <Text key={c.rotulo} style={s.campo}>
          <Text style={s.negrito}>{c.rotulo}: </Text>
          {c.valor}
        </Text>
      ))}
    </View>
  );
}

function Tabela({
  larguras,
  cabecalho,
  linhas,
}: {
  larguras: (number | string)[];
  cabecalho: string[];
  linhas: { chave: string; celulas: { texto: string; cinza?: boolean }[] }[];
}) {
  return (
    <View>
      <View style={[s.linha, s.linhaTopo]} wrap={false} fixed>
        {cabecalho.map((c, i) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas, nunca reordenadas
            key={i}
            style={[s.celula, s.negrito, { width: larguras[i] }, i > 0 ? s.centro : {}]}
          >
            {c}
          </Text>
        ))}
      </View>
      {linhas.map((l) => (
        <View key={l.chave} style={s.linha} wrap={false}>
          {l.celulas.map((c, i) => (
            <Text
              // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas, nunca reordenadas
              key={i}
              style={[
                s.celula,
                { width: larguras[i] },
                i > 0 ? s.centro : {},
                c.cinza ? s.cinza : {},
              ]}
            >
              {c.texto}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Partes do documento, na ordem da RF-12.2
// ---------------------------------------------------------------------------------------------

/** Capa (análise §1.3; RN-010, RN-011). */
function Capa({ e }: { e: EntradaPdfPmoc }) {
  const { cliente, contrato, empresa } = e.snapshot;
  const id = identificacaoContrato(contrato.th, contrato.revisao);
  return (
    <PaginaComCabecalho e={e}>
      <View style={s.capa}>
        <Text style={s.capaCliente}>{cliente.nomeFantasia ?? cliente.razaoSocial}</Text>
        <Text style={s.capaTitulo}>
          Plano de Manutenção, Operação e Controle do Sistema de Ar Condicionado
        </Text>
        <Text style={[s.capaTitulo, { marginBottom: 24 }]}>PMOC</Text>
        {id ? <Text style={{ marginBottom: 8 }}>{id}</Text> : null}
        <Text style={{ marginBottom: 40 }}>{vigencia(contrato.inicio, contrato.fim)}</Text>
        <Text>{localEData(empresa.endereco.cidade, contrato.inicio)}</Text>
      </View>
    </PaginaComCabecalho>
  );
}

/** Seções 1 a 4 (análise §2.1; RN-053: o RT sempre aparece). */
function Dados({ e }: { e: EntradaPdfPmoc }) {
  const { local, cliente, empresa, rt, contrato } = e.snapshot;
  return (
    <PaginaComCabecalho e={e}>
      <Text style={s.titulo}>1. DADOS DA INSTALAÇÃO</Text>
      <Campos
        lista={[
          ...campos([
            ["Instalação", local.nome],
            ["Cliente", cliente.nomeFantasia ?? cliente.razaoSocial],
          ]),
          ...camposDeEndereco(local.endereco),
          ...campos([["Fone", telefone(local.telefone)]]),
        ]}
      />
      <Text style={s.titulo}>2. DADOS DO PROPRIETÁRIO</Text>
      <Campos
        lista={[
          ...campos([
            ["Razão Social", cliente.razaoSocial],
            ["CNPJ", cnpj(cliente.cnpj)],
            ["Fone", telefones(cliente.telefone1, cliente.telefone2)],
          ]),
          ...camposDeEndereco(cliente.endereco),
        ]}
      />
      <Text style={s.titulo}>3. DADOS DA EMPRESA EXECUTORA</Text>
      <Campos
        lista={[
          ...campos([
            ["Razão Social", empresa.razaoSocial],
            ["CNPJ", cnpj(empresa.cnpj)],
            ["Fone", telefone(empresa.telefone)],
          ]),
          ...camposDeEndereco(empresa.endereco),
          ...campos([
            ["Registro CREA", empresa.crea],
            ["ART", contrato.art],
          ]),
        ]}
      />
      <Text style={s.titulo}>4. DADOS DO RESPONSÁVEL TÉCNICO</Text>
      <Campos
        lista={[
          ...campos([
            ["Profissional", rt.nome],
            ["Título", rt.titulo],
            ["Registro", rt.registro],
            ["Fone", telefone(rt.telefone)],
            ["E-mail", rt.email],
          ]),
          ...camposDeEndereco(rt.endereco),
        ]}
      />
      {e.assinaturaRt ? (
        <View style={s.assinatura} wrap={false}>
          <Text style={s.negrito}>Assinado digitalmente por {rt.nome}</Text>
          <Text>
            Assinatura digital com certificado ICP-Brasil (e-CPF) do responsável técnico, em{" "}
            {formatarData(e.assinaturaRt.em)}.
          </Text>
        </View>
      ) : null}
    </PaginaComCabecalho>
  );
}

/** Seção 5 (RN-050). */
function Listagem({ e }: { e: EntradaPdfPmoc }) {
  return (
    <PaginaComCabecalho e={e}>
      <Text style={s.titulo}>5. LISTAGEM DE EQUIPAMENTOS</Text>
      {listagemDeEquipamentos(e.snapshot.tipos).map((l) => (
        <View key={l.tags[0]} style={{ marginBottom: 4 }} wrap={false}>
          <Text>- {l.texto}</Text>
          <Text style={{ marginLeft: 8, fontSize: 8 }}>TAGs: {l.tags.join(", ")}</Text>
        </View>
      ))}
    </PaginaComCabecalho>
  );
}

const LARGURA_DESCRICAO = 343;

/** Seção 6 (análise §1.4; RN-051): uma tabela por tipo, um "X" na coluna da periodicidade. */
function Cronograma({ e }: { e: EntradaPdfPmoc }) {
  return (
    <PaginaComCabecalho e={e}>
      <Text style={s.titulo}>6. CRONOGRAMA</Text>
      {e.snapshot.tipos.map((t, i) => (
        <View key={t.id} style={{ marginBottom: 8 }}>
          <Text style={s.subtitulo} minPresenceAhead={40}>
            6.{i + 1} {t.nome}
          </Text>
          {t.atividades.length ? (
            <Tabela
              larguras={[LARGURA_DESCRICAO, 36, 36, 36, 36, 36]}
              cabecalho={["DESCRIÇÃO", ...PERIODICIDADES]}
              linhas={t.atividades.map((a) => ({
                chave: a.id,
                celulas: [
                  { texto: a.titulo },
                  ...PERIODICIDADES.map((p) => ({ texto: p === a.periodicidade ? "X" : "" })),
                ],
              }))}
            />
          ) : (
            <Text>Nenhuma atividade deste tipo no plano.</Text>
          )}
        </View>
      ))}
    </PaginaComCabecalho>
  );
}

function Texto({ titulo, paragrafos }: { titulo: string; paragrafos: string[] }) {
  return (
    <>
      <Text style={s.titulo}>{titulo}</Text>
      {paragrafos.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos fixos do texto padrão
        <Text key={i} style={s.paragrafo}>
          {p}
        </Text>
      ))}
    </>
  );
}

function Rosto({ e, anexo, titulo }: { e: EntradaPdfPmoc; anexo: string; titulo: string }) {
  return (
    <PaginaComCabecalho e={e}>
      <View style={s.rosto}>
        <Text style={s.capaTitulo}>{anexo}</Text>
        <Text style={{ fontSize: 12 }}>{titulo}</Text>
      </View>
    </PaginaComCabecalho>
  );
}

/** Ficha histórico de um equipamento, num bloco de até 12 meses (análise §1.5; sem cabeçalho). */
function Ficha({
  e,
  tipo,
  equipamento,
  bloco,
}: {
  e: EntradaPdfPmoc;
  tipo: TipoDoSnapshot;
  equipamento: TipoDoSnapshot["equipamentos"][number];
  bloco: SnapshotPmocV1["calendario"];
}) {
  const estado = (atividadeId: string, previstos: number[], mes: number) =>
    e.estadoDaCelula?.(equipamento.id, atividadeId, mes) ?? estadoNaEmissao(previstos, mes);
  const larguraMes = 28;
  return (
    <Page size="A4" style={[s.pagina, s.paginaFicha]}>
      <Text style={s.subtitulo}>
        {tipo.nome} · {equipamento.tag}
      </Text>
      <Campos
        lista={campos([
          ["Grupo", equipamento.grupo],
          ["Local", equipamento.localizacao],
          ["Marca", equipamento.marca],
          ["Modelo", equipamento.modelo],
          ["Série", equipamento.serie],
          ["Capacidade", capacidade(equipamento.capacidade, equipamento.unidadeCapacidade)],
        ])}
      />
      <View style={{ marginTop: 6, fontSize: 7.5 }}>
        <Tabela
          larguras={[523 - larguraMes * bloco.length, ...bloco.map(() => larguraMes)]}
          cabecalho={["DESCRIÇÃO", ...bloco.map(mesCurto)]}
          linhas={tipo.atividades.map((a) => ({
            chave: a.id,
            celulas: [
              { texto: a.titulo },
              ...bloco.map((m) => {
                const x = estado(a.id, a.previstos, m.indice);
                return { texto: ROTULO_CELULA[x], cinza: x === "NAO_PREVISTA" };
              }),
            ],
          }))}
        />
      </View>
      <Text style={s.legenda}>{LEGENDA_FICHA.join("    ")}</Text>
      <Rodape e={e} />
    </Page>
  );
}

/** O PMOC inteiro, na ordem da RF-12.2 (sem qualidade do ar, RN-013). */
export function DocumentoPmoc({ e }: { e: EntradaPdfPmoc }) {
  const { snapshot } = e;
  const blocos = blocosDeDozeMeses(snapshot.calendario);
  const { recomendacoes, anexo1 } = snapshot.textos;
  return (
    <Document
      title={`PMOC – ${snapshot.cliente.razaoSocial}`}
      author={snapshot.empresa.razaoSocial}
      creator={APP_NAME}
      producer={APP_NAME}
      creationDate={e.geradoEm}
      modificationDate={e.geradoEm}
    >
      <Capa e={e} />
      <Dados e={e} />
      <Listagem e={e} />
      <Cronograma e={e} />
      <PaginaComCabecalho e={e}>
        <Texto
          titulo="RECOMENDAÇÕES PARA FALHA E EMERGÊNCIA"
          paragrafos={recomendacoes.paragrafos}
        />
      </PaginaComCabecalho>
      <Rosto e={e} anexo="ANEXO 1" titulo={anexo1.titulo} />
      <PaginaComCabecalho e={e}>
        <Texto titulo={anexo1.titulo} paragrafos={anexo1.paragrafos} />
      </PaginaComCabecalho>
      <Rosto e={e} anexo="ANEXO 2" titulo="FICHA HISTÓRICO" />
      {snapshot.tipos.flatMap((t) =>
        t.equipamentos.flatMap((eq) =>
          blocos.map((b) => (
            <Ficha key={`${eq.id}-${b[0]?.indice}`} e={e} tipo={t} equipamento={eq} bloco={b} />
          )),
        ),
      )}
    </Document>
  );
}
