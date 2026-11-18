/**
 * Anexo 1 do PMOC: texto da Portaria MS nº 3.523/1998 (RF-12.2; DEC-19; glossário "Anexo 1").
 *
 * [A VALIDAR] RASCUNHO redigido pela IA com autorização do usuário (18/11/2026), para revisão dele
 * (PRD P3; análise C4). Corrige os erros C1 a C3 da transcrição antiga: o Art. 2º não se repete dentro
 * do Art. 6º (C1), sem o "a. a." do Art. 5º (C2), e uma nota avisa que os Anexos I e II do Regulamento
 * Técnico não são reproduzidos (C3). Os "considerandos" do preâmbulo ficam de fora.
 *
 * Texto fixo, fora de `standard_text` (o CHECK da tabela não tem código para ele). Trocar o texto =
 * mudar `VERSAO` aqui: a versão vai no retrato da emissão, junto com o texto.
 */
const VERSAO = "rascunho-1";

const TITULO = "Portaria do Ministério da Saúde nº 3.523, de 28 de agosto de 1998";

const PARAGRAFOS: readonly string[] = [
  "[A VALIDAR – transcrição em revisão] Texto dos artigos da Portaria MS nº 3.523/1998, sem o preâmbulo.",
  "Art. 1º Aprovar Regulamento Técnico contendo medidas básicas referentes aos procedimentos de verificação visual do estado de limpeza, remoção de sujidades por métodos físicos e manutenção do estado de integridade e eficiência de todos os componentes dos sistemas de climatização, para garantir a qualidade do ar de interiores e prevenção de riscos à saúde dos ocupantes de ambientes climatizados.",
  "Art. 2º Determinar que serão objeto de Regulamento Técnico a ser elaborado por este Ministério medidas específicas referentes a padrões de qualidade do ar em ambientes climatizados, no que diz respeito à definição de parâmetros físicos e composição química do ar de interiores, à identificação dos poluentes de natureza física, química e biológica, suas tolerâncias e métodos de controle, bem como pré-requisitos de projetos de instalação e de execução de sistemas de climatização.",
  "Art. 3º As medidas aprovadas por este Regulamento Técnico aplicam-se aos ambientes climatizados de uso coletivo já existentes e àqueles a serem executados e, de forma complementar, aos regidos por normas e regulamentos específicos.",
  "Art. 4º Adotar, para fins deste Regulamento Técnico, as seguintes definições:",
  "a) ambientes climatizados: ambientes submetidos ao processo de climatização;",
  "b) ar de renovação: ar externo que é introduzido no ambiente climatizado;",
  "c) ar de retorno: ar que recircula no ambiente climatizado;",
  "d) boa qualidade do ar interno: conjunto de propriedades físicas, químicas e biológicas do ar que não apresentem agravos à saúde humana;",
  "e) climatização: conjunto de processos empregados para se obter, por meio de equipamentos em recintos fechados, condições específicas de conforto e boa qualidade do ar, adequadas ao bem-estar dos ocupantes;",
  "f) manutenção: atividades técnicas e administrativas destinadas a preservar as características de desempenho técnico dos componentes ou sistemas de climatização, garantindo as condições previstas neste Regulamento Técnico;",
  "g) Síndrome dos Edifícios Doentes: surgimento de sintomas que são comuns à população em geral, mas que, numa situação temporal, podem ser relacionados a um edifício em particular. Um incremento substancial na prevalência dos níveis dos sintomas, antes relacionados, proporciona a relação entre o edifício e seus ocupantes.",
  "Art. 5º Todos os sistemas de climatização devem estar em condições adequadas de limpeza, manutenção, operação e controle, observadas as determinações abaixo relacionadas, visando à prevenção de riscos à saúde dos ocupantes:",
  "a) manter limpos os componentes do sistema de climatização, tais como bandejas, serpentinas, umidificadores, ventiladores e dutos, de forma a evitar a difusão ou multiplicação de agentes nocivos à saúde humana e manter a boa qualidade do ar interno;",
  "b) utilizar, na limpeza dos componentes do sistema de climatização, produtos biodegradáveis devidamente registrados no Ministério da Saúde para esse fim;",
  "c) verificar periodicamente as condições físicas dos filtros e providenciar a sua substituição quando necessária;",
  "d) restringir a utilização do compartimento onde está instalada a caixa de mistura do ar de retorno e ar de renovação ao uso exclusivo do sistema de climatização, sendo proibido conter no mesmo compartimento materiais, produtos ou utensílios;",
  "e) preservar a captação de ar externo livre de possíveis fontes poluentes externas que apresentem riscos à saúde humana e dotá-la, no mínimo, de filtro classe G1 (um);",
  "f) garantir a adequada renovação do ar de interior dos ambientes climatizados, ou seja, no mínimo de 27 m³/h/pessoa;",
  "g) descartar as sujidades sólidas retiradas do sistema de climatização após a limpeza, acondicionadas em sacos de material resistente e porosidade adequada, para evitar o espalhamento de partículas inaláveis.",
  "Art. 6º Os proprietários, locatários e prepostos responsáveis por sistemas de climatização com capacidade acima de 5 TR (15.000 kcal/h = 60.000 BTU/h) deverão manter um responsável técnico habilitado, com as seguintes atribuições:",
  "a) implantar e manter disponível no imóvel um Plano de Manutenção, Operação e Controle – PMOC, adotado para o sistema de climatização. Este Plano deve conter a identificação do estabelecimento que possui ambientes climatizados, a descrição das atividades a serem desenvolvidas, a periodicidade das mesmas, as recomendações a serem adotadas em situações de falha do equipamento e de emergência, para garantia de segurança do sistema de climatização, e outros de interesse, conforme especificações contidas no Anexo I deste Regulamento Técnico e na NBR 13971/97 da Associação Brasileira de Normas Técnicas – ABNT;",
  "b) garantir a aplicação do PMOC por intermédio da execução contínua, direta ou indireta, deste serviço;",
  "c) manter disponível o registro da execução dos procedimentos estabelecidos no PMOC;",
  "d) divulgar os procedimentos e resultados das atividades de manutenção, operação e controle aos ocupantes.",
  "Parágrafo único. O PMOC deverá ser implantado no prazo máximo de 180 (cento e oitenta) dias a partir da vigência deste Regulamento Técnico.",
  "Art. 7º O PMOC do sistema de climatização deve estar coerente com a legislação de Segurança e Medicina do Trabalho. Os procedimentos de manutenção, operação e controle dos sistemas de climatização e limpeza dos ambientes climatizados não devem trazer riscos à saúde dos trabalhadores que os executam, nem aos ocupantes dos ambientes climatizados.",
  "Art. 8º Os órgãos competentes de Vigilância Sanitária farão cumprir este Regulamento Técnico, mediante a realização de inspeções e de outras ações pertinentes, com o apoio de órgãos governamentais, organismos representativos da comunidade e ocupantes dos ambientes climatizados.",
  "Art. 9º O não cumprimento deste Regulamento Técnico configura infração sanitária, sujeitando o proprietário ou locatário do imóvel ou preposto, bem como o responsável técnico, quando exigido, às penalidades previstas na Lei nº 6.437, de 20 de agosto de 1977, sem prejuízo de outras penalidades previstas em legislação específica.",
  "Art. 10. Esta Portaria entra em vigor na data de sua publicação.",
  "Nota: os Anexos I e II do Regulamento Técnico, citados no texto da Portaria, não são reproduzidos neste documento.",
];

/** Anexo 1 como entra no retrato da emissão (`textos.anexo1`). */
export const ANEXO1 = { versao: VERSAO, titulo: TITULO, paragrafos: PARAGRAFOS } as const;
