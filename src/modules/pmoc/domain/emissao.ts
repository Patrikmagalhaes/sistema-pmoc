/**
 * Pré-condições da emissão do PMOC (RN-007 (a)–(g), RN-008, RN-017; CA-12.1; E-08.3 a E-08.5, E-08.9,
 * E-08.10). Sem banco: recebe o retrato lido na transação e devolve **todos** os faltantes de uma vez.
 *
 * RN-007 (d) "cliente, local e contrato com todos os obrigatórios": os obrigatórios desses cadastros
 * são `NOT NULL`/`CHECK` no banco (03 §2.2), então registro vivo já está completo. A ART (e) também é
 * `NOT NULL` desde a decisão B8 (RN-176); a checagem aqui fica como garantia redundante (RN-007 nota).
 */

export type CodigoPendencia =
  | "EMPRESA"
  | "RT"
  | "CERTIFICADO_AUSENTE"
  | "CERTIFICADO_VENCIDO"
  | "CERTIFICADO_A3"
  | "CONTRATO_ENCERRADO"
  | "ART"
  | "SEM_EQUIPAMENTO"
  | "PLANO_VAZIO";

/** Onde corrigir (link da TL-121, E-08.3). */
export type DestinoPendencia = "EMPRESA" | "CONTRATO" | "EQUIPAMENTOS" | "PLANO";

export interface Pendencia {
  codigo: CodigoPendencia;
  mensagem: string;
  destino: DestinoPendencia;
}

export type EstadoCertificadoEmissao = "VALIDO" | "A_VENCER" | "VENCIDO";

export interface RetratoParaEmissao {
  empresaCadastrada: boolean;
  rtCadastrado: boolean;
  /**
   * Certificado vigente do RT (`is_current`, vivo), ou `null`. `estado` e `dias` vêm do módulo
   * `empresa` (RN-153), para não duplicar o cálculo.
   */
  certificado: { tipo: "A1" | "A3"; estado: EstadoCertificadoEmissao; dias: number } | null;
  art: string | null;
  situacaoContrato: "A_INICIAR" | "VIGENTE" | "ENCERRADO" | "CANCELADO";
  equipamentosAtivos: number;
  atividadesNoPlano: number;
}

export interface VerificacaoPura {
  pendencias: Pendencia[];
  /** E-08.9: só com certificado A1 `A_VENCER` (emite normalmente, com aviso). */
  certificadoVenceEmDias: number | null;
}

/** Ordem da lista = ordem da RN-007, com RN-008 junto de (c) e RN-017 junto do contrato. */
export function verificarPreCondicoes(r: RetratoParaEmissao): VerificacaoPura {
  const p: Pendencia[] = [];
  const c = r.certificado;
  if (!r.empresaCadastrada) {
    p.push({ codigo: "EMPRESA", mensagem: "Dados da empresa executora", destino: "EMPRESA" });
  }
  if (!r.rtCadastrado) {
    p.push({ codigo: "RT", mensagem: "Dados do responsável técnico", destino: "EMPRESA" });
  }
  if (!c) {
    p.push({
      codigo: "CERTIFICADO_AUSENTE",
      mensagem: "Certificado do RT não enviado",
      destino: "EMPRESA",
    });
  } else if (c.tipo !== "A1") {
    // E-08.10: A3 fica fora da emissão automática do MVP (RF-13.3).
    p.push({
      codigo: "CERTIFICADO_A3",
      mensagem: "Certificado do RT é A3: a emissão automática exige certificado A1",
      destino: "EMPRESA",
    });
  } else if (c.estado === "VENCIDO") {
    p.push({
      codigo: "CERTIFICADO_VENCIDO",
      mensagem: "Certificado do RT vencido",
      destino: "EMPRESA",
    });
  }
  if (r.situacaoContrato === "ENCERRADO" || r.situacaoContrato === "CANCELADO") {
    p.push({
      codigo: "CONTRATO_ENCERRADO",
      mensagem: "Contrato encerrado não emite PMOC.",
      destino: "CONTRATO",
    });
  }
  if (!r.art?.trim()) {
    p.push({ codigo: "ART", mensagem: "Nº de ART do contrato", destino: "CONTRATO" });
  }
  if (r.equipamentosAtivos < 1) {
    p.push({
      codigo: "SEM_EQUIPAMENTO",
      mensagem: "Ao menos 1 equipamento ativo",
      destino: "EQUIPAMENTOS",
    });
  }
  if (r.atividadesNoPlano < 1) {
    p.push({ codigo: "PLANO_VAZIO", mensagem: "Ao menos 1 atividade no plano", destino: "PLANO" });
  }
  const aviso = c?.tipo === "A1" && c.estado === "A_VENCER" ? c.dias : null;
  return { pendencias: p, certificadoVenceEmDias: aviso };
}
