# Auditoria final antes do desenvolvimento

> **Situação em 27/10/2026:** o usuário respondeu todos os itens. As decisões estão registradas como **AF-01 a AF-20** na §5 e já foram aplicadas nos documentos; o que continua aberto, sem travar o código, está na §6; o novo veredito está na §7. As seções 1 a 4 abaixo ficam como registro da auditoria de 22/10/2026.

Data: 22/10/2026. Documentos lidos: CLAUDE.md, 00-escopo-prd, 01-analise-pmocs-existentes, 02-regras-de-negocio, 03-modelo-de-dados, 04-fluxos-e-telas, 05-stack-e-arquitetura, 06-seguranca-e-operacao e glossario. Nenhum documento foi alterado nesta auditoria; as mudanças vieram depois, com as respostas (§5).

Critério: só entra o que impede ou compromete o início da implementação. Itens marcados como decididos (DEC, D-xx decididos, A1–A8, B1–B13, C1–C12, D1–D7, E1–E18, F1–F5 e R2) não foram levantados de novo.

Achados: **7 BLOQUEANTES**, **8 IMPORTANTES** e **15 MENORES**. O número de bloqueantes é baixo. A maior parte deles vem de um único problema: o arquivo de pendências citado em todos os documentos não existe.

---

## 1. BLOQUEANTES

### [B-01] O arquivo de pendências não existe

- **Em uma frase:** os documentos mandam consultar `docs/pendencias.md` antes de implementar, mas esse arquivo não existe, e com ele se perderam as propostas que você ainda precisa aprovar.
- **Por que aparece:**
  - CLAUDE.md, tabela de documentos, diz: "`docs/pendencias.md` | ... | Antes de implementar algo que dependa de decisão: se o item está aqui, pare e pergunte".
  - 03 §2.12 diz: "as **colunas propostas** ... estão em `docs/pendencias.md` (PEND-D21) **para aprovação**".
  - Os docs citam cerca de 25 IDs: PEND-D13, D14, D20, D21, D23 a D29; PEND-L01, L02, L04 e L05; PEND-T01 a T07.
  - Também não existem `docs/perguntas-revisao.md`, `docs/perguntas-pendentes.md` nem `relatorio-rodada-2.md`, que o CLAUDE.md e o glossário citam.
  - Na pasta `/mnt/project-files/pmoc/` não há nenhum desses arquivos.
- **Exemplo concreto:** a IA de código vai criar a tabela `occurrence_record`, vê "`requires_corrective` ... **Nome proposto**: PEND-D26" e, como manda o CLAUDE.md, procura o item em `pendencias.md`. O arquivo não existe, então ela para em todas as tabelas que citam PEND, ou então inventa.
- **Opções:**
  - **A.** Você me envia o arquivo, se ele existe em outro lugar. *Vantagem:* recupera as propostas originais. *Custo:* nenhum.
  - **B.** Eu recrio `pendencias.md` a partir das citações nos docs 00–06, com cada PEND, o que se sabe dele e a pergunta. *Vantagem:* rápido e rastreável. *Custo:* as colunas propostas em PEND-D21 não estão em nenhum doc, então precisam ser propostas de novo para você aprovar.
  - **C.** Abandonar os IDs PEND e decidir tudo nesta auditoria. *Vantagem:* um passo a menos. *Custo:* cerca de 25 referências ficam apontando para o nada.
- **Se eu não decidir:** a regra "pare e pergunte" do CLAUDE.md trava a IA de código já na primeira migração. Se ela ignorar a regra, vai inventar colunas, que é o que as regras do projeto proíbem.
- **Recomendação:** A se o arquivo existe; senão B. Os IDs já estão em todos os docs, e recriar o arquivo custa menos do que reescrever as referências.
- **Pergunta para mim:** o arquivo `pendencias.md` existe em algum lugar (A) ou devo recriá-lo a partir dos docs (B)?
- **Docs afetados:** novo `docs/pendencias.md`; CLAUDE.md (remover a referência a `perguntas-revisao.md`, se não existir); glossario.

### [B-02] Nomes "propostos" de colunas e valores (PEND-D26)

- **Em uma frase:** quatro nomes de colunas e um valor de enum estão marcados como "nome proposto", e o CLAUDE.md proíbe criar migração com eles sem a sua confirmação.
- **Por que aparece:**
  - Em 03 §2 aparecem: `requires_photo` ("**Nome proposto**: PEND-D26"), `requires_corrective`, `renewal_confirmed_at` e `renewal_confirmed_by_user_id`.
  - Em 02 RN-091 aparece: "`unscheduled_reason = PENDENCIA_CANCELADA` (nome proposto: PEND-D26)".
  - O CLAUDE.md proíbe criar migração ou tela com nome marcado como proposto sem confirmação.
- **Exemplo concreto:** a migração da biblioteca de atividades precisa da coluna `requires_photo`. Sem a confirmação, ela fica sem a coluna ou é criada com um nome que depois exige uma nova migração e mudança em todo o código que a usa.
- **Opções:**
  - **A.** Confirmar os 5 nomes como estão. *Vantagem:* zero retrabalho, porque todos os docs já os usam. *Custo:* nenhum.
  - **B.** Trocar algum nome. *Vantagem:* ajusta a preferência. *Custo:* é preciso atualizar os docs 02, 03 e 04 antes de começar.
- **Se eu não decidir:** a primeira migração fica bloqueada, ou será refeita.
- **Recomendação:** A. Os nomes seguem o padrão do modelo (inglês, `snake_case`, `_at`/`_by_user_id`), e trocá-los não traz ganho.
- **Pergunta para mim:** confirma os 5 nomes como estão (A) ou quer trocar algum (B, diga qual)?
- **Docs afetados:** 03 (tirar "nome proposto"), 02 (RN-091, RN-185, RN-192, RN-193), pendencias.md.

### [B-03] Colunas de sincronização offline nas tabelas centrais (parte de PEND-D21)

- **Em uma frase:** o offline nível 1 está no MVP, mas as colunas que ele exige nas tabelas sincronizadas e as tabelas `device` e `unapplied_sync_record` só existem como "proposta" que se perdeu.
- **Por que aparece:**
  - 03 §2.12, E8: "`unapplied_sync_record` | Sim (offline nível 1, R2 1.1 b) | ... | Proposta em PEND-D21".
  - E9: "`device` | Sim, simplificado | ... | Proposta em PEND-D21".
  - E10: "Hora do aparelho (`device_time`) e `base_row_version` nas tabelas sincronizadas | Sim | ... | Quais tabelas: proposta em PEND-D21".
  - 03 §2.12 diz que "nada daquela proposta vale como decisão até a aprovação".
  - As regras CF-01 a CF-07 (02 §11.2) dependem de `base_row_version` para detectar conflito.
- **Exemplo concreto:** o técnico registra ocorrências sem sinal, e o ADM muda a data da visita nesse meio tempo. Para aplicar a CF-04 ("agenda do ADM prevalece"), o servidor precisa saber de que versão da linha o técnico partiu (`base_row_version`). Se `visit` e `occurrence_record` forem criadas na Fase 1 sem essa coluna, a Fase de sincronização vai exigir alterar tabelas com dados.
- **Opções:**
  - **A.** Eu proponho as colunas e tabelas de novo, com base em 05 §6.5 e §6.6, e você aprova antes da migração da Fase 1. *Vantagem:* o schema nasce completo. *Custo:* mais uma rodada de aprovação, curta.
  - **B.** A Fase 1 cria as tabelas sem as colunas de sincronização, e a fase do app do técnico as acrescenta. *Vantagem:* começa já. *Custo:* migração em tabelas centrais mais tarde, com risco de esquecer alguma tabela.
- **Se eu não decidir:** a Fase 1 começa com um schema que será alterado justamente nas tabelas mais usadas.
- **Recomendação:** A. São poucas colunas, e o 05 §6.5–6.6 já descreve o comportamento, então a proposta sai em uma página.
- **Pergunta para mim:** quer que eu proponha as colunas de sincronização para aprovar antes da Fase 1 (A) ou deixa para a fase do app do técnico (B)?
- **Docs afetados:** 03 (§2 das tabelas sincronizadas, §2.12 E8–E10), 05 §6.5–6.6, pendencias.md.

### [B-04] Como o Better Auth se liga a `app_user`, à auditoria e à RLS (PEND-T02)

- **Em uma frase:** não está definido como as tabelas do Better Auth se ligam a `app_user` nem se elas passam pelo trigger de auditoria e pela RLS, e do jeito que os docs estão escritos o login pode quebrar.
- **Por que aparece:**
  - 03 §2.1: "senha ..., sessões e verificação ficam nas tabelas do Better Auth, ligadas a `app_user` ... Forma da ligação: PEND-T02".
  - 03 §5.3: o trigger de auditoria roda em "**todas** as tabelas de negócio, exceto: `audit_log`, `notification`, `idempotency_key`, `password_reset_token`, `equipment_tag_counter`". As tabelas do Better Auth não estão na lista, e `password_reset_token` foi substituída por elas.
  - `audit_log.source` é obrigatório e vem de `SET LOCAL app.source`.
  - 05 MOD-05: "Toda escrita roda dentro de `withTransaction(ctx, fn)` ... Nenhuma escrita fora dessa função". O Better Auth, porém, grava sessões com a própria conexão, fora de `withTransaction`.
  - 05 §4.2: a RLS em `app_user` dá "se `app.actor_role` estiver vazio → `false` (falha fechada)". No login ainda não há ator.
- **Exemplo concreto:** um técnico faz login. O Better Auth cria a linha de sessão e lê o usuário. Se a tabela de usuário do Better Auth for a própria `app_user`, a leitura sem contexto volta vazia por causa da RLS e o login falha. Se o trigger de auditoria estiver na tabela de sessão, ele grava `source` vazio e a transação dá erro.
- **Opções:**
  - **A.** O Better Auth tem as próprias tabelas (`user`, `session`, `account`, `verification`, `twoFactor`), `app_user.auth_user_id` aponta para elas, e essas tabelas ficam **fora** do trigger de auditoria e da RLS. Login, logout e falhas vão para `security_event`, que já existe. *Vantagem:* nenhuma briga com a biblioteca, e a RLS fica só nas tabelas de negócio. *Custo:* há dois registros por pessoa, mantidos em sincronia pelo módulo de usuários.
  - **B.** O Better Auth usa `app_user` como tabela de usuário (mapeamento de campos). *Vantagem:* um registro por pessoa. *Custo:* exige exceções na RLS e no trigger para o caminho de login, que é exatamente o ponto mais sensível; e uma atualização da biblioteca pode quebrar o mapeamento.
- **Se eu não decidir:** a Fase 2 começa com uma escolha que define tabelas, chaves estrangeiras e políticas. Trocar depois significa refazer as migrações de usuário e os testes de RLS.
- **Recomendação:** A. Mantém a biblioteca no caminho padrão e a auditoria de acesso já tem a tabela certa (`security_event`); o spike S-04 confirma os nomes das tabelas.
- **Pergunta para mim:** tabelas do Better Auth separadas, fora da auditoria por trigger e da RLS (A), ou o Better Auth usando `app_user` (B)?
- **Docs afetados:** 03 (§2.1, remover `password_reset_token`, §5.3 lista de exceções, E5), 05 (§3.3, §4.2, MOD-05), 06 (SEG-15), pendencias.md.

### [B-05] Como gravar o contexto da transação: `SET LOCAL` ou `set_config` (SEG-31)

- **Em uma frase:** os docs 03 e 05 mandam usar `SET LOCAL` montando o texto, e o 06 diz para usar `set_config` com parâmetro, mas marca a troca como "ainda pendente".
- **Por que aparece:**
  - 03 §5.3 e 05 §4.2: "`SET LOCAL app.client_id = '<uuid do cliente>'`".
  - 06 §1, mudanças propostas: "Gravar o contexto com `SELECT set_config('app.client_id', $1, true)` ... `SET LOCAL` não aceita parâmetro; montar a string abre injeção de SQL (SEG-31)".
  - 06 §1 também diz: "**Ainda pendentes** (sem resposta): `set_config` no lugar de `SET LOCAL` (SEG-31)".
  - Pelas regras de prioridade, a IA de código não sabe qual dos dois vale.
- **Exemplo concreto:** a primeira função escrita na Fase 1 é `withTransaction`. Se ela concatena o id do usuário dentro de um `SET LOCAL`, um valor malformado vira SQL executado com os privilégios da aplicação.
- **Opções:**
  - **A.** `set_config(..., true)` com parâmetro, como no 06. *Vantagem:* mesmo efeito (vale só na transação) e sem injeção. *Custo:* nenhum.
  - **B.** `SET LOCAL` com texto e validação do formato antes. *Vantagem:* igual aos docs 03 e 05. *Custo:* depende de uma validação que um dia alguém esquece.
- **Se eu não decidir:** `withTransaction` é a base da auditoria e da RLS. Trocar depois exige revisar todos os testes de isolamento.
- **Recomendação:** A. É a mesma coisa para o banco e elimina uma classe inteira de falha.
- **Pergunta para mim:** aprova `set_config` com parâmetro no lugar de `SET LOCAL` (A)?
- **Docs afetados:** 03 §5.3, 05 §4.2 e MOD-05, 06 §1 (marcar como aplicada).

### [B-06] Quais tabelas recebem `client_id` copiado para a RLS (E7, spike S-05)

- **Em uma frase:** não está decidido se `visit`, `visit_report_version`, `pmoc_version` e `stored_file` ganham uma coluna `client_id` para a RLS do portal; isso muda o schema e as políticas.
- **Por que aparece:**
  - 05 §4.2 item 5: "**pode** desnormalizar `client_id` (preenchido por trigger, imutável) nas tabelas mais consultadas pelo portal (`visit`, `visit_report_version`, `pmoc_version`, `stored_file`). Decidir no spike S-05 pelo `EXPLAIN` [A VALIDAR]".
  - 03 §2.12, E7: "Quais tabelas desnormalizam: spike S-05 (PEND-T05)".
  - Não há fase definida para o S-05 (ver B-07).
- **Exemplo concreto:** um usuário do cliente abre a lista de relatórios. Sem `client_id` em `visit_report_version`, a política precisa ir de relatório para visita, para local e para cliente em cada linha. Se o S-05 mostrar que isso passa de 2 s (RNF-16), a coluna entra depois em tabelas que já têm dados e políticas escritas.
- **Opções:**
  - **A.** Decidir agora que as 4 tabelas recebem `client_id` (trigger, imutável). *Vantagem:* políticas simples e iguais, e nenhuma migração depois. *Custo:* uma coluna e um trigger a mais por tabela.
  - **B.** Rodar o spike S-05 antes de criar essas tabelas e decidir pelo resultado. *Vantagem:* decide com dados. *Custo:* o S-05 passa a ser o primeiro passo, antes do schema de negócio.
  - **C.** Não copiar e otimizar só se ficar lento. *Vantagem:* schema mínimo. *Custo:* retrabalho provável nas políticas e nos testes.
- **Se eu não decidir:** as políticas de RLS da Fase 2 são escritas de um jeito e podem ter de ser reescritas.
- **Recomendação:** A. O custo é pequeno, a política fica igual em todas as tabelas e o S-05 continua valendo para medir o desempenho.
- **Pergunta para mim:** copia `client_id` nas 4 tabelas já (A), roda o S-05 primeiro (B) ou não copia (C)?
- **Docs afetados:** 03 (4 tabelas, E7), 05 §4.2 item 5, ADR-05, pendencias.md (PEND-T05).

### [B-07] O que são a "Fase 1" e a "Fase 2" da implementação

- **Em uma frase:** nenhum documento define as fases de implementação, e "Fase 2" já é usada nos docs com outro sentido, que é "depois do MVP".
- **Por que aparece:**
  - A sua mensagem fala em "Fase 1 (fundação)" e "Fase 2 (autenticação e permissões)".
  - Nos docs, "Fase 2" é a etapa pós-MVP. Exemplos: 00 §6, coluna "Fase 2"; 00 RNF-03, "**Nível 2 (Fase 2)**"; 04 DFT-07, "é parte do nível 2, Fase 2".
  - O CLAUDE.md lista a stack e as pastas, mas não traz uma ordem de construção.
  - O único "ordem de implementação" é o do monitoramento (06 §6.6).
- **Exemplo concreto:** você pede à IA de código para "implementar a Fase 2". Pelos docs, ela pode entender que deve fazer o offline nível 2 e o push do PWA, que estão fora do MVP.
- **Opções:**
  - **A.** Criar `docs/07-plano-de-implementacao.md` com fases numeradas com outro nome (por exemplo "Etapa 1 fundação", "Etapa 2 autenticação e permissões"...), o que cada uma entrega, quais spikes vêm antes e o critério de pronto. *Vantagem:* elimina a colisão e dá à IA um escopo fechado por etapa. *Custo:* um documento a mais, curto.
  - **B.** Manter "Fase 1/Fase 2" e renomear o pós-MVP para "Pós-MVP" em todos os docs. *Vantagem:* usa o seu vocabulário. *Custo:* mexe em dezenas de linhas nos docs 00–06.
- **Se eu não decidir:** cada pedido à IA de código depende de interpretação, e o risco de ela construir algo fora do MVP é real.
- **Recomendação:** A. Muda um só arquivo e deixa as fases com escopo e critério de pronto explícitos.
- **Pergunta para mim:** crio o plano de implementação com "Etapas" (A) ou renomeio o pós-MVP em todos os docs (B)?
- **Docs afetados:** novo `docs/07-plano-de-implementacao.md`; CLAUDE.md (apontar para ele); glossario (termo "Etapa").

Ficaram de fora: nenhum. Há só 7 bloqueantes.

---

## 2. IMPORTANTES

### [I-01] Duração da sessão por perfil (SEG-10) — antes da Etapa 2 (autenticação)

- **Em uma frase:** a duração das sessões (12 h web, 30 dias no PWA) está proposta, mas marcada como "sem resposta", e o padrão da biblioteca é 7 dias.
- **Por que aparece:**
  - 06 SEG-10: "web ADM e CLIENTE: expira após **12 h sem uso**, limite absoluto de **7 dias** [A VALIDAR]; PWA do técnico: **30 dias**".
  - 06 §1 lista "sessão do Better Auth explícita (SEG-10)" como ainda pendente.
  - 05 §3.3 ainda não diz se o Better Auth aceita duração por perfil (spike S-04).
- **Exemplo concreto:** um técnico abre o PWA no campo depois de 8 dias sem uso. Com o padrão da biblioteca, ele precisa digitar a senha de novo sem sinal; com 30 dias, não precisa.
- **Opções:**
  - **A.** Aprovar os valores de SEG-10 como estão. *Vantagem:* a Etapa 2 configura direto. *Custo:* nenhum.
  - **B.** Definir outros valores. *Vantagem:* ajuste ao uso real. *Custo:* uma resposta a mais.
- **Se eu não decidir:** vale o padrão de 7 dias para todos, o que é diferente do que os docs prometem.
- **Recomendação:** A. Os valores seguem o uso descrito (técnico no campo, ADM no escritório).
- **Pergunta para mim:** aprova 12 h sem uso e limite de 7 dias na web, e 30 dias renováveis no PWA (A)?
- **Docs afetados:** 06 (SEG-10, §1), 05 §3.3.

### [I-02] Telas de autenticação sem desenho (TL-004 e TL-005) — antes da Etapa 2

- **Em uma frase:** a tela de configurar o TOTP do ADM e a tela "Meu perfil e sessões" foram decididas, mas não têm campos, rota nem textos, e o doc 04 proíbe a IA de inventá-los.
- **Por que aparece:**
  - 04 §4.5: "o doc 04 **não** as detalha: não há campos, estados nem rotas aprovadas. A IA de código **não** deve inventá-los".
  - Para TL-004 falta "Layout, rota, texto". Para TL-005 falta "Layout, rota, quais ações pedem reautenticação".
  - O RN-194 exige que o ADM sem TOTP só veja a TL-004.
- **Exemplo concreto:** no primeiro login de um ADM, o sistema precisa mostrar o QR code e os 10 códigos de recuperação. Sem a tela desenhada, a Etapa 2 não fecha o fluxo do ADM.
- **Opções:**
  - **A.** Eu desenho TL-004 e TL-005 no padrão das outras telas do 04 e você aprova antes da Etapa 2. *Vantagem:* segue a regra do doc 04. *Custo:* uma aprovação curta.
  - **B.** Autorizar a IA de código a seguir as telas padrão do plugin. *Vantagem:* rápido. *Custo:* textos e regras de reautenticação ficam sem revisão.
- **Se eu não decidir:** a Etapa 2 entrega login e permissões sem o segundo fator do ADM, que é MVP.
- **Recomendação:** A. São duas telas pequenas, e a regra de reautenticação da TL-005 é uma decisão de segurança.
- **Pergunta para mim:** desenho as duas telas para você aprovar (A) ou libero o padrão do plugin (B)?
- **Docs afetados:** 04 §4.5 e novo detalhe de TL-004 e TL-005; pendencias.md (PEND-D29).

### [I-03] Estrutura e tela do comprovante de visita (PEND-D21, D27, D29) — antes da etapa de execução da visita no app do técnico

- **Em uma frase:** o comprovante foi decidido, mas não há tabela para ele, e o lugar indicado (`document_signature`) não aceita quem não é usuário.
- **Por que aparece:**
  - 05 §6.9 coloca o comprovante em assinaturas.
  - 03 §8.2 Q1 diz: "Estrutura do comprovante (colunas em `document_signature` ...; ou tabela própria) proposta em PEND-D21".
  - Mas 03 `document_signature` exige "`signer_user_id` ... sim | Usuário `CLIENTE` `ATIVO`" e "trigger exige `app_user.role = 'CLIENTE'`".
  - 02 RN-189 diz que o signatário "não precisa ser usuário".
  - Se funciona sem internet é PEND-D27. A tela TL-206 não está desenhada (04 §4.5).
- **Exemplo concreto:** o porteiro do prédio assina no celular do técnico. Ele não tem usuário, então a linha em `document_signature` é rejeitada pelo banco.
- **Opções:**
  - **A.** Tabela própria `visit_receipt` (nome digitado, imagem da assinatura, data/hora, hash, aparelho). *Vantagem:* não mexe nas regras de assinatura do cliente. *Custo:* uma tabela a mais.
  - **B.** Afrouxar `document_signature` (`signer_user_id` opcional e um tipo novo). *Vantagem:* uma tabela só. *Custo:* enfraquece a trava "só CLIENTE assina", que é regra de negócio.
- **Se eu não decidir:** a etapa de execução da visita não consegue gravar o comprovante.
- **Recomendação:** A. Separa uma evidência de presença de uma assinatura de documento oficial, e mantém intacto o trigger de RN-122.
- **Pergunta para mim:** tabela própria para o comprovante (A) ou adaptar `document_signature` (B)? E o comprovante funciona sem internet: sim ou não?
- **Docs afetados:** 03 (nova tabela ou `document_signature`, §8.2 Q1, E6, `file_kind`), 05 §6.9, 04 §4.5 (TL-206), 02 RN-189.

### [I-04] Emissão síncrona × limite de tempo da Vercel (PEND-T01) — antes da etapa de emissão do PMOC

- **Em uma frase:** a meta é emitir um PMOC de 200 equipamentos em até 15 min de forma síncrona, mas não se sabe se a função da Vercel aguenta esse tempo.
- **Por que aparece:**
  - 00 RNF-16: "termina em até 15 min ... A meta de 15 min contra o limite de função da Vercel: PEND-T01".
  - 02 RN-188: emissão "**síncrona** (sem job, sem estado 'emitindo')".
  - 03 E13: "Reavaliar se PEND-T01 reprovar o limite de tempo".
- **Exemplo concreto:** o ADM emite o PMOC de um cliente com 200 equipamentos. Se a função é cortada no meio, nada é emitido (é tudo uma transação) e o ADM fica tentando sem conseguir.
- **Opções:**
  - **A.** Fazer o spike S-01 (gerar e assinar o PDF de 200 equipamentos) antes da etapa de emissão e decidir com o tempo medido. *Vantagem:* decide com dados. *Custo:* o spike precisa vir antes.
  - **B.** Já prever emissão em job com estado "emitindo". *Vantagem:* sem risco de corte. *Custo:* contraria a decisão A2 e acrescenta estado e tela.
- **Se eu não decidir:** a etapa de emissão pode ter de ser refeita como job.
- **Recomendação:** A. O maior cliente atual tem cerca de 50 equipamentos, então o caso de 200 é pessimista e provavelmente cabe.
- **Pergunta para mim:** o S-01 roda antes da etapa de emissão (A)?
- **Docs afetados:** 00 RNF-16, 02 RN-009 e RN-188, 03 E13, 05 (spikes), pendencias.md.

### [I-05] Escala: ~100 ou ~223 usuários (PEND-D23) — antes do spike S-05 e do dimensionamento

- **Em uma frase:** a DEC-34 diz ~100 usuários, mas os números que você informou somam ~223 usuários e ~200 clientes, e ainda não há uma decisão nova.
- **Por que aparece:**
  - 00 DEC-34: "~100 usuários no total ... (Os números de R2, ~223 usuários, não alteram esta DEC; ver PEND-D23.)".
  - 00 RNF-02: "~223 usuários (3 ADM, ~20 técnicos, ~200 de cliente), ~200 clientes e ~2.000 equipamentos; divergem da DEC-34".
- **Exemplo concreto:** o S-05 mede se a lista do portal responde em menos de 2 s. Com dados de teste para 100 usuários, a medida não vale para 200 clientes.
- **Opções:**
  - **A.** Atualizar a DEC-34 para os números de R2. *Vantagem:* testes e dimensionamento realistas. *Custo:* nenhum na arquitetura, que suporta essa escala.
  - **B.** Manter ~100. *Vantagem:* nenhuma mudança. *Custo:* testes de desempenho com números menores que os reais.
- **Se eu não decidir:** os spikes de desempenho medem o cenário errado.
- **Recomendação:** A. Os números de R2 são os reais, e a arquitetura não muda.
- **Pergunta para mim:** a DEC-34 passa a ser ~223 usuários, ~200 clientes e ~2.000 equipamentos (A)?
- **Docs afetados:** 00 (DEC-34, RNF-02, RNF-16), 05 (spikes S-01 e S-05), 06.

### [I-06] A DEC-11 ainda diz que NOK aponta corretiva (PEND-D28) — antes da etapa de registro de ocorrências e relatório

- **Em uma frase:** você decidiu que NOK é "não efetuado" e que defeito vira "OK + requer corretiva", mas o texto da DEC-11 continua o antigo, e a regra do projeto diz que DEC vence o resto.
- **Por que aparece:**
  - 02 RN-193: "A DEC-11 segue com o texto antigo ('NOK aponta corretiva') até a decisão nova: PEND-D28".
  - CLAUDE.md: "Prioridade em conflito: `DEC-xx` > demais regras".
- **Exemplo concreto:** a IA de código escreve o prompt do relatório. Seguindo a prioridade, ela trata todo NOK como necessidade de corretiva, contra a sua decisão F1.
- **Opções:**
  - **A.** Emendar a DEC-11 no 01 para o texto de R2 1.3. *Vantagem:* elimina o conflito. *Custo:* uma linha.
  - **B.** Deixar como está. *Vantagem:* nenhuma. *Custo:* a regra de prioridade aponta para o texto errado.
- **Se eu não decidir:** o relatório e o texto da IA podem sair com a regra antiga.
- **Recomendação:** A. A decisão já foi tomada; falta só o texto.
- **Pergunta para mim:** posso emendar a DEC-11 com o texto de R2 1.3 (A)?
- **Docs afetados:** 01 (DEC-11), 00, 02 (RN-077, RN-128, RN-193), pendencias.md.

### [I-07] Dados no Brasil e a IA fora do Brasil (PEND-L04) — antes da etapa da IA do relatório

- **Em uma frase:** não está respondido se os dados precisam ficar no Brasil, e a IA processa fora.
- **Por que aparece:**
  - 05 ARQ-Q4: "**Sem resposta (PEND-L04).** Aplicado: **preferível**: banco, arquivos e funções na região São Paulo. A IA processa fora do Brasil".
  - E também: "Obrigatório: a IA vira o bloqueio (ARQ-12)".
- **Exemplo concreto:** se for obrigatório, o envio dos dados da visita para gerar o texto do relatório não pode acontecer como está desenhado.
- **Opções:**
  - **A.** "Preferível", como aplicado. *Vantagem:* nada muda. *Custo:* nenhum.
  - **B.** "Obrigatório". *Vantagem:* atende a uma exigência, se ela existir. *Custo:* a IA do relatório precisa de outra solução.
- **Se eu não decidir:** a etapa da IA pode ser construída e depois barrada. O banco em São Paulo, já aplicado, não depende disso.
- **Recomendação:** A, a menos que um contrato de cliente exija. Não há norma citada nos docs que obrigue [A VALIDAR].
- **Pergunta para mim:** dados no Brasil são preferíveis (A) ou obrigatórios (B)?
- **Docs afetados:** 05 (ARQ-Q4, §3.12), 06 (§2.8), 00 RNF-05.7.

### [I-08] Canal de alerta ao operador (PEND-D25) — antes do go-live

- **Em uma frase:** você disse que não quer alertas por e-mail nem Slack, então não há nenhum canal para avisar que o sistema caiu.
- **Por que aparece:**
  - 06 §6: "Canais: **indefinidos** ... Até a decisão, **não configurar** e-mail nem Slack para alertas".
  - 06 TD-13 aceita o risco de "Um PRI-1 que ficou mais de 4 h sem ser visto".
- **Exemplo concreto:** a assinatura automática do RT falha de madrugada e as emissões do dia seguinte param. Ninguém fica sabendo até um cliente reclamar.
- **Opções:**
  - **A.** Alerta pelo app do Better Stack ou do Sentry no celular, no plano grátis. *Vantagem:* custo zero, sem e-mail nem Slack. *Custo:* instalar um app.
  - **B.** Sem alerta; olhar os painéis todo dia. *Vantagem:* nada a configurar. *Custo:* falha só é vista quando alguém olha.
- **Se eu não decidir:** o go-live acontece sem nenhum aviso de falha.
- **Recomendação:** A. Respeita o "sem e-mail/Slack" e fecha o risco do TD-13 sem custo [A VALIDAR: limites do plano grátis].
- **Pergunta para mim:** alerta por app no celular (A) ou só painéis (B)?
- **Docs afetados:** 06 (§6, TD-13, OP-Q3), pendencias.md.

---

## 3. MENORES

| # | Onde | O que |
|---|---|---|
| M-01 | 02 RN-185 | Cita "RF-22.5"; o certo é RF-21.5. |
| M-02 | 00 | CA-21.3 aparece duplicado. |
| M-03 | 05 §1.2 | Faixa "200–200". |
| M-04 | 04 E-11.6 | "Descreva a não conformidade"; NOK é "não efetuado" (F1). |
| M-05 | 04 TL-132 | Falta o campo "requer corretiva" (TL-203 tem). |
| M-06 | 03 §5.3 | Mascara `password_hash`, coluna que não existe mais. |
| M-07 | 06 SEG-15 | Cita `password_reset_token`, substituída pelo Better Auth. |
| M-08 | 06 SEG-51 | Aceita só JPEG; D4/RN-185 aceita JPEG, PNG e WebP. |
| M-09 | 06 INT-15 | `audit_seal` como MVP; 03 E2 diz "Depois". |
| M-10 | 05 §3.11 | Teste E2E com "finalizar offline", contra DFT-07 (nível 2). |
| M-11 | 05 §5 | Prevê `pwa/crypto.ts` com PIN; PIN ficou para "Depois". |
| M-12 | 06 SEG-01 | Texto do NIST ainda fala em 12 caracteres. |
| M-13 | 04 | Cabeçalho na versão 1.0 de 17/10, desatualizado. |
| M-14 | 00 §6 | "Dois fatores: fase futura" ao lado do TOTP do ADM no MVP. |
| M-15 | CLAUDE.md, glossario | Citam `perguntas-revisao.md` e `perguntas-pendentes.md`, que não existem. |

---

## 4. Entregas finais

### 4.1 Resumo de uma tela

| Nível | Quantidade |
|---|---|
| BLOQUEANTE | 7 |
| IMPORTANTE | 8 |
| MENOR | 15 |

Os 3 mais urgentes:

1. **B-01**: o arquivo de pendências não existe, e o CLAUDE.md manda parar em cada item que está nele.
2. **B-04**: a ligação entre o Better Auth e `app_user` decide se o login funciona com a RLS e a auditoria por trigger.
3. **B-03**: as colunas de sincronização definem o formato das tabelas centrais (`visit`, `occurrence_record`).

### 4.2 Ordem para responder

1. **B-01** (arquivo de pendências): os outros itens se registram nele.
2. **B-07** (etapas): define o que entra na Etapa 1 e na Etapa 2 e em que etapa cai cada IMPORTANTE.
3. **B-05** (`set_config`): resposta de uma palavra, base de `withTransaction`.
4. **B-02** (nomes propostos): resposta de uma palavra, libera as migrações.
5. **I-05** (escala): precisa vir antes de B-06, porque os números alimentam o S-05.
6. **B-06** (`client_id` copiado): depende da escala, se você escolher rodar o S-05 primeiro.
7. **B-03** (colunas de sincronização): depende de B-01, porque a proposta vai para o arquivo de pendências.
8. **B-04** (Better Auth): depende de B-05 e de B-06, porque mexe na mesma RLS e no mesmo trigger.
9. **I-01** e **I-02** (sessão e telas de autenticação): antes da Etapa 2.
10. **I-03**, **I-04**, **I-06**, **I-07**: antes das etapas que os usam, conforme o plano de B-07.
11. **I-08**: antes do go-live.

### 4.3 Coisas que parecem problema mas não são

- **Contrato com vários PMOCs:** o 01 §9.2 foi corrigido para "Contrato 1→1 PMOC com versões" (D-02).
- **NOK com dois sentidos:** decidido em F1 (NOK = não efetuado; defeito = OK + "requer corretiva"). Só falta o texto da DEC-11 (I-06).
- **Emissão síncrona sem job:** decisão A2. O limite de tempo é um teste (I-04), não uma contradição.
- **Offline nível 2 ausente do MVP:** decisão A1, Fase pós-MVP. O nível 1 está desenhado.
- **MFA só para o ADM:** decisão R2 1.2 b; TECNICO e CLIENTE ficam para depois de propósito.
- **Senha mínima de 8:** decisão B6. A observação do NIST (PEND-T07) é um aviso, não uma pendência que trava.
- **ART obrigatória ao salvar o contrato:** decisão B8.
- **Sem `tenant_id`:** DEC-34, empresa única. Não muda nem com ~223 usuários.
- **Normas sem fonte:** a decisão C12 manda não usar periodicidade ou artigo sem fonte, e os itens estão marcados [A VALIDAR].
- **Situação do certificado do RT sem coluna:** é calculada pela data de validade, por desenho.
- **Qualidade do ar:** fora do escopo, por decisão.
- **Perfil fixo do usuário (PEND-D14):** a leitura aplicada (opção a) é a mais restritiva; se mudar, só se libera uma ação, sem mudar o schema.
- **Q2 e Q3 (cliente vê todos os locais; qualquer usuário do cliente assina):** há resposta padrão adotada no 00. Só mudariam o schema se você mudasse a resposta.
- **Região do banco (PEND-L04):** o padrão aplicado, São Paulo, atende tanto "preferível" quanto "obrigatório". Só a IA depende da resposta (I-07).
- **Retenção (PEND-L01):** já está tratada como "sem expurgo automático" (A8). Não trava código, só proíbe criar o expurgo.

### 4.4 Veredito

**Ainda não posso iniciar a Etapa 1, por causa de B-01 e B-07.** Hoje a regra do CLAUDE.md manda parar em itens que estão num arquivo inexistente, e as etapas não estão definidas.

**Posso iniciar a Etapa 1 depois de responder 6 itens:** B-01, B-02, B-03, B-05, B-06 e B-07. A Etapa 2 exige também B-04, I-01 e I-02. Quatro desses (B-02, B-05, B-06 e I-01) se respondem com uma letra.

---

## 5. Decisões aplicadas em 27/10/2026 (AF-01 a AF-20)

Respostas do usuário: bloqueantes 1-c, 2-a (se não gerar conflito), 3-a, 4-a, 5-a, 6-a, 7-a; importantes 1 a 7-a, 8-b. Sobre nomes de tabelas, colunas e variáveis, o usuário delegou a escolha, com a condição de não gerar conflito, bug ou inconsistência. Onde a resposta não cobria um detalhe, a decisão foi tomada com o padrão mais simples e coerente com os docs, e está marcada como "detalhe decidido na aplicação".

| ID | Decisão | Origem | Onde foi aplicada |
|---|---|---|---|
| AF-01 | O arquivo `docs/pendencias.md` e os IDs `PEND-*` foram abandonados. Cada pendência virou uma decisão AF ou um item da §6. Os arquivos de perguntas das rodadas 1 e 2 também não existem; as respostas já estavam aplicadas nos docs. | B-01 opção C | Todos os docs; CLAUDE.md; glossário |
| AF-02 | Nomes confirmados: `requires_photo` (`activity_template` e `pmoc_activity`), `requires_corrective`, `renewal_confirmed_at`, `renewal_confirmed_by_user_id` e `PENDENCIA_CANCELADA`. Conflito encontrado e corrigido: a RN-192 dizia `renewal_confirmed_by`; ficou `renewal_confirmed_by_user_id`, como no doc 03 e na convenção de FK. | B-02 opção A | 02 RN-091, RN-185, RN-192, RN-193; 03 |
| AF-03 | Sincronização offline: tabela `device` (aparelho, com itens pendentes informados pelo app) e tabela `sync_review_item` (nome provisório era `unapplied_sync_record`; trocado porque ela guarda também itens aplicados que o ADM precisa conferir). Hora do aparelho em colunas próprias (`device_updated_at`, `device_started_at`, `captured_at`, `device_signed_at`). `base_row_version` **não** vira coluna: vai em cada operação e é comparada com `row_version`. | B-03 opção A (detalhes decididos na aplicação) | 03 §2.7, §2.8, §2.11, §4; 02 §11.2; 05 §6; 04 TL-100 |
| AF-04 | Better Auth com tabelas próprias `auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_two_factor`, `auth_rate_limit`, ligadas por `app_user.auth_user_id`; fora do trigger de auditoria e sem RLS; eventos de acesso em `security_event`. Saem `password_reset_token` e `app_user.last_login_at`. Ganchos que leem `app_user` usam contexto `SISTEMA`. | B-04 opção A | 03 §2.1, §5; 04 FL-01; 05 §3.3, §4.2; 06 SEG-15, SEG-24 |
| AF-05 | Contexto da transação gravado com `set_config(..., true)` e parâmetros; nunca texto de `SET LOCAL`. Leituras também passam por `withTransaction`. | B-05 opção A | 03 §5.3; 05 MOD-05, §4.2; 06 §1; CLAUDE.md |
| AF-06 | `client_id` desnormalizado em `pmoc_version`, `visit`, `visit_report_version`, `stored_file` e `visit_receipt`. O spike S-05 só mede o desempenho. | B-06 opção A | 03; 05 §4.2 |
| AF-07 | Plano de construção em **Etapas** no novo `docs/07-plano-de-implementacao.md`. "Fase 2" nos docs continua significando "depois do MVP". | B-07 opção A | Doc 07; CLAUDE.md; glossário; 00 cabeçalho |
| AF-08 | Sessão: web ADM e CLIENTE 12 h sem uso e 7 dias no máximo; PWA 30 dias renováveis. | I-01 opção A | 06 SEG-10; 05 §3.3, ARQ-06 |
| AF-09 | Telas da 04 §4.5 desenhadas: TL-004, TL-005, TL-206, TL-007, TL-207 (envios pendentes), blocos de sincronização no TL-100 e TL-140 (pedidos de titular). A verificação pública é só pelo código no MVP; o limite de 30 por hora por IP foi adotado. | I-02 opção A (TL-206, TL-007, TL-207 e TL-140 desenhadas junto, para não deixar tela sem desenho) | 04 §4.0, §4.5; 06 INT-14 |
| AF-10 | Comprovante de visita em tabela própria `visit_receipt` (não em `document_signature`). Funciona sem internet como o resto do nível 1, sem cifra própria (PIN é "Depois"), apagado do aparelho após envio confirmado; PDF gerado no servidor ao receber. ADM vê em TL-131; cliente, em TL-301. | I-03 opção A; o "funciona offline" foi decidido na aplicação | 02 RN-189; 03 §2.11; 04 TL-206; 05 §6.9 |
| AF-11 | Emissão síncrona: cumprir a meta de 15 min significa terminar dentro de 800 s (limite da função). O spike S-01 roda antes da Etapa 4; o plano B (geração em partes) só entra se reprovar. | I-04 opção A | 00 RNF-16; 02 RN-009, RN-188; 05; 06 DSP-07, DES-08 |
| AF-12 | DEC-34 emendada: ~223 usuários (3 ADM, ~20 técnicos, ~200 de cliente), ~200 clientes, ~2.000 equipamentos, maior cliente ~50; empresa única. | I-05 opção A | 00 DEC-34, RNF-02, RNF-16; 05 §1.2 |
| AF-13 | DEC-11 emendada: `OK` = preventiva executada; `NOK` = atividade não efetuada, com observação; problema achado = `OK` + "requer corretiva" com observação. A corretiva não é gerada no sistema: o relatório aponta a necessidade e **o cliente decide** se faz, quando e com quem. | I-06 opção A, com a observação do usuário | 01 DEC-11; 00 RF-24; 02 RN-077, RN-128, RN-193 |
| AF-14 | Dados no Brasil: **preferível**, não obrigatório. Banco, arquivos e funções em São Paulo; a IA processa fora. | I-07 opção A | 00 RNF-05; 05 ARQ-Q4; 06 ARQ-Q4 |
| AF-15 | Sem alerta ativo no MVP (nem e-mail, nem Slack, nem app): o operador consulta os painéis. ARQ-15 deixa de ser usado. | I-08 opção B | 05 §7.6, ARQ-15; 06 §6.4, TD-13, OP-Q3 |
| AF-16 | Detalhes antes pendentes: ART em texto livre sem validação de formato; perfil fixo para qualquer usuário (para mudar, inativa e cria outro); logo do sistema como arquivo estático no repositório e logo da empresa em `stored_file`; tabelas `standard_text` (sem tela; versão nova por migração de dados) e `data_subject_request`. | Delegação do usuário (nomes e detalhes) | 02 RN-176, RN-179; 03 §2.11, E15–E17; 04 TL-140 |
| AF-17 | Fotos: o aparelho converte qualquer foto aceita (JPEG, PNG, WebP, HEIC) para JPEG, lado maior 1600 px, qualidade 0,7; uma foto por requisição; HEIC que o navegador não abre é recusado (conferido no S-06). | Delegação do usuário | 00 RNF-11; 02 RN-185; 06 SEG-51 |
| AF-18 | `job_run` em tabela própria (sem reaproveitar tabelas internas do pg-boss); limites de uso em `auth_rate_limit` (login e TOTP), `rate_limit_counter` (demais) e `visit_report_version.ai_generation_count` (3 por versão). | Delegação do usuário | 03 §2.9, §2.11, E3, E14 |
| AF-19 | Senha mínima de 8 mantida (B6), com recusa de senha vazada ou óbvia (SEG-02) e bloqueio (SEG-07); risco frente ao NIST aceito. Validador PAdES confirmado no S-02. | Delegação do usuário | 05 §3.3; 06 §1.2.1 |
| AF-20 | Propostas técnicas do doc 06 que estavam "sem resposta" adotadas: J-07 encerra ao esvaziar a fila; logs da Vercel de 1 dia com histórico no banco e no Sentry; metas da 06 §4.1 e §5.1. `audit_seal` (INT-15 a INT-18) confirmado como **Depois**. | Delegação do usuário | 05 J-07, §7.6; 06 §1, INT-15 a INT-18 |

Itens menores M-01 a M-15: todos corrigidos nos docs de origem.

De onde veio cada antigo `PEND` (para quem achar o ID em algum texto antigo):

| Antigo | Agora | Antigo | Agora |
|---|---|---|---|
| PEND-D13 | AF-16 | PEND-L01 | §6 (retenção) |
| PEND-D14 | AF-16 | PEND-L02 | §6 (CPF, cargo ou localização no comprovante só com decisão nova) |
| PEND-D20 | AF-16 | PEND-L04 | AF-14 |
| PEND-D21 | AF-03, AF-10, AF-16, AF-18 | PEND-L05 | §6 (ME/EPP) |
| PEND-D23 | AF-12 | PEND-T01 | AF-11 |
| PEND-D24 | §6 (itens de advogado) | PEND-T02 | AF-04 |
| PEND-D25 | AF-15 | PEND-T03 | AF-17 |
| PEND-D26 | AF-02 | PEND-T04 | AF-19 |
| PEND-D27 | AF-10 | PEND-T05 | AF-06 |
| PEND-D28 | AF-13 | PEND-T06 | AF-18 |
| PEND-D29 | AF-09 | PEND-T07 | AF-19 |

## 6. O que continua aberto (nenhum item trava a Etapa 1 nem a Etapa 2)

| Item | Padrão que o código segue até a resposta | Precisa estar resolvido antes de |
|---|---|---|
| Prazos de retenção (OP-Q2) [A VALIDAR – advogado] | Nada é apagado automaticamente (A8, RN-191). Proposta: 5 anos após o fim do contrato. | Implementar qualquer expurgo (não está em nenhuma etapa) |
| Empresa é ME/EPP? (OP-Q1) | Prazos normais da LGPD, os mais curtos. | Go-live (Etapa 10) |
| Itens `[A VALIDAR – advogado]`: política de privacidade, termo de uso, cláusula de aceite no contrato (GL-30, GL-31), valor jurídico do comprovante | Padrão conservador de cada doc; textos provisórios. O usuário disse que não precisa de advogado (R2 bloco 4), mas cada item só muda quando ele assumir por escrito. | Go-live (Etapa 10) |
| Textos padrão: recomendações do PMOC (P2), aceite da assinatura (P5), termo do comprovante | Texto provisório inserido por migração de dados. | Go-live (Etapa 10) |
| CPF, cargo ou localização no comprovante | Não coletar (R2 2.9 a). Só muda com decisão nova. | — |
| Confirmações técnicas dos spikes S-01 a S-06 | Seguir o desenho dos docs; se um spike reprovar, parar e perguntar. | A etapa indicada no doc 07 |
| Demais `[A VALIDAR]` pontuais nos docs (textos de tela, limites, prazos de link) | Implementar como descrito, isolado em configuração (CLAUDE.md, "Sempre"). | — |

## 7. Novo veredito

**Posso iniciar a Etapa 1 (a sua "Fase 1", fundação) agora.** Não há bloqueante aberto: o schema completo, os nomes, o contexto da transação, a ligação com o Better Auth e o isolamento por cliente estão definidos nos docs.

**A Etapa 2 (autenticação e permissões) também está liberada no papel.** Ela depende só de dois testes técnicos que rodam no começo dela: S-04 (Better Auth com as tabelas `auth_*`, TOTP do ADM e sessão por perfil) e S-05 (RLS com `set_config` no pooler do Supabase). Se um deles reprovar, eu paro e trago a decisão.

