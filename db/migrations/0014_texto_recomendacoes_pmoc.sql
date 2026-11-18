-- Etapa 4 – texto padrão RECOMENDACOES_PMOC, versão 1 (03 §2.11 `standard_text`; AF-16; RF-12 regra 2).
-- Texto PROVISÓRIO: o conteúdo definitivo será escrito pelo usuário (DEC-19; PRD §10 P2 [A VALIDAR]) e
-- entrará como versão 2 numa nova migração de dados (a tabela é só de inclusão, bloco [I]). Nada aqui é
-- regra normativa: o texto só marca o lugar da seção no PDF.
-- O trigger de auditoria exige contexto (aviso no topo de 0006_triggers.sql).
SELECT set_config('app.source', 'SISTEMA', true);

INSERT INTO standard_text (code, version, body) VALUES (
  'RECOMENDACOES_PMOC',
  1,
  '[A VALIDAR – texto provisório] As recomendações a serem adotadas em situações de falha do equipamento e de emergência serão definidas pela empresa executora e substituirão este texto.'
);
