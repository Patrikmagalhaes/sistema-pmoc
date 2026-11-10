# 02 – Regras de negócio do Sistema PMOC

> **Versão:** 1.2 – 27/10/2026 (decisões da auditoria final AF-01 a AF-20 incorporadas: `docs/auditoria-final.md` §5; ver §11)
> **Base:** `docs/00-escopo-prd.md` (RF-xx, RNF-xx, DEC-33 a DEC-42, pendências P1–P7 e Q1–Q9) e `pmoc/01-analise-pmocs-existentes.md` (DEC-01 a DEC-32, §9).
> **Leitor principal:** IA de código. Cada regra tem ID `RN-xxx`; use o ID em testes, commits e mensagens de erro.
> **Prioridade:** se esta lista e o PRD divergirem, vale a decisão `DEC-xx` citada. Nenhuma regra aqui altera uma DEC.

## Convenções

| Item | Significado |
|---|---|
| Formato da regra | `SE [condição] ENTÃO [resultado]`. Condições ligadas por **E** / **OU** em maiúsculas. |
| Origem `Norma` | Texto da Portaria MS 3.523/1998 **como transcrito no Anexo 1 dos PMOCs de referência**. A fidelidade dessa transcrição ao texto oficial é [A VALIDAR] (análise C4, PRD P3). Lei 13.589/2018, RE 09/2003 e NBR 13971 **não são citadas** como origem porque o conteúdo delas não está nos arquivos; a Lei 13.589/2018 é só referência normativa e não fonte automática de regra do sistema (decisão C12, 21/10/2026). |
| Origem `Meu PMOC` | Observado nos 4 PDFs de referência (análise §0 a §7). |
| Origem `Requisito do cliente` | Decisão ou requisito do usuário: `DEC-xx`, ou `RF-xx`/`RNF-xx` do PRD que se apoia em DEC. |
| **(inferido)** | Dedução a partir da origem citada; não foi dito literalmente. |
| **[A VALIDAR]** | Proposta sem fonte. Implementar como descrito, mas isolado e fácil de mudar (configuração ou função única). |
| `D-xx` | Decisão pendente listada na §10.1. A regra já está escrita com a **proposta recomendada**. |
| Datas de negócio | Sempre no fuso `America/Sao_Paulo` (RNF-12). "Hoje" = data atual nesse fuso. |
| Ordem de serviço (OS) | Neste sistema, **OS = Visita** (entidade do PRD, RF-17 a RF-23). Ver D-01. |

### Enumerações usadas

| Entidade | Valores |
|---|---|
| Perfil de usuário | `ADM`, `TECNICO`, `CLIENTE` |
| Periodicidade | `MM`=1, `MB`=2, `MT`=3, `MS`=6, `MA`=12 (intervalo `k` em meses) |
| Natureza da atividade | `VERIFICACAO`, `MEDICAO` |
| Contrato | `A_INICIAR`, `VIGENTE`, `ENCERRADO`, `CANCELADO` (D-08) |
| PMOC | `RASCUNHO`, `EMITIDO`, `ASSINADO_CLIENTE`, `HISTORICO` |
| Ocorrência | `NAO_PREVISTA` (Ø), `PREVISTA`, `PENDENTE`, `OK`, `NOK` (`NOK` = atividade **não efetuada**, decisão F1; ver D-05; atividade executada com problema = `OK` + marca "requer corretiva", RN-193) |
| Visita (OS) | `A_AGENDAR`, `AGENDADA`, `EM_ANDAMENTO`, `REGISTRADA`, `CANCELADA` |
| Relatório | `RASCUNHO` (inferido), `AGUARDANDO_ASSINATURA`, `ASSINADO_CLIENTE` |
| Equipamento, tipo, atividade, usuário | `ATIVO`, `INATIVO` |
| Certificado do RT (derivado) | `VALIDO`, `A_VENCER`, `VENCIDO` |
| Notificação | `NAO_LIDA`, `LIDA` |

---

## 1. Geração e vigência do PMOC

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-001 | SE o ADM cria o PMOC de um contrato E o contrato já tem PMOC ENTÃO o sistema bloqueia (um contrato tem exatamente um PMOC; mudanças posteriores geram **versões** do mesmo PMOC, RN-015). | Requisito do cliente — DEC-06; PRD glossário "PMOC", RF-15 (ver D-02) | — |
| RN-002 | SE o PMOC é criado ENTÃO o sistema copia, para cada tipo de equipamento com ao menos um equipamento `ATIVO` no local, todas as atividades `ATIVO` da biblioteca, com a periodicidade padrão de cada uma. | Requisito do cliente — DEC-08; RF-10.1 | Atividade removida ou incluída no plano pelo ADM: RF-10.3 [A VALIDAR]. |
| RN-003 | SE o ADM altera a biblioteca (tipo, atividade ou periodicidade padrão) ENTÃO nenhum PMOC já criado muda. | Requisito do cliente — DEC-07, DEC-08; RF-08.5, CA-08.3 | — |
| RN-004 | SE o contrato é de um local que já teve contrato anterior ENTÃO o ADM pode copiar plano e periodicidades do PMOC anterior como ponto de partida. | Requisito do cliente (inferido) — RF-15.2 | A cópia nunca traz ocorrências, registros, visitas ou assinaturas. |
| RN-005 | SE o PMOC é exibido ou impresso ENTÃO a vigência mostrada é a data de início e a data de fim do **contrato**. O PMOC não tem data de validade própria. | Requisito do cliente — DEC-06 | — |
| RN-006 | SE o PMOC está em `RASCUNHO` E o plano, as periodicidades ou os equipamentos mudam ENTÃO o sistema recalcula o cronograma inteiro (nenhuma ocorrência tem registro ainda). | Requisito do cliente (inferido) — RF-10, RF-11 | — |
| RN-007 | SE o ADM pede a emissão E falta qualquer pré-condição ENTÃO o sistema bloqueia e lista **todos** os itens faltantes. Pré-condições: (a) empresa executora completa; (b) RT completo; (c) certificado do RT `VALIDO` ou `A_VENCER`; (d) cliente, local e contrato com todos os obrigatórios; (e) nº de ART preenchido; (f) ≥ 1 equipamento `ATIVO` no local; (g) plano com ≥ 1 atividade. | Requisito do cliente — DEC-17, DEC-26, DEC-28; RF-12.1, CA-12.1 | (e): a ART passou a ser exigida ao salvar o contrato (RN-176, decisão B8); a checagem aqui é redundante e fica como garantia. |
| RN-008 | SE o certificado do RT está `VENCIDO` ENTÃO a emissão é bloqueada com a mensagem "certificado do RT vencido". | Requisito do cliente — DEC-23; CA-04.2 | Certificado A3 (assinatura fora do sistema): RF-13.3 [A VALIDAR], P4. |
| RN-009 | SE a emissão é concluída ENTÃO, nesta ordem e na mesma transação: (1) gera o PDF; (2) aplica a assinatura do RT (RN-120); (3) PMOC → `EMITIDO`; (4) congela o cronograma como base das ocorrências; (5) gera as visitas `A_AGENDAR` (RN-060); (6) notifica os usuários do cliente (RN-101). | Requisito do cliente — DEC-23; RF-12, RF-13, RF-17, RF-19 | Falha em qualquer passo desfaz todos (nada fica meio emitido) (inferido). Emissão **síncrona** (decisão A2): sem estado "emitindo" nem job; meta de 15 min, dimensionada para **200 equipamentos** (decisão R2 1.4; o maior cliente atual tem ~50), vs. limite de 800 s da função da Vercel: atender os 15 min significa terminar dentro de 800 s, medido no spike S-01 antes da etapa de emissão (AF-11). |
| RN-010 | SE o contrato tem código TH E revisão ENTÃO capa e rodapé imprimem `{TH}-{revisão}` (ex.: `TH12326-R1`). SE tem só TH ENTÃO imprime só o TH. SE não tem TH ENTÃO não imprime nada no lugar. | Requisito do cliente — DEC-02, DEC-21; RF-12.3 | Revisão sem TH: não imprimir [A VALIDAR]. |
| RN-011 | SE o PMOC é gerado ENTÃO a capa mostra a cidade da empresa executora e a data de início da vigência por extenso (ex.: "São José, 1 de abril de 2025"). | Meu PMOC (inferido) — análise §1.3, igual nos 4 PDFs | — |
| RN-012 | SE o PMOC é gerado ENTÃO contém, no mínimo: identificação do estabelecimento, atividades, periodicidade de cada atividade e recomendações para falha e emergência. | Norma — Portaria 3.523/1998, Art. 6º, alínea "a" (texto do Anexo 1); Requisito do cliente — DEC-19 | Texto das recomendações: P2 [A VALIDAR]. |
| RN-013 | SE o PMOC é gerado ENTÃO segue a ordem de seções de RF-12.2 e **não** inclui seção de qualidade do ar. | Requisito do cliente — DEC-13, DEC-19; RF-12.2, RF-12.4 | — |
| RN-014 | SE a data de fim do contrato passou OU o contrato foi `CANCELADO` ENTÃO o PMOC → `HISTORICO` (somente leitura; download continua disponível para ADM e cliente). | Requisito do cliente — DEC-06; RF-12.7, CA-15.1 | Renovação (C10, 21/10/2026; decisão R2 2.1): o PMOC anterior vira `HISTORICO` **imediatamente após o ADM acionar "Confirmar renovação"** (RN-192), sem esperar a data de fim. PMOC em `RASCUNHO` também vira `HISTORICO` (A5); esse histórico, por nunca ter sido emitido, **não** aparece para cliente nem técnico (RN-147; decisão R2 2.4). |
| RN-015 | SE, após a emissão, mudam periodicidades ou equipamentos ENTÃO o PDF assinado não muda; o plano, o cronograma e a ficha são atualizados (RN-032, RN-065); o ADM decide se emite **nova versão**. | Requisito do cliente — RNF-15; PRD Q5 [A VALIDAR] (ver D-07) | — |
| RN-016 | SE o ADM emite nova versão ENTÃO o sistema cria a versão `n+1` com novo PDF, nova assinatura do RT, estado `EMITIDO` (volta a aguardar assinatura do cliente) e mantém as versões anteriores para download. O campo revisão `R{n}` do contrato **não** é incrementado automaticamente. | Requisito do cliente — DEC-21, RNF-15 | — |
| RN-017 | SE o contrato está `ENCERRADO` ou `CANCELADO` ENTÃO o ADM não pode emitir PMOC nem nova versão. | [A VALIDAR] | Download da "ficha atualizada" (RN-131) continua permitido. |

---

## 2. Cálculo de periodicidades e vencimentos

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-020 | SE uma atividade recebe periodicidade ENTÃO o valor é um de `MM`, `MB`, `MT`, `MS`, `MA`, com intervalo `k` = 1, 2, 3, 6, 12 meses. | Requisito do cliente — DEC-04 | — |
| RN-021 | SE o contrato começa em uma data qualquer do mês ENTÃO o **mês 1** é o mês de calendário dessa data (ex.: início 14/08/2026 → mês 1 = ago/2026). | Requisito do cliente — DEC-05; RF-11.1 | — |
| RN-022 | SE é preciso saber quantos meses o contrato tem ENTÃO `N = (anoFim − anoIni) × 12 + (mêsFim − mêsIni) + 1`, contando o mês de início e o mês da data de fim, mesmo que parciais. | Requisito do cliente (inferido) — DEC-22, RF-11.1 (ver D-03) | — |
| RN-023 | SE `m` é um mês do contrato (1 ≤ m ≤ N) E `(m − 1) mod k = 0` ENTÃO a ocorrência equipamento × atividade × m é `PREVISTA`; SENÃO é `NAO_PREVISTA` (Ø). | Requisito do cliente — DEC-05, DEC-22; §9.3 | — |
| RN-024 | SE `k ≥ N` ENTÃO a atividade é prevista só no mês 1 (ex.: `MA` em contrato de 11 meses). | Requisito do cliente (inferido) — DEC-05 | — |
| RN-025 | SE o contrato tem 12 meses ENTÃO os meses previstos são: `MM` 1–12; `MB` 1, 3, 5, 7, 9, 11; `MT` 1, 4, 7, 10; `MS` 1, 7; `MA` 1. Contrato de 18 meses: `MS` 1, 7, 13; `MA` 1, 13. | Requisito do cliente — DEC-05; análise §4.7; CA-11.1, CA-11.2 | Usar como casos de teste. |
| RN-026 | SE o ADM altera a periodicidade de uma atividade no PMOC ENTÃO ela vale para **todos** os equipamentos daquele tipo naquele PMOC. Não existe periodicidade por equipamento individual. | Requisito do cliente — DEC-07; RF-10.2 | — |
| RN-027 | SE a mesma atividade (mesmo título) existe em dois tipos ENTÃO cada tipo tem periodicidade própria e independente. | Meu PMOC — análise A6 (Split CSL × PBS); Requisito do cliente — DEC-07 | — |
| RN-028 | SE uma ocorrência é prevista no mês `m` ENTÃO o **vencimento** dela é o último dia de calendário do mês `m`. | Requisito do cliente (inferido) — DEC-25 | — |
| RN-029 | SE a ocorrência está `PREVISTA` E hoje ≥ dia seguinte ao vencimento E não há registro finalizado ENTÃO ela passa a `PENDENTE`. Processamento diário às 00:05 `America/Sao_Paulo` (decisão C1). | Requisito do cliente — DEC-25; RF-11.4, RNF-12 | — |
| RN-030 | SE a ocorrência está `PENDENTE` ENTÃO ela **nunca** vira `NOK` sem ação humana (técnico ao finalizar a visita, RN-086, ou ADM, RN-091). | Requisito do cliente — DEC-12; RF-11.5, CA-11.3 | — |
| RN-031 | SE uma ocorrência é registrada depois do mês previsto ENTÃO continua pertencendo ao mês previsto; a data real de execução fica no registro. | Requisito do cliente (inferido) — RF-11.7; PRD Q7 | — |
| RN-032 | SE o ADM altera a periodicidade com o PMOC `EMITIDO` ou `ASSINADO_CLIENTE` ENTÃO o sistema recalcula só as ocorrências de meses **posteriores ao mês corrente** que não têm registro; ocorrências `OK`, `NOK` e `PENDENTE` não mudam; a alteração vai para a auditoria (usuário, data/hora, valor anterior, valor novo). | Requisito do cliente (inferido) — RF-10.4, CA-10.2 | Incluir o mês corrente no recálculo [A VALIDAR]. |

---

## 3. Classificação de equipamentos

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-040 | SE o ADM cadastra um tipo de equipamento ENTÃO exige nome, **sigla única** (letras maiúsculas, usada na TAG) e ≥ 1 grupo permitido (ex.: Split → Hi-Wall, Piso-Teto, Cassete). | Requisito do cliente — DEC-08, DEC-26; RF-08.1; Meu PMOC — análise §3.3 | Formato e tamanho da sigla [A VALIDAR]. |
| RN-041 | SE o ADM cadastra um equipamento ENTÃO o grupo deve ser um dos grupos permitidos do tipo escolhido. | Requisito do cliente (inferido) — RF-08.1 | — |
| RN-042 | SE uma atividade tem natureza `MEDICAO` ENTÃO a unidade é obrigatória (ex.: `V`, `A`, `psi`); SE é `VERIFICACAO` ENTÃO não tem unidade. | Requisito do cliente — DEC-10, DEC-30; CA-08.1 | — |
| RN-043 | SE uma atividade é cadastrada ENTÃO tem só título, periodicidade padrão, natureza, unidade e ordem de exibição. Sem procedimento e sem faixa de aceitação. | Requisito do cliente — DEC-10, DEC-27 | — |
| RN-044 | SE o ADM exclui um tipo ou atividade já usado em algum PMOC ENTÃO ele vira `INATIVO`: some da biblioteca para novos PMOCs e continua íntegro nos PMOCs existentes. | Requisito do cliente — DEC-08; RF-08.4, CA-08.2 | Tipo ou atividade nunca usado pode ser excluído de fato (inferido). |
| RN-045 | SE o ADM salva um equipamento ENTÃO tipo, grupo e ambiente/localização interna são obrigatórios; marca, modelo, série e capacidade são opcionais. | Requisito do cliente — DEC-18, DEC-26; RF-09.2, CA-09.3 | — |
| RN-046 | SE um equipamento é criado ENTÃO a TAG é gerada como `{código do local}-{sigla do tipo}-{sequencial de 3 dígitos}`; o sequencial é por local + tipo, começa em `001`, é imutável e **nunca** reutilizado (inclusive após inativação). | Requisito do cliente — DEC-26; RF-09.4, CA-09.1, CA-09.2 | Sequencial acima de 999 [A VALIDAR]. |
| RN-047 | SE o local já tem código ENTÃO o código não pode ser alterado. | Requisito do cliente — DEC-26; RF-06.3, CA-06.2 | Regra de geração do código [A VALIDAR]. |
| RN-048 | SE o equipamento tem qualquer ocorrência com registro ENTÃO não pode ser excluído, só `INATIVO`. | Requisito do cliente — RF-09.5 | Sem histórico: exclusão permitida (inferido). |
| RN-049 | SE o equipamento tem qualquer ocorrência com registro ENTÃO o tipo dele não pode ser alterado (a TAG depende da sigla); para mudar, inativar e cadastrar outro. | [A VALIDAR] | — |
| RN-050 | SE a seção 5 do PMOC é gerada ENTÃO agrupa equipamentos `ATIVO` por tipo + grupo, mostra quantidade em número e por extenso com concordância (ex.: "1 (um) Split", "2 (dois) Splits") e lista as TAGs. Nunca repete o rótulo (proibido "tipo Tipo Janela"). | Requisito do cliente — DEC-18, RNF-07; Meu PMOC — análise §3.1, B12, B13 | Forma plural dos nomes de tipo [A VALIDAR]. |
| RN-051 | SE o cronograma (seção 6) ou a ficha histórico é gerada ENTÃO há uma tabela por tipo presente, e as atividades seguem a mesma ordem para todos os equipamentos do tipo: periodicidade (`MM`→`MA`) e, dentro dela, a ordem de exibição cadastrada. | Meu PMOC — análise §1.4, A10; Requisito do cliente — RF-08.2 | — |
| RN-052 | SE a capacidade é informada ENTÃO é número + unidade; unidade padrão `BTU/h`. | [A VALIDAR] — RF-09.3; Meu PMOC — análise A9 | — |
| RN-053 | SE o PMOC é gerado ENTÃO sempre inclui os dados do RT, sem calcular a capacidade total do sistema. (A Portaria exige RT para capacidade acima de 5 TR / 60.000 BTU/h; a empresa sempre tem RT.) | Norma — Portaria 3.523/1998, Art. 6º, caput (texto do Anexo 1); Requisito do cliente — DEC-14, DEC-16 | — |
| RN-054 | SE o técnico encontra em campo equipamento não cadastrado ENTÃO registra na observação; só o ADM cadastra. | [A VALIDAR] — PRD Q9 | — |

---

## 4. Geração automática de ordens de serviço (visitas)

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-060 | SE o PMOC passa a `EMITIDO` pela primeira vez ENTÃO, para cada mês `m` do contrato com ≥ 1 ocorrência `PREVISTA`, o sistema cria **uma** visita `A_AGENDAR` com mês de referência `m`, o local e todas as ocorrências do mês `m`. | Requisito do cliente (inferido) — DEC-35; RF-17.1 [A VALIDAR] (ver D-04) | Não espera a assinatura do cliente no PMOC (D-04). |
| RN-061 | SE uma ocorrência está vinculada a uma visita não `CANCELADA` ENTÃO não pode estar em outra visita não `CANCELADA` ao mesmo tempo. | Requisito do cliente — CA-17.2 | — |
| RN-062 | SE o ADM divide uma visita ENTÃO cada ocorrência da visita original fica em exatamente uma das visitas resultantes, todas com o mesmo mês de referência. | [A VALIDAR] — RF-17.2, CA-17.2 | Só visitas `A_AGENDAR` ou `AGENDADA`. |
| RN-063 | SE o ADM cria visita avulsa ENTÃO ela tem mês de referência e só pode receber ocorrências desse mês que não estejam em outra visita ativa. | [A VALIDAR] — RF-17.3 | Ocorrências `PENDENTE` de meses anteriores: RN-064. |
| RN-064 | SE existe ocorrência `PENDENTE` E o ADM a inclui em uma visita posterior não iniciada ENTÃO a ocorrência sai da visita anterior (se houver) e entra na nova, mas continua pertencendo ao mês previsto original (RN-031). | [A VALIDAR] (ver D-06) | — |
| RN-065 | SE, após a emissão, mudam periodicidades ou equipamentos ENTÃO o sistema atualiza só visitas `A_AGENDAR` e `AGENDADA`: inclui ocorrências novas na visita do mês (cria visita `A_AGENDAR` se não houver) e retira as que deixaram de existir. SE a visita fica sem ocorrências ENTÃO: `A_AGENDAR` é excluída; `AGENDADA` vai para `CANCELADA` com notificação (RN-102). | Requisito do cliente (inferido) — RF-10.4, RF-17 | — |
| RN-066 | SE a visita está `EM_ANDAMENTO` ou `REGISTRADA` ENTÃO nenhum recálculo automático altera suas ocorrências. | Requisito do cliente (inferido) — RF-10.4 | Correção manual do ADM (RN-090). |
| RN-067 | SE um equipamento é incluído no local com PMOC emitido ENTÃO as ocorrências dele são geradas a partir do mês seguinte ao mês corrente e entram nas visitas não iniciadas desses meses (RN-065). | [A VALIDAR] — PRD Q5 | — |
| RN-068 | SE um equipamento é inativado com PMOC emitido ENTÃO as ocorrências dele **sem registro** de meses posteriores ao mês corrente deixam de existir (viram Ø) e saem das visitas não iniciadas; o histórico até a inativação permanece. | [A VALIDAR] — PRD Q5 | Ocorrências `PENDENTE` continuam até o ADM resolver (RN-091). |
| RN-069 | SE o ADM informa data e técnico em uma visita `A_AGENDAR` ENTÃO ela vai para `AGENDADA`. Data e técnico são obrigatórios; horário é opcional. | Requisito do cliente — DEC-35; RF-18.1 | Horário opcional [A VALIDAR]. |
| RN-070 | SE a visita está `A_AGENDAR` ou `AGENDADA` ENTÃO o ADM pode mudar data, horário, técnico ou cancelar, sem limite de vezes; cada mudança grava campo, valor anterior, valor novo, usuário, data/hora e motivo **opcional** (decisão R2 2.5: o motivo não é obrigatório na agenda nem nas correções do ADM; reverte C8 nesses pontos). | Requisito do cliente — DEC-35; RF-18.2, RF-18.3 | Na agenda, nas correções e nos cancelamentos, o único motivo obrigatório é o do cancelamento de contrato (RN-144); a redefinição do segundo fator por outro ADM mantém o motivo (RN-194, ação de segurança). |
| RN-071 | SE a visita está `EM_ANDAMENTO` ENTÃO o ADM não pode trocar o técnico nem a data. | [A VALIDAR] — CA-18.2 | — |
| RN-072 | SE a data agendada está fora do mês de referência ENTÃO o sistema permite, mostra aviso ao ADM e a visita continua no mês de referência. | Requisito do cliente — DEC-35; RF-18.4, CA-18.3, PRD Q7 | — |
| RN-073 | SE o ADM escolhe um técnico ENTÃO só usuários `TECNICO` `ATIVO` aparecem. | Requisito do cliente (inferido) — RF-02 | — |
| RN-074 | SE um técnico é inativado E tem visitas `AGENDADA` ou `EM_ANDAMENTO` ENTÃO o sistema lista essas visitas para o ADM reatribuir; as visitas não mudam de estado sozinhas. | Requisito do cliente — CA-02.4 | — |
| RN-075 | SE a visita é `CANCELADA` ENTÃO suas ocorrências ficam sem visita e seguem o fluxo normal (`PREVISTA` → `PENDENTE`); podem ser incluídas em outra visita. | Requisito do cliente — RF-18.5 | — |
| RN-076 | SE o contrato é `CANCELADO` ENTÃO todas as visitas `A_AGENDAR` e `AGENDADA` com mês de referência após a data de cancelamento vão para `CANCELADA`. | [A VALIDAR] (ver D-08) | — |
| RN-077 | SE uma ocorrência é `NOK` ENTÃO o sistema **não** gera OS de corretiva; a necessidade aparece só no relatório (o mesmo vale para a marca "requer corretiva", RN-193). | Requisito do cliente — DEC-11 | A necessidade de corretiva de uma atividade **executada com problema** é registrada pela marca "requer corretiva" (RN-193; decisão R2 1.3); NOK = "não efetuado" (decisão F1). DEC-11 emendada em 27/10/2026 (AF-13): OK = preventiva executada; a corretiva quem decide é o cliente. |

---

## 5. Registro da execução (base para status e alertas)

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-080 | SE o técnico atribuído inicia uma visita `AGENDADA` ENTÃO ela vai para `EM_ANDAMENTO` e grava data/hora de início. | Requisito do cliente — DEC-09; RF-21.1 | Iniciar antes da data agendada: permitido [A VALIDAR]. |
| RN-081 | SE a visita está `EM_ANDAMENTO` ENTÃO cada ocorrência dela recebe `OK` ou `NOK`. | Requisito do cliente — DEC-09; RF-21.2 | `OK` pode levar a marca "requer corretiva" (RN-193). |
| RN-082 | SE a atividade é `MEDICAO` E a marcação é `OK` ENTÃO valor numérico é obrigatório, gravado com a unidade do plano. SE a marcação é `NOK` ENTÃO o valor é opcional. | Requisito do cliente — DEC-10, DEC-30; RF-21.3, CA-21.1 | — |
| RN-083 | SE a marcação é `NOK` ENTÃO observação é obrigatória. | Requisito do cliente — DEC-11; CA-11.4, CA-21.2 | — |
| RN-084 | SE o técnico preenche dados antes de finalizar ENTÃO são rascunho salvo a cada alteração e **não** mudam o estado da ocorrência. | Requisito do cliente — DEC-37; RF-21.7, RF-23.2 (inferido) | — |
| RN-085 | SE alguma ocorrência da visita está sem marcação ou sem dado obrigatório (valor de medição RN-082, observação RN-083 e da marca "requer corretiva" RN-193, foto exigida pela atividade RN-185) ENTÃO o botão finalizar fica bloqueado e indica o que falta. | Requisito do cliente — RF-23.1, CA-23.1 | — |
| RN-086 | SE o técnico finaliza a visita ENTÃO: grava data/hora de fim e técnico executor; cada ocorrência vai para `OK` ou `NOK` conforme marcado (inclusive as que já estavam `PENDENTE`); visita → `REGISTRADA`; abre a geração do relatório. | Requisito do cliente — DEC-09; RF-23.2; RF-11.7 (inferido para `PENDENTE`) | — |
| RN-087 | SE a visita está `REGISTRADA` ENTÃO o técnico não altera registros; só o ADM corrige. | [A VALIDAR] — RF-23.3 | — |
| RN-088 | SE o técnico registra a visita ENTÃO não pode incluir atividade fora do plano; usa a observação. | [A VALIDAR] — RF-21.6 | — |
| RN-089 | SE o técnico perde a conexão durante o registro ENTÃO nada do que foi digitado ou fotografado se perde e o envio é refeito ao reconectar (nível 1). | Requisito do cliente — DEC-37; RNF-03, CA-22.1 | Visita inteira offline: Fase 2. |
| RN-090 | SE o ADM usa o painel ENTÃO pode, em qualquer visita não `CANCELADA`, preencher ou corrigir marcações, medições, observações e fotos, definir data de execução e técnico executor e finalizar a visita (mesmas validações RN-082, RN-083, RN-085). | Requisito do cliente — DEC-12, DEC-42; RF-29.1 | — |
| RN-091 | SE uma ocorrência está `PENDENTE` ENTÃO só o ADM resolve: `OK` (data de execução obrigatória) ou `NOK` (observação obrigatória). Resolução em lote para ocorrências da mesma visita/mês. O ADM também decide **dispensar** ou **cancelar** a pendência (decisões B9 e R2 2.2): **dispensar** = `NOK` com observação obrigatória (mesmo estado e mesma origem `RESOLUCAO_PENDENCIA` de resolver como `NOK`); **cancelar** = `NAO_PREVISTA` com `unscheduled_reason = PENDENCIA_CANCELADA` (AF-02), observação opcional; a ficha mostra Ø. Ambas ficam no `audit_log`. | Requisito do cliente — DEC-12; RF-30, CA-30.1 | Lote [A VALIDAR]. |
| RN-092 | SE o ADM muda qualquer registro ENTÃO grava auditoria (usuário, data/hora, entidade, campo, valor anterior, valor novo), que não pode ser editada nem apagada pela aplicação. | Requisito do cliente — RF-31, RNF-06; análise §9.4 (inferido) | — |
| RN-093 | SE a ocorrência é registrada ENTÃO fica disponível para consulta e para a ficha histórico enquanto o sistema existir (registro da execução mantido disponível). | Norma — Portaria 3.523/1998, Art. 6º, alínea "c" (texto do Anexo 1); Requisito do cliente — RF-16 | Prazo de retenção [A VALIDAR – advogado] (RNF-05). Política de retenção: RN-191. |

---

## 6. Alertas

Dois canais: **notificação dentro do app** (empurrada a usuários) e **painel de pendências do ADM** (lista consultada). Nenhum outro canal.

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-100 | SE qualquer alerta é gerado ENTÃO é entregue **somente** dentro do app. Nunca e-mail, WhatsApp ou SMS. | Requisito do cliente — DEC-40; CA-19.2 | Decisão B4 a (21/10/2026): RN-100 vale só para notificações de negócio ao cliente; recuperação de senha, e-mails de segurança da conta e e-mails ao operador são exceção e não são alerta (RF-01.2; doc 06 SEG-19, ARQ-15). |
| RN-101 | SE o PMOC (ou nova versão) vai para `EMITIDO` ENTÃO notifica todos os usuários `ATIVO` do cliente: "PMOC aguardando assinatura". | Requisito do cliente — DEC-20; RF-19 | — |
| RN-102 | SE a visita é agendada, remarcada (data ou horário) ou cancelada ENTÃO notifica o técnico atribuído e todos os usuários `ATIVO` do cliente, com data antiga e nova quando houver. | Requisito do cliente — DEC-35, DEC-40; RF-19, CA-19.1 | — |
| RN-103 | SE o técnico é trocado ENTÃO notifica o técnico anterior, o técnico novo e os usuários `ATIVO` do cliente. | Requisito do cliente — DEC-35; RF-19 | — |
| RN-104 | SE o relatório vai para `AGUARDANDO_ASSINATURA` ENTÃO notifica os usuários `ATIVO` do cliente. | Requisito do cliente — DEC-20; RF-19 | — |
| RN-105 | SE o relatório vai para `ASSINADO_CLIENTE` ENTÃO notifica os ADMs e o técnico executor da visita. | Requisito do cliente — RF-19 | — |
| RN-106 | SE o processamento diário (RN-029) gera ocorrências `PENDENTE` ENTÃO notifica os ADMs com **uma** notificação por local e mês, informando a quantidade. | Requisito do cliente — RF-19; agrupamento [A VALIDAR] | — |
| RN-107 | SE o usuário abre a notificação ENTÃO ela passa de `NAO_LIDA` para `LIDA`; o contador mostra as `NAO_LIDA`. | Requisito do cliente — RF-19.1 | — |
| RN-108 | SE uma ocorrência está `PENDENTE` ENTÃO aparece no painel do ADM. | Requisito do cliente — DEC-12; RF-28.1 | — |
| RN-109 | SE a visita está `AGENDADA` com data < hoje OU `EM_ANDAMENTO` com data de início < hoje ENTÃO aparece no painel como atrasada. O estado da visita não muda sozinho. | Requisito do cliente — RF-28.2 | — |
| RN-110 | SE a visita está `REGISTRADA` E o relatório não foi enviado ENTÃO aparece no painel. | Requisito do cliente — RF-28.3 | — |
| RN-111 | SE o relatório está `AGUARDANDO_ASSINATURA` há mais de N dias ENTÃO aparece no painel. N = 7. | Requisito do cliente — RF-28.4; N [A VALIDAR] | — |
| RN-112 | SE o PMOC está `EMITIDO` (sem assinatura do cliente) ENTÃO aparece no painel. | Requisito do cliente — RF-28.5 | — |
| RN-113 | SE o contrato `VIGENTE` vence em ≤ N dias ENTÃO aparece no painel. N = 30. | Requisito do cliente — RF-28.6; N [A VALIDAR] | Local que já tem contrato de renovação cadastrado não aparece (inferido). |
| RN-114 | SE o certificado do RT vence em ≤ 30 dias ENTÃO fica `A_VENCER` e aparece no painel; SE vence ENTÃO fica `VENCIDO` e bloqueia emissão (RN-008). | Requisito do cliente — CA-04.3; prazo [A VALIDAR] | — |
| RN-115 | SE a visita está `A_AGENDAR` ENTÃO aparece no painel; destaque quando o mês de referência é o mês corrente ou anterior. | Requisito do cliente — RF-28.7; destaque [A VALIDAR] | — |
| RN-116 | SE a data agendada sai do mês de referência ENTÃO aviso imediato na tela do ADM (não é notificação). | Requisito do cliente — RF-18.4 | — |
| RN-117 | SE o ADM filtra o painel ENTÃO os filtros são cliente, local, técnico e período. | Requisito do cliente — RF-28, CA-28.1 | — |

---

## 7. Status de cada entidade

Transições não listadas são **proibidas**. Toda transição grava auditoria (RN-092).

### 7.1 Usuário

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-140 | SE o ADM cria um usuário ENTÃO ele nasce `ATIVO` com exatamente um perfil. | Requisito do cliente — RF-02; PRD §3.1 | — |
| RN-141 | SE o ADM inativa ENTÃO `ATIVO` → `INATIVO`: não faz login, não recebe notificações, não assina; registros e assinaturas anteriores permanecem. Usuário nunca é excluído. | Requisito do cliente — RF-02.4, CA-01.2 | Reativação `INATIVO` → `ATIVO` pelo ADM (inferido). |

### 7.2 Contrato

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-142 | SE hoje < data de início ENTÃO `A_INICIAR`; SE início ≤ hoje ≤ fim ENTÃO `VIGENTE`; SE hoje > fim ENTÃO `ENCERRADO`. Estado derivado das datas, recalculado no processamento diário. | Requisito do cliente — RF-07.5; decisão A6 (`A_INICIAR` entra no PRD) | `CANCELADO` (RN-144) prevalece sobre as datas. |
| RN-143 | SE o ADM cria ou edita contrato E o período sobrepõe outro contrato não `CANCELADO` do mesmo local ENTÃO bloqueia. | Requisito do cliente — DEC-03; RF-07.1, CA-07.1 | — |
| RN-144 | SE o ADM cancela um contrato `A_INICIAR` ou `VIGENTE` (contrato `ENCERRADO` ou já `CANCELADO` não pode ser cancelado; decisão R2 2.6) ENTÃO informa data de cancelamento e **motivo (obrigatório)**; contrato → `CANCELADO`; PMOC → `HISTORICO` (RN-014); visitas futuras → `CANCELADA` (RN-076); ocorrências sem registro de meses posteriores ao mês do cancelamento viram Ø. | [A VALIDAR] — RF-07.5 (ver D-08) | Bloqueia se houver registro OK/NOK em mês posterior ao cancelamento. Encerramento antecipado de contrato já `ENCERRADO` não existe. |
| RN-145 | SE o contrato tem PMOC `EMITIDO` ou posterior ENTÃO datas de início e fim não podem ser alteradas. | [A VALIDAR] (inferido de RNF-15) | Encerramento antecipado: usar cancelamento. |

### 7.3 PMOC

| De | Para | Gatilho | Regra |
|---|---|---|---|
| — | `RASCUNHO` | ADM cria o PMOC do contrato | RN-001 |
| `RASCUNHO` | `EMITIDO` | Emissão concluída (assinatura do RT aplicada) | RN-009 |
| `EMITIDO` | `ASSINADO_CLIENTE` | Usuário do cliente assina | RN-124 |
| `ASSINADO_CLIENTE` | `EMITIDO` | ADM emite nova versão | RN-016 |
| `RASCUNHO`, `EMITIDO` ou `ASSINADO_CLIENTE` | `HISTORICO` | Fim do contrato, cancelamento ou "Confirmar renovação" (C10, R2 2.1) | RN-014, RN-192 |

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-146 | SE o PMOC está `HISTORICO` ENTÃO nenhuma alteração é permitida (plano, ocorrências por recálculo, versões). | Requisito do cliente — DEC-06; RF-15.1 | Correção manual de ocorrências pelo ADM (RN-090, RN-091) continua permitida e só aparece na ficha atualizada (RN-131) (inferido). Após "Confirmar renovação" (RN-192), as visitas já geradas do contrato anterior continuam podendo ser registradas e finalizadas (decisão R2 2.1 x); isso **não** altera o plano. |
| RN-147 | SE o PMOC está `RASCUNHO` OU está `HISTORICO` sem nunca ter sido emitido (virou histórico a partir de `RASCUNHO`, A5) ENTÃO não aparece para o cliente nem para o técnico (decisão R2 2.4); o ADM o vê. | Requisito do cliente (inferido) — RF-14.1, RF-32.2 | — |

### 7.4 Ocorrência

| De | Para | Gatilho | Quem | Regra |
|---|---|---|---|---|
| — | `PREVISTA` ou `NAO_PREVISTA` | Cálculo do cronograma | Sistema | RN-023 |
| `PREVISTA` | `PENDENTE` | Dia seguinte ao vencimento sem registro | Sistema | RN-029 |
| `PREVISTA` ou `PENDENTE` | `OK` / `NOK` | Finalização da visita | Técnico ou ADM | RN-086, RN-090 |
| `PENDENTE` | `OK` / `NOK` | Resolução ou "dispensar" a pendência (dispensar = `NOK`) | ADM | RN-091 |
| `PENDENTE` | `NAO_PREVISTA` | "Cancelar" a pendência (`unscheduled_reason = PENDENCIA_CANCELADA`) | ADM | RN-091 |
| `OK` ↔ `NOK` | — | Correção | ADM | RN-090, RN-092 |
| `PREVISTA` | `NAO_PREVISTA` | Recálculo (periodicidade, inativação de equipamento, cancelamento, remoção de atividade) | Sistema | RN-032, RN-068, RN-144, RN-183 |
| `NAO_PREVISTA` | `PREVISTA` | Reinclusão de atividade/equipamento ou recálculo que volta a prever o mês; **UPDATE da mesma linha** (decisão B10) | Sistema | RN-184 |

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-148 | SE a ocorrência está `OK` ou `NOK` ENTÃO nenhum processo automático a altera. | Requisito do cliente — DEC-12; RF-10.4 (inferido) | — |
| RN-149 | SE a ocorrência está `OK` ou `NOK` ENTÃO não volta para `PREVISTA` nem `PENDENTE`. | [A VALIDAR] | — |
| RN-150 | SE a ficha histórico é gerada ENTÃO mostra: `OK`, `NOK`, `Ø`, `Pendente`, e vazio para `PREVISTA`; a legenda inclui Pendente. | Requisito do cliente — DEC-12; RF-16.1; Meu PMOC — análise §1.5 | Legenda de NOK: "NOK – não efetuado" (decisão F1). |

### 7.5 Visita (OS)

| De | Para | Gatilho | Quem | Regra |
|---|---|---|---|---|
| — | `A_AGENDAR` | Emissão do PMOC, recálculo, divisão ou criação avulsa | Sistema / ADM | RN-060, RN-062, RN-063, RN-065 |
| `A_AGENDAR` | `AGENDADA` | Data + técnico definidos | ADM | RN-069 |
| `AGENDADA` | `AGENDADA` | Remarcação ou troca de técnico | ADM | RN-070 |
| `AGENDADA` | `EM_ANDAMENTO` | Técnico inicia | Técnico | RN-080 |
| `EM_ANDAMENTO` | `REGISTRADA` | Finalização | Técnico / ADM | RN-086, RN-090 |
| `A_AGENDAR` ou `AGENDADA` | `CANCELADA` | ADM cancela, recálculo esvazia a visita, ou contrato cancelado | ADM / Sistema | RN-065, RN-070, RN-076 |
| `A_AGENDAR` ou `AGENDADA` | `REGISTRADA` | ADM lança tudo pelo painel (técnico não usou o app) | ADM | RN-090 |

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-151 | SE a visita está `CANCELADA` ou `REGISTRADA` ENTÃO não volta a estado anterior. | Requisito do cliente (inferido) — RF-18.6 | Correções do ADM em `REGISTRADA` não mudam o estado. |

### 7.6 Relatório da visita

| De | Para | Gatilho | Quem | Regra |
|---|---|---|---|---|
| — | `RASCUNHO` | Visita `REGISTRADA` (um relatório por visita) | Sistema | RN-086 |
| `RASCUNHO` | `AGUARDANDO_ASSINATURA` | Técnico (ou ADM) envia | Técnico / ADM | RN-127 |
| `AGUARDANDO_ASSINATURA` | `RASCUNHO` | ADM retira de assinatura para corrigir | ADM | RN-129 |
| `AGUARDANDO_ASSINATURA` | `ASSINADO_CLIENTE` | Usuário do cliente assina | Cliente | RN-124 |
| `ASSINADO_CLIENTE` | `RASCUNHO` (nova versão) | ADM corrige relatório assinado | ADM | RN-130 |

### 7.7 Equipamento, tipo, atividade e certificado

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-152 | SE o equipamento, tipo ou atividade está `INATIVO` ENTÃO não entra em novos PMOCs, novas ocorrências nem novas visitas; o histórico permanece. | Requisito do cliente — RF-08.4, RF-09.5 | — |
| RN-153 | SE faltam > 30 dias para a validade do certificado ENTÃO `VALIDO`; SE ≤ 30 dias ENTÃO `A_VENCER`; SE passou ENTÃO `VENCIDO`. | Requisito do cliente — CA-04.2, CA-04.3; prazo de 30 dias confirmado em R2 2.11 | O estado é **calculado na leitura** a partir da data de validade, sem coluna própria (decisão C9). |

---

## 8. Assinatura e emissão de documentos

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-120 | SE o PMOC é emitido (ou nova versão) ENTÃO o sistema assina o PDF automaticamente com o certificado e-CPF ICP-Brasil do RT guardado; o PDF mostra os dados obrigatórios do RT e a indicação de assinatura digital. | Requisito do cliente — DEC-16, DEC-23; RF-13 | Certificado A3: ADM baixa, RT assina fora, ADM envia o PDF assinado [A VALIDAR] (P4). Formato (ex.: PAdES) [A VALIDAR]. |
| RN-121 | SE o certificado ou a senha são usados ENTÃO nunca aparecem na interface nem em logs; ficam guardados criptografados. | Requisito do cliente — RNF-09 | — |
| RN-122 | SE um usuário tenta assinar ENTÃO só é permitido se: perfil `CLIENTE`, `ATIVO`, o documento é do cliente dele e está aguardando assinatura (`EMITIDO` para PMOC, `AGUARDANDO_ASSINATURA` para relatório). | Requisito do cliente — DEC-20, DEC-24; RF-14, RF-26 | — |
| RN-123 | SE o cliente assina ENTÃO é assinatura eletrônica simples: o usuário vê o documento, marca o aceite e confirma. | Requisito do cliente — DEC-24; RNF-08 | Texto do aceite: P5 [A VALIDAR]. |
| RN-124 | SE **um** usuário do cliente assina ENTÃO o documento está assinado (PMOC → `ASSINADO_CLIENTE`; relatório → `ASSINADO_CLIENTE`) e os demais usuários veem quem assinou, sem botão de assinar. | [A VALIDAR] — PRD Q3; CA-14.2 | — |
| RN-125 | SE o cliente assina ENTÃO o sistema grava: ID do usuário, nome, e-mail, data/hora com fuso, IP, user-agent, hash SHA-256 do PDF e texto do aceite exibido; e gera o PDF final com bloco ou página de evidências. | Requisito do cliente — DEC-24; RNF-08, CA-14.1, CA-26.1 | User-agent [A VALIDAR]. |
| RN-126 | SE um PDF foi emitido ou assinado ENTÃO nunca é sobrescrito; qualquer mudança gera nova versão numerada e as anteriores continuam disponíveis. | Requisito do cliente — DEC-06, DEC-24; RNF-15 | — |
| RN-127 | SE o técnico (ou ADM) envia o relatório ENTÃO ele vai direto para `AGUARDANDO_ASSINATURA`, sem aprovação do ADM; o PDF identifica o elaborador, o técnico executor e a data da visita. | Requisito do cliente — DEC-31, DEC-38; RF-25, CA-25.1 | PDF indicar "lançado pelo ADM": RF-29.3 [A VALIDAR]. |
| RN-128 | SE a IA gera o texto do relatório ENTÃO usa **só** os dados registrados na visita e dados cadastrais do local; não inventa medição, atividade ou equipamento; aponta como necessidade de corretiva cada ocorrência com a marca "requer corretiva" (RN-193) e destaca cada `NOK` (atividade **não efetuada**, decisão F1) com a observação; a DEC-11 foi emendada nesse sentido (AF-13): o texto aponta a necessidade, e a decisão de fazer a corretiva é do cliente; o sistema guarda texto da IA, texto final, modelo e versão do prompt. | Requisito do cliente — DEC-09, DEC-11, DEC-38; RF-24, RNF-10, CA-24.1, CA-24.2 | IA falhou ou indisponível: texto manual permitido (RNF-10). Estrutura e prompt: P6 [A VALIDAR]. |
| RN-129 | SE o relatório está `AGUARDANDO_ASSINATURA` ENTÃO o ADM pode retirá-lo (→ `RASCUNHO`), corrigir e reenviar; o cliente deixa de ver o botão de assinar. | Requisito do cliente — RF-29.4 | — |
| RN-130 | SE o relatório está `ASSINADO_CLIENTE` ENTÃO não é editado; correção gera nova versão em `RASCUNHO` que exige nova assinatura; a versão assinada anterior continua disponível. | [A VALIDAR] — RF-29.5 | — |
| RN-131 | SE ADM ou cliente pede a "ficha atualizada" ENTÃO o sistema gera um PDF novo, sem assinatura, com os registros até a data, marcado "gerado em {data}" no rodapé; o PMOC assinado não muda e não é reassinado. | [A VALIDAR] — RF-16.2, RF-16.3, PRD Q6 | — |
| RN-132 | SE qualquer PDF é gerado ENTÃO segue RNF-07: A4 retrato; datas `dd/mm/aaaa`; CNPJ, CEP e telefone com máscara; nunca imprime `null`, `undefined` ou rótulo de campo vazio; rodapé `Página {n} de {total}`, data de geração, `{TH}-{revisão}` quando houver e logo do sistema novo; PMOC e relatório da visita imprimem também a versão (`v{n}`) e o código de verificação (RN-187). | Requisito do cliente — DEC-01, DEC-32, RNF-07; Meu PMOC — análise B1, B5, B7 | Omitir ou deixar em branco o campo vazio [A VALIDAR]. |
| RN-133 | SE o cliente não assina ENTÃO o documento fica aguardando e aparece no painel; o ADM pode registrar observação. O ADM **nunca** assina em nome do cliente. | Requisito do cliente — DEC-12, DEC-24; PRD Q4 [A VALIDAR]; matriz §3.2 | — |
| RN-134 | SE a assinatura do cliente no PMOC está ausente ENTÃO isso **não** bloqueia visitas, registros nem relatórios. | [A VALIDAR] (ver D-04) | — |
| RN-135 | SE o relatório é assinado ENTÃO só pelo portal, com usuário logado; o relatório não é assinado no celular do técnico. A assinatura presencial existe apenas para o **comprovante de visita** (RN-189), que não é o relatório. | [A VALIDAR] — PRD Q1; decisão A3 | — |

---

## 9. Permissões

Toda checagem é feita **no servidor** (RF-03, RNF-04). Esconder botão não conta como permissão.

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-160 | SE o usuário é `ADM` ENTÃO pode tudo o que a matriz do PRD §3.2 marca ✅, sobre todos os dados. | Requisito do cliente — PRD §3.2 | Não assina PMOC nem relatório (RN-133). |
| RN-161 | SE o usuário é `CLIENTE` ENTÃO lê somente dados do cliente ao qual está vinculado (todos os locais desse cliente) e não edita cadastro nem agenda. | Requisito do cliente — DEC-36, DEC-39; RF-03.1, RF-32, CA-32.2 | Restrição por local: PRD Q2 [A VALIDAR]. |
| RN-162 | SE um `CLIENTE` requisita por ID um recurso de outro cliente ENTÃO recebe acesso negado (sem revelar se o recurso existe). | Requisito do cliente — CA-03.1 | — |
| RN-163 | SE o usuário é `CLIENTE` ENTÃO pode ver e baixar PMOCs (vigente e históricos, todas as versões) e relatórios dos seus locais, e assinar os que aguardam assinatura (RN-122). | Requisito do cliente — DEC-20, DEC-36; RF-27, RF-32 | `RASCUNHO` e histórico nunca emitido não aparecem (RN-147). |
| RN-164 | SE o usuário é `TECNICO` ENTÃO grava registros somente em visitas atribuídas a ele que estejam `EM_ANDAMENTO` (decisão B11); em visita `AGENDADA` ele só lê (para gravar, inicia a visita: RN-080). Lê essas visitas com os dados do local e dos equipamentos. Visitas que ele finalizou: RN-165 e RN-167. | Requisito do cliente — RF-03.2, RF-20; decisão B11 | — |
| RN-165 | SE a visita do técnico é reatribuída ENTÃO ele deixa de vê-la, exceto visitas que ele mesmo finalizou, que continua vendo somente leitura com o relatório, **sem limite de tempo** (decisão B12; a janela de 90 dias de DFT-19 foi removida). | Requisito do cliente (inferido) — RF-20.3, CA-03.2, CA-18.1 | — |
| RN-166 | SE o usuário é `TECNICO` ENTÃO não vê PMOC, contratos, agenda de outros técnicos nem auditoria. | Requisito do cliente — PRD §3.2; decisão B1 (técnico não vê o PMOC) | — |
| RN-167 | SE o usuário é `TECNICO` ENTÃO gera, edita e envia o relatório só das visitas que ele finalizou. | Requisito do cliente — DEC-38; RF-25 | — |
| RN-168 | SE alguém tenta alterar periodicidade, emitir PMOC, agendar/remarcar/cancelar visita ou resolver pendência ENTÃO só `ADM` pode. | Requisito do cliente — DEC-07, DEC-12, DEC-35; PRD §3.2 | — |
| RN-169 | SE o usuário é `CLIENTE` ENTÃO está vinculado a exatamente um cliente; o ADM não salva usuário `CLIENTE` sem vínculo. | Requisito do cliente — DEC-39; RF-02.2, CA-02.3 | — |
| RN-170 | SE alguém tenta acessar como RT ENTÃO não há login: o RT não é usuário do sistema. | Requisito do cliente — DEC-07, DEC-23 | — |
| RN-171 | SE um arquivo (PDF, foto) é baixado ENTÃO só por URL autenticada ou assinada com expiração, respeitando RN-161 a RN-166. | Requisito do cliente — RNF-04 | Tempo de expiração [A VALIDAR]. |
| RN-172 | SE dados vão para a IA ENTÃO não incluem e-mail, telefone ou IP de usuários. | Requisito do cliente — RNF-05.3 | — |

---

## 10. Regras ambíguas para você decidir

### 10.1 Estruturais (difíceis de mudar depois)

> Em 21/10/2026 o usuário respondeu D-02 (opção a) e D-05 (NOK = "não efetuado", que **não** é a opção recomendada). As demais continuam como adotadas pela recomendação; D-01, D-03, D-04, D-06, D-07 e D-08 não foram reabertas. Ver §11.3 e `docs/auditoria-final.md` §5.

As regras acima já estão escritas com a proposta **recomendada**. Responda só com a letra da opção (ou "ok" para aceitar todas as recomendadas).

| ID | Pergunta | Opções | Recomendação | Afeta |
|---|---|---|---|---|
| D-01 | "Ordem de serviço" é a mesma coisa que a **visita** do PRD? | **a)** Sim, OS = visita (uma entidade). b) OS separada, com N visitas por OS. | **a**: o PRD já tem todo o fluxo na visita; uma segunda entidade só duplica estados. | §4, §7.5 |
| D-02 | **[DECIDIDO 21/10/2026: opção a]** Um contrato tem **um** PMOC (com versões) ou **vários** PMOCs? A análise §9.2 diz "Contrato 1 → N PMOCs"; o PRD diz "renovação = contrato novo = PMOC novo". | **a)** Contrato 1:1 PMOC; mudanças geram versões do mesmo PMOC. b) Contrato 1:N PMOCs. | **a**: segue DEC-06 e o PRD; a linha da §9.2 da análise fica corrigida. | RN-001, RN-016 |
| D-03 | Mês parcial conta como mês do contrato? Ex.: AUR vai de 01/09/2025 a 01/08/2026; DOK de 01/04/2025 a 30/04/2026. | **a)** Conta todo mês de calendário tocado pelo contrato (AUR = 12 meses, DOK = 13). b) Só meses completos. c) Conta meses pela data (aniversário do dia de início). | **a**: regra simples, a ficha mostra todos os meses da vigência e o vencimento fica sempre no fim do mês (DEC-25). | RN-022, RN-028 |
| D-04 | Quando as visitas (OS) são geradas, e a falta da assinatura do cliente no PMOC bloqueia a operação? | **a)** Todas as visitas do contrato na emissão; assinatura do cliente não bloqueia nada. b) Só após a assinatura do cliente. c) Gerar mês a mês (ex.: 60 dias antes). | **a**: o ADM vê a agenda inteira desde o início e um cliente que demora a assinar não trava a manutenção. | RN-060, RN-134 |
| D-05 | **[DECIDIDO 21/10/2026: NOK = "não efetuado"; defeito achado = `OK` + marca "requer corretiva" (R2 1.3, RN-193); DEC-11 emendada (AF-13); ver §11.3]** O que `NOK` significa? A legenda do seu PMOC diz "NOK – não efetuado"; DEC-11 usa NOK para apontar defeito e corretiva. | **a)** NOK = "não conforme" (não executado **ou** executado com problema), a observação explica; legenda passa a "NOK – não conforme". b) Manter "não efetuado" e criar um 3º valor para "executado com problema". | **a**: mantém OK/NOK das decisões, e a observação obrigatória já diferencia os casos. | RN-081 a RN-083, RN-150 |
| D-06 | Uma ocorrência `PENDENTE` de um mês pode ser executada pelo técnico em visita de outro mês? | **a)** Sim, o ADM a inclui numa visita posterior; ela continua no mês original da ficha. b) Não; só o ADM resolve pendência pelo painel. | **a**: é o caso real de "volto no mês que vem e faço o que faltou", e o técnico registra com data real. | RN-064 |
| D-07 | Mudança de equipamento ou periodicidade **depois** da emissão exige nova versão do PMOC (e nova assinatura)? | **a)** Não obrigatório: plano e ficha atualizam na hora; o ADM decide quando emitir nova versão. b) Sempre gera nova versão automaticamente. | **a**: é a proposta do PRD (Q5) e evita pedir assinatura ao cliente a cada equipamento novo. | RN-015, RN-067, RN-068 |
| D-08 | Contrato encerrado **antes** da data de fim (cancelamento) existe? | **a)** Sim: estado `CANCELADO` com data; visitas futuras canceladas; meses seguintes viram Ø; PMOC vira histórico. b) Não: só se altera a data de fim. | **a**: preserva a data de fim original para histórico e deixa claro no portal do cliente o motivo. | RN-076, RN-142, RN-144 |

### 10.2 Detalhes com padrão já adotado (revisar quando quiser)

Não bloqueiam a implementação; o padrão abaixo vale até nova decisão.

| Regra | Padrão adotado |
|---|---|
| RN-017 | Contrato encerrado não emite PMOC nem nova versão. |
| RN-032 | Recálculo de periodicidade não inclui o mês corrente. |
| RN-049 | Tipo do equipamento não muda depois de ter registro. |
| RN-071 | Visita em andamento não troca técnico nem data. |
| RN-080 | Técnico pode iniciar a visita antes da data agendada (agora é a única forma de gravar: B11). |
| RN-106 | Notificação de pendências agrupada por local e mês. |
| RN-111 / RN-113 / RN-114 | N = 7 dias (relatório), 30 dias (contrato), 30 dias (certificado; A7 "sim" confirmado em R2 2.11). |
| RN-124 | Uma assinatura de qualquer usuário do cliente basta (PRD Q3). |
| RN-135 | Cliente assina o relatório só pelo portal (PRD Q1); o comprovante é assinado no aparelho do técnico (A3). |
| RN-142 | Estado `A_INICIAR` para contrato com início futuro (confirmado em A6). |
| RN-145 | Datas do contrato travadas após a emissão. |
| RN-149 | `OK`/`NOK` não voltam para `PENDENTE`. |

Pendências de conteúdo do PRD continuam valendo sem mudança: P1 a P7 e Q1 a Q9 (`00-escopo-prd.md` §10).

---

## 11. Cadastros, sincronização e decisões de 21/10/2026

> Regras novas ou formalizadas a partir das respostas de 21/10/2026 (rodada 1; citadas como "decisão A1", "B6"...), da rodada 2, de 21/10/2026 à noite (citadas como "decisão R2 x.y"), e da auditoria final de 27/10/2026 (citadas como "AF-xx", `docs/auditoria-final.md` §5). Não há mais IDs `PEND`: o que continua aberto está em `docs/auditoria-final.md` §6 e não trava o código.

### 11.1 Cadastros (decisão D3)

Todas as validações abaixo rodam no backend **e** em constraints do PostgreSQL quando aplicável (formato, unicidade, `fim > início`).

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-173 | SE o ADM salva um cliente ENTÃO exige razão social, CNPJ válido (14 dígitos com dígito verificador), logradouro, número (ou "s/n"), cidade, UF e CEP com 8 dígitos; nome fantasia e até 2 telefones (sem repetir) são opcionais; CNPJ, CEP e telefone ficam gravados sem máscara. CPF não é aceito. | Requisito do cliente — DEC-17; RF-05, CA-05.1 a CA-05.4; decisão D3 | — |
| RN-174 | SE o ADM salva um cliente com CNPJ já usado por outro cliente ENTÃO o sistema bloqueia. A empresa executora é um registro único (RN-177). | Requisito do cliente — DEC-34; RF-05.4; decisão D3 | O CNPJ de um cliente **pode** coincidir com o da empresa executora; o sistema não verifica isso (decisão R2 2.11). |
| RN-175 | SE o ADM salva um local ENTÃO exige nome e endereço completo; telefone é opcional; o código do local é gerado pelo sistema, único e imutável depois que existe equipamento. | Requisito do cliente — DEC-03, DEC-26; RF-06, CA-06.1, CA-06.2; decisão D3 | Regra exata de geração do código [A VALIDAR]. |
| RN-176 | SE o ADM salva um contrato ENTÃO exige data de início, data de fim **maior** que a de início e nº de ART (decisão B8: a ART é exigida ao salvar o contrato); código TH e revisão são opcionais. | Requisito do cliente — DEC-28; RF-07; decisão B8, D3 | A pré-condição (e) de RN-007 passa a ser garantia redundante. Formato da ART: texto livre, sem validação de formato, até haver fonte (AF-16). |
| RN-177 | SE o ADM salva a empresa executora ENTÃO exige razão social, CNPJ válido, telefone, endereço completo, registro CREA e logo; o RT exige nome, título, nº de registro, telefone, e-mail e endereço completo; existe **uma** empresa e **um** RT; alterá-los não muda PMOCs emitidos. | Requisito do cliente — DEC-14, DEC-29, DEC-34; RF-04, CA-04.1; decisão D3 | — |
| RN-178 | SE o ADM salva um usuário ENTÃO exige nome, e-mail único no sistema, perfil e situação (ativo/inativo); `CLIENTE` exige vínculo com exatamente um cliente (RN-169); usuário não é excluído, só inativo (RN-141). | Requisito do cliente — DEC-39; RF-02, CA-02.2, CA-02.3; decisão D3 | Telefone opcional [A VALIDAR]. |
| RN-179 | SE o ADM tenta mudar o perfil de um usuário já criado ENTÃO o sistema não permite. | DFT-04; decisão B6 | Perfil fixo para qualquer usuário (resposta "sim" de R2 2.11, opção a; confirmada em AF-16). Para mudar o perfil, o ADM inativa o usuário e cria outro. |
| RN-180 | SE o usuário informa a senha ao definir ou redefinir ENTÃO ela tem no mínimo **8** caracteres; o hash usa scrypt (Better Auth). | Decisão B6 | O `ADM` tem também o segundo fator (RN-194). |
| RN-181 | SE alguém tenta autenticar ENTÃO o login usa e-mail e senha; usuário `INATIVO` é negado; a recuperação de senha usa link de uso único enviado por e-mail (exceção de RN-100, decisão B4). | Requisito do cliente — DEC-33; RF-01, CA-01.1, CA-01.2; decisão B4 | Validade do link: [A VALIDAR]. |

### 11.2 Conflitos de sincronização (decisão D2)

Movidas de `05-stack-e-arquitetura.md` §6.5 **sem mudar o conteúdo**. O ID `CF-xx` foi mantido. O doc 05 mantém só a implementação técnica (`resolveConflict.ts`) e refere-se a estas linhas. Como o offline nível 2 é Fase 2 (A1), estas regras valem para o **nível 1** (rascunho local e reenvio) e para o nível 2 quando entrar.

| ID | Situação | Regra | Origem |
|---|---|---|---|
| CF-01 | ADM remarcou data ou trocou técnico enquanto o técnico estava offline | Agenda: **vale a do ADM**. Registros já feitos pelo técnico antes de receber a mudança: aceitos se a visita não estiver `REGISTRADA`; a visita aparece no painel para o ADM conferir. | RNF-03 [A VALIDAR] |
| CF-02 | ADM lançou pelo painel a mesma ocorrência que o técnico registrou offline | **Vale o registro do técnico** na ocorrência; o lançamento do ADM fica no `audit_log` como valor anterior. | RNF-03, E-13.3 |
| CF-03 | ADM já finalizou a visita pelo painel (`REGISTRADA`) e chegam registros do técnico | Servidor responde 409; registros ficam guardados como "não aplicados" e aparecem no painel do ADM para decisão; o app mostra "Esta visita já foi registrada pelo escritório". | E-11.14, DFT-08 |
| CF-04 | Mesmo técnico, dois aparelhos, mesma ocorrência | Compara `base_row_version`: se igual ao do servidor, aplica; se diferente, **vale a última chegada ao servidor** e a anterior fica no `audit_log` [A VALIDAR]. | Inferido |
| CF-05 | Visita reatribuída a outro técnico antes de o primeiro enviar | Registros do primeiro: aceitos só para ocorrências ainda sem registro e visita não `REGISTRADA`; senão, CF-03. O primeiro deixa de ver a visita após enviar (RN-165). | CA-03.2 [A VALIDAR] |
| CF-06 | Equipamento inativado ou ocorrência removida do plano enquanto offline | Registro é aceito e marcado para revisão do ADM; nunca descartado em silêncio. | Inferido [A VALIDAR] |
| CF-07 | Técnico inativado com dados no aparelho | Login negado; dados não enviados não sobem; o ADM conclui pelo painel (E-11.18). | RN-141 |

Onde fica o que o ADM precisa conferir (AF-03): CF-01 e CF-06 aplicam o registro e criam um `sync_review_item` com `applied = true`; CF-03 e CF-05 (quando não aceito) guardam a operação em `sync_review_item` com `applied = false`. Os itens `ABERTO` aparecem no painel do ADM (TL-100). CF-04 não cria item: o valor anterior fica no `audit_log`.

### 11.3 Regras decididas em 21/10/2026

| ID | Regra | Origem | Exceções |
|---|---|---|---|
| RN-183 | SE uma atividade sai do plano de um PMOC `EMITIDO` ou `ASSINADO_CLIENTE` ENTÃO as ocorrências **passadas** (mês corrente e anteriores, ou com registro) permanecem como estão; as **futuras** sem registro viram `NAO_PREVISTA` com `unscheduled_reason = ATIVIDADE_REMOVIDA_DO_PLANO` e saem das visitas não iniciadas; a ficha mostra Ø nelas e mantém o histórico. | Decisão D1; RF-10.3; RN-032, RN-068 | A remoção é **bloqueada** enquanto existir visita `EM_ANDAMENTO` com ocorrência dessa atividade (decisão R2 2.3 b): o ADM vê a mensagem e a visita responsável e tenta de novo depois. Relatórios assinados nunca mudam (RN-130). |
| RN-184 | SE uma atividade volta ao plano (ou o recálculo volta a prever o mês) ENTÃO a ocorrência `NAO_PREVISTA` existente é alterada para `PREVISTA` por **UPDATE** da mesma linha (limpa `unscheduled_reason` e `unscheduled_at`); não se insere segunda linha para o mesmo equipamento × atividade × mês. | Decisão B10; DM-04 | — |
| RN-185 | SE o técnico ou o ADM anexa fotos a um equipamento da visita ENTÃO aceita até 10 fotos por equipamento, 10 MB por foto, formatos JPEG, PNG e WebP; foto não é obrigatória por padrão, mas é obrigatória quando a atividade tem `requires_photo = true` (coluna em `activity_template` e `pmoc_activity`; AF-02): nesse caso a ocorrência não é finalizada (RN-085) sem pelo menos 1 foto do equipamento na visita. | Decisão D4; decisão R2 2.7 (x e a); RF-21.5, RNF-11 | Limite de 10 **por equipamento na visita** (confirmado). Se 1 foto de um equipamento vale para duas atividades com `requires_photo`: [A VALIDAR]. Tratamento no aparelho (AF-17): a foto escolhida (JPEG, PNG, WebP ou HEIC da câmera do iPhone) é convertida para JPEG, lado maior 1600 px, qualidade 0,7, antes de enviar; os limites de 10 MB e 10 fotos valem para o arquivo enviado; uma foto por requisição (05 §6.4), sem limite total por envio. HEIC que o navegador não consegue abrir é recusado com "Formato de foto não aceito. Use a câmera pelo app." (conferido no S-06). |
| RN-186 | SE o usuário é `CLIENTE` ENTÃO vê no cronograma só visitas autorizadas pelo critério de DFT-15, dos contratos e locais do próprio cliente; destaca a **versão atual** do PMOC e do relatório e mantém as versões históricas disponíveis para consulta. | Decisão D5; RN-161, RN-163; DFT-15 | — |
| RN-187 | SE um PMOC ou um relatório da visita é gerado ENTÃO o PDF imprime a versão (`v{n}`) e o código de verificação. | Decisão D6, B7; INT-25; CA-26.1 | A tela pública mínima "Verificar documento" entra no MVP (decisão R2 2.8 b); conteúdo e limite de uso: 06 INT-14. |
| RN-188 | SE o sistema emite PMOC ou gera PDF de relatório ENTÃO o faz de forma **síncrona** (sem job, sem estado "emitindo"). | Decisão A2 | Limite de 800 s da função: spike S-01 (AF-11). |
| RN-189 | SE o técnico encerra uma visita no local ENTÃO pode gerar o **comprovante de visita** assinado por um responsável presente (não precisa ser usuário), com **só** estes dados (decisão R2 2.9 a): nome digitado, imagem da assinatura, data/hora e hash `sha256` do conteúdo; **sem** CPF, cargo nem geolocalização. O comprovante não substitui a assinatura do relatório (RN-124). | Decisão A3; 05 §6.9 | Incluir CPF, cargo ou geolocalização exige decisão nova e validação jurídica [A VALIDAR – advogado]. **Sem internet (AF-10):** o comprovante pode ser feito offline, como o resto do nível 1: fica no aparelho e é enviado na sincronização; o PDF é gerado no servidor ao receber. Sem cifra própria (PIN é "Depois", risco aceito em R2 1.5 a); os dados locais são apagados após o envio confirmado (05 OF-05). Tabela: `visit_receipt` (03 §2.11); tela: TL-206. |
| RN-190 | SE o certificado do RT é cadastrado ENTÃO é um e-CPF **A1** (arquivo), assinatura PAdES. | Decisão A7 | Aviso de 30 dias e ausência de fluxo A3 confirmados (decisão R2 2.11). Validador e perfil PAdES: spike S-02 (AF-19). |
| RN-191 | SE o sistema trata retenção ENTÃO: (1) registro oficial de PMOC emitido não é apagado automaticamente; (2) correção de documento emitido gera nova versão e preserva o histórico; (3) dados temporários e logs têm política de retenção própria; (4) dados pessoais são apagados ou anonimizados quando permitido e cabível, respeitada a retenção legal; (5) **nenhum expurgo automático** é implementado antes de as categorias de dados e prazos serem aprovados. | Decisão A8 | Categorias e prazos: [A VALIDAR – advogado] (`docs/auditoria-final.md` §6). Não trava o código: nenhum expurgo é implementado até lá. |
| RN-192 | SE existe um contrato novo com `previous_contract_id` apontando para um contrato `A_INICIAR` ou `VIGENTE` do mesmo local ENTÃO o ADM pode acionar **"Confirmar renovação"** (ação explícita, decisão R2 2.1 c): o sistema grava `renewal_confirmed_at` e `renewal_confirmed_by_user_id` no contrato novo (AF-02), o PMOC do contrato anterior vai para `HISTORICO` (RN-014) e as visitas restantes do contrato anterior **continuam válidas**, com o cronograma já existente (decisão R2 2.1 x): podem ser agendadas, executadas e finalizadas. Salvar o contrato novo ou emitir o PMOC novo **não** confirma a renovação. | Decisão R2 2.1 (c e x); C10; RF-15 | Pré-condição do contrato novo e permissão (só ADM): inferidas. Se o ADM nunca confirma, o PMOC anterior vira `HISTORICO` só na data de fim (RN-014). Desfazer a confirmação não existe no MVP [A VALIDAR]. |
| RN-193 | SE o técnico ou o ADM registra uma ocorrência `OK` de atividade **executada com problema** ENTÃO pode marcar **"requer corretiva"** (`requires_corrective = true`, AF-02); a observação passa a ser obrigatória. A marca só existe com `result = OK`; `NOK` (atividade não efetuada) já exige observação (RN-083). O sistema **não** gera OS de corretiva (RN-077); o relatório e o texto da IA destacam cada ocorrência marcada (RN-128). | Decisão R2 1.3 (a); F1; DEC-11 | DEC-11 emendada em 27/10/2026 (AF-13): OK = preventiva executada; "requer corretiva" só aponta a necessidade, e quem decide fazer a corretiva é o cliente. |
| RN-194 | SE o usuário é `ADM` ENTÃO o login exige, além da senha, um código TOTP de aplicativo autenticador, e o ADM só acessa a tela de configurar o segundo fator até ativá-lo (SEG-05, ARQ-07); ao ativar, o sistema gera 10 códigos de recuperação de uso único, mostrados uma vez (SEG-06); sem aplicativo nem código, **outro ADM** redefine o segundo fator, com o motivo gravado no `audit_log` (SEG-17; esta é uma ação de segurança, fora da decisão R2 2.5); o sistema exige no mínimo 2 ADMs ativos (SEG-17). `TECNICO` e `CLIENTE` não têm segundo fator no MVP. Código por SMS, WhatsApp ou e-mail não é aceito (DEC-40, SEG-06a). | Decisão R2 1.2 (b); D7.2; DEC-33, DEC-40 | Volta parcialmente atrás em B2 b (MFA "fase futura") só para o `ADM`. Número de ADMs: ~3 (decisão R2, bloco 3). Reautenticação e janela do código TOTP: 06 SEG-05; tabelas do Better Auth: 03 §2.1 (AF-04); nomes das opções do plugin na versão 1.7: spike S-04. |
