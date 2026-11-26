/**
 * FL-09 passo 4 (D-07 a): o plano mudou depois da emissão da versão atual? Compara o que o cronograma
 * usa (atividades com a periodicidade e equipamentos `ATIVO`, RN-015) com o retrato da versão
 * (`pmoc_version.snapshot`). Voltar ao que estava no PDF apaga a faixa. Mudança de dado descritivo do
 * equipamento (TAG, ambiente) não conta: não muda o cronograma (inferido de RN-015 [A VALIDAR]).
 */
export interface PlanoComparavel {
  /** `{id da atividade do plano}:{periodicidade}`, só dos tipos presentes (como o retrato). */
  atividades: readonly string[];
  equipamentos: readonly string[];
}

const mesmoConjunto = (a: readonly string[], b: readonly string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

export function planoAlteradoDesdeAVersao(
  retrato: PlanoComparavel,
  atual: PlanoComparavel,
): boolean {
  return (
    !mesmoConjunto(retrato.atividades, atual.atividades) ||
    !mesmoConjunto(retrato.equipamentos, atual.equipamentos)
  );
}

/** O plano de hoje no formato do retrato: atividades não removidas dos tipos com equipamento ativo. */
export function planoComparavel(
  plano: readonly { id: string; tipoId: string; periodicidade: string; removida: boolean }[],
  ativos: readonly { id: string; tipoId: string }[],
): PlanoComparavel {
  const presentes = new Set(ativos.map((e) => e.tipoId));
  return {
    atividades: plano
      .filter((a) => !a.removida && presentes.has(a.tipoId))
      .map((a) => `${a.id}:${a.periodicidade}`),
    equipamentos: ativos.map((e) => e.id),
  };
}
