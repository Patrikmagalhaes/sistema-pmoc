# Glossário do Sistema PMOC

> **Versão:** 1.2 – 27/10/2026 (decisões da auditoria final AF-01 a AF-20; fim dos IDs `PEND`; termos "Etapa" e "Fase 2")
> **Base:** `pmoc/01-analise-pmocs-existentes.md`, `docs/00-escopo-prd.md`, `docs/02-regras-de-negocio.md`, `docs/03-modelo-de-dados.md`, `docs/04-fluxos-e-telas.md`.
> **Leitor principal:** IA de código. Use o termo exatamente como está aqui em nomes de tela, mensagens e testes. Em caso de divergência, valem os docs de origem citados na coluna Fonte.

## Convenções

| Item | Significado |
|---|---|
| Termo | Nome usado nos documentos e na interface (português). |
| Definição | Curta. Quando não vem dos arquivos, a coluna Fonte diz **Conhecimento técnico**. |
| Como aparece no sistema | Tabela/coluna do doc 03 (`tabela.coluna`), valor de enum (`VALOR`), tela (`TL-xxx`), fluxo (`FL-xx`) ou regra (`RN-xxx`, `RF-xx`). "Título de atividade" = texto de `activity_template.title` vindo dos PDFs de referência; a carga inicial desses títulos é [A VALIDAR] (RF-08.6). |
| Fonte | De onde veio a definição. `Análise` = `01-analise-pmocs-existentes.md`; `PRD` = doc 00; `doc 02/03/04` = demais. |
| **Conhecimento técnico** | Definição de conhecimento técnico geral de HVAC, norma ou TI, que **não** está nos arquivos. Serve para entender o termo; **não** cria regra. |
| **[A VALIDAR]** | Mesmo sentido dos outros docs: proposta sem fonte, a confirmar. |
| Ordem | Alfabética, ignorando acentos e maiúsculas. |

## 1. Prefixos de ID usados nos documentos

| Prefixo | Significado | Onde é definido |
|---|---|---|
| `A`, `B`, `C`, `D` + nº (ex.: `A8`, `B12`) | Ambiguidade, dado inválido, erro do Anexo 1 e dado ausente encontrados nos PDFs antigos | Análise §7 |
| `DEC-xx` | Decisão do usuário (não alterar sem nova decisão) | Análise §8 (DEC-01 a 32); PRD §1.3 (DEC-33 a 42) |
| `P1`–`P7`, `Q1`–`Q9` | Pendências e perguntas abertas | Análise §10; PRD §10 |
| `RF-xx`, `CA-xx.y` | Requisito funcional e seu critério de aceite | PRD §7 |
| `RNF-xx` | Requisito não funcional | PRD §8 |
| `RN-xxx` | Regra de negócio | Doc 02 |
| `D-xx` | Decisão estrutural pendente (adotada a opção recomendada "a") | Doc 02 §10.1 |
| `DM-xx` | Decisão de modelagem de dados | Doc 03 §8.1 |
| `HM-x`, `VP-x`, `VR-x`, `EL-x` | Regras de histórico de manutenção, versões do PMOC, versões do relatório e exclusão lógica | Doc 03 §5.4, §6 |
| `FL-xx`, `E-xx.y` | Fluxo e erro `y` do fluxo `xx` | Doc 04 §3 |
| `TL-xxx` | Tela (`0xx` comuns, `1xx` ADM, `2xx` técnico, `3xx` cliente) | Doc 04 §4 |
| `UF-xx`, `UL-xx`, `PW-xx` | Padrões de formulário, de lista e do PWA | Doc 04 §1 |
| `DFT-xx` | Decisão em aberto sobre fluxos e telas | Doc 04 §7 |
| `ADR-xx`, `ARQ-xx`, `ARQ-Qx`, `S-xx` | Decisão de arquitetura; item de arquitetura a validar; pergunta de arquitetura; spike técnico | Doc 05 §9, §10 |
| `MOD-xx` | Regra de módulo do monolito. **Antes `MM-xx`**, renomeado em 21/10/2026 porque colidia com a periodicidade `MM` | Doc 05 §2 |
| `MG-xx`, `OF-xx`, `SD-xx`, `J-xx`, `SPOF-xx` | Migração de banco; princípio offline; segurança dos dados no aparelho; job agendado; ponto único de falha | Doc 05 §3.9, §6, §7 |
| `RSK-xx` | Risco do projeto. **Antes `RT-xx`**, renomeado em 21/10/2026 porque colidia com RT (responsável técnico) | Doc 05 §10 |
| `CF-xx` | Regra de conflito de sincronização. Movida de 05 para 02 §11.2 em 21/10/2026, **mesmos IDs** | Doc 02 §11.2 |
| `SEG-xx`, `LG-xx`, `INT-xx`, `DSP-xx`, `DES-xx`, `OBS-xx`, `FIN-xx`, `GL-xx`, `INC-xx`, `TD-xx`, `AM-xx`, `OP-Q` | Segurança, LGPD, integridade, disponibilidade, desempenho, observabilidade, custos, go-live, incidentes, trade-offs, ameaças e abuso, perguntas da rodada | Doc 06 |
| `PRI-1` a `PRI-3` | Prioridade de alerta ou incidente. **Antes `P1`–`P3`**, renomeado em 21/10/2026 porque colidia com as pendências `P1`–`P7` do PRD | Doc 06 §6.4, §8 |
| `DR-1` a `DR-9` | Cenário de desastre e recuperação. **Antes `D1`–`D9`**, renomeado em 21/10/2026 porque colidia com `D1`–`D10` da análise e `D-xx` do doc 02 | Doc 06 §4.3 |
| `AF-xx` | Decisão da auditoria final de 27/10/2026. Substitui os antigos IDs `PEND-Dxx`, `PEND-Lxx` e `PEND-Txx`, que **não existem mais** (o arquivo `docs/pendencias.md` foi abandonado, AF-01). O que continua aberto está em `docs/auditoria-final.md` §6 | `docs/auditoria-final.md` §5 |
| `Etapa n` | Etapa de construção do MVP (Etapa 1 = fundação, Etapa 2 = autenticação e permissões...) | `docs/07-plano-de-implementacao.md` |
| "decisão R2 x.y" (ex.: "decisão R2 1.2") | Resposta do usuário na rodada 2 (21/10/2026, à noite) ao item x.y da lista de perguntas daquela rodada. "R2 bloco 3" = números de escala. A lista original não está no projeto; as respostas já estão aplicadas nos docs 00–06 | Docs 00–06, onde cada decisão é citada |
| Letra + nº com a palavra "decisão" (ex.: "decisão B6", "D7.1") | Resposta do usuário em 21/10/2026 (rodada 1) à lista de perguntas de revisão. **Não** é o `B6` da análise §7. A lista original não está no projeto; as respostas já estão aplicadas nos docs 00–06 | Docs 00–06, onde cada decisão é citada |

## 2. Termos de A a Z

### A

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| A1 (certificado) | Certificado digital ICP-Brasil guardado em arquivo protegido por senha. Permite que o servidor assine sozinho. | `rt_certificate.certificate_type = 'A1'`; `pmoc_version.rt_signature_method = 'AUTOMATICA_A1'`; upload em TL-103. Único tipo do MVP. | Análise P4; RNF-09; doc 03 |
| A3 (certificado) | Certificado digital em token ou cartão. Não permite assinatura automática pelo servidor. | Valor `A3` em `certificate_type` e `UPLOAD_MANUAL` em `rt_signature_method` são [A VALIDAR]; fluxo alternativo: RT assina fora e o ADM sobe o PDF (RF-13.3). | Análise P4; doc 03 §8.2 |
| Aceite (texto do aceite) | Texto que o usuário do cliente lê e confirma ao assinar um documento. | `document_signature.acceptance_text` e `acceptance_text_version`; diálogo TL-307. Texto: P5 [A VALIDAR]. | DEC-24; RNF-08; RN-123 |
| ADM | Perfil da equipe administrativa da empresa executora, com acesso total. | `app_user.role = 'ADM'`; área web `/adm`; telas TL-100 a TL-134. Nunca assina documento do cliente (RN-133). | PRD §3; DEC-07 |
| Agenda | Visão das visitas por data e técnico. | ADM: TL-130 (lista e calendário). Técnico: TL-200 "Minhas visitas". Cliente: TL-301 "Cronograma de visitas". | RF-18.7; RF-20; RF-32 |
| Agendamento flexível | Possibilidade de mudar data, horário e técnico da visita quantas vezes for preciso antes de ela começar. | `visit.scheduled_date`, `scheduled_time`, `technician_user_id`; histórico em `visit_schedule_change`; FL-10, TL-131. | DEC-35; RF-18; RN-069 a RN-072 |
| Ambiente (localização interna) | Onde o equipamento fica dentro do local (ex.: "Consultório 03"). No PDF do Frigus aparecia com o rótulo `Local:`, que **não** é a entidade Local deste sistema. | `equipment.location_description` (obrigatório). | Análise §3.2; RF-09.2; CA-09.3 |
| Anexo 1 | Parte do PMOC com o texto da Portaria MS 3.523/1998 transcrito. | Texto padrão fixo no PDF (RF-12.2). Fidelidade ao texto oficial e correção dos erros C1–C3: P3 [A VALIDAR]. | Análise §1.1, §7 C; DEC-19 |
| Anexo 2 | Parte do PMOC com uma ficha histórico por equipamento. | Ver **Ficha histórico**. | Análise §1.5; RF-12.2 |
| ART | Anotação de Responsabilidade Técnica: registro no CREA que identifica o profissional responsável por um serviço de engenharia. | `contract.art_number`: obrigatório ao salvar o contrato (RN-176, DM-09; decisão B8 de 21/10/2026); RN-007 e fica como garantia redundante. Só o número; sem PDF anexo (DEC-15). P1 resolvida. | Conhecimento técnico; DEC-15; DEC-28 |
| Assinatura do RT | Assinatura digital do PMOC com o e-CPF ICP-Brasil do RT, aplicada automaticamente na emissão. | `pmoc_version.rt_signed_at`, `rt_certificate_id`, `rt_signature_method`; RN-120. | DEC-16; DEC-23; RF-13 |
| Assinatura eletrônica simples | Aceite com identificação do usuário logado, data, hora e IP. Usada pelo cliente no PMOC e nos relatórios. | `document_signature` (imutável); `document_type` = `PMOC_VERSAO` ou `RELATORIO_VERSAO`; TL-307. Uma assinatura basta (RN-124). | DEC-24; RNF-08; RN-122 a RN-125 |
| Atividade | Item do checklist de manutenção de um tipo de equipamento. Tem só título, sem procedimento. | Biblioteca: `activity_template`. Plano do PMOC: `pmoc_activity` (cópia). Telas TL-105 e TL-120. | DEC-08; DEC-27; RF-08 |
| Atrasada | Rótulo de visita `AGENDADA` com data passada ou `EM_ANDAMENTO` iniciada antes de hoje. Não é estado gravado. | Calculado (RN-109); aparece no painel TL-100 e na agenda. | RN-109; doc 04 §1.5 |
| Auditoria (trilha de auditoria) | Registro de quem alterou o quê, quando, valor anterior e novo. | Tabela `audit_log` (somente inclusão, preenchida por trigger); enums `audit_action`, `audit_source`. Sem tela de consulta no MVP. | RF-31; RNF-06; RN-092; doc 03 §5.3 |

### B

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Bandeja de condensado | Recipiente sob a serpentina do evaporador que recolhe a água condensada e a leva ao dreno. | Título de atividade do Splitão ("Limpeza da bandeja, da mangueira e do ralo de condensado"). | Conhecimento técnico; análise §4.5 |
| Biblioteca | Cadastro padrão de tipos de equipamento, grupos e atividades com periodicidade padrão. Alterar a biblioteca não muda PMOCs já criados. | `equipment_type`, `equipment_group`, `activity_template`; TL-104 e TL-105; FL-03. Carga inicial com os tipos da análise §4: [A VALIDAR] (RF-08.6). | DEC-07; DEC-08; RN-003 |
| BTU/h | Unidade de capacidade térmica: British Thermal Unit por hora. Nos PDFs do Frigus aparece só "BTU", sem "/h". | Unidade padrão de `equipment.capacity_unit` (`DEFAULT 'BTU/h'`) [A VALIDAR] (RN-052). | Conhecimento técnico; análise A9 |
| Built-in | Grupo de evaporadora embutida no forro, com distribuição de ar por dutos. | Valor de `equipment_group.name` (Fancoletes e VRF Evaporador nos PDFs: "Built-in" e "BUILT - IN"). | Conhecimento técnico; análise §3.3 |
| Bulbo seco (temperatura de) | Temperatura do ar medida por termômetro comum, sem influência da umidade. | Aparece no título de atividade do Splitão. Natureza (`MEDICAO` ou `VERIFICACAO`) é definida pelo ADM no cadastro. | Conhecimento técnico; análise §4.5, §5 |

### C

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Cancelamento de contrato | Encerramento do contrato antes da data de fim, com data e motivo. | `contract.status = 'CANCELADO'`, `cancelled_on`, `cancellation_reason`; ação em TL-112; efeitos em RN-144. | D-08 a; RN-144; só `A_INICIAR` ou `VIGENTE` pode ser cancelado (decisão R2 2.6); motivo obrigatório |
| Capa | Primeira página do PMOC: cliente, título, vigência, cidade e data. | Gerada no PDF (RF-12.2); cidade da empresa e data de início por extenso (RN-011); `{TH}-{revisão}` quando houver (RN-010). | Análise §1.3 |
| Capacidade | Capacidade térmica nominal do equipamento. | `equipment.capacity` + `equipment.capacity_unit` (opcionais). O sistema não soma a capacidade total (RN-053). | Análise §3.2; RF-09.3 |
| Cassete | Grupo de split com evaporadora embutida no forro, com saída de ar em várias direções. | Valor de `equipment_group.name` (tipo Split). | Conhecimento técnico; análise §3.3 |
| CEP | Código de Endereçamento Postal, 8 dígitos. | `address_zip char(8)`, só dígitos; máscara `00000-000` só na exibição. | RF-05; RNF-07; doc 03 bloco [E] |
| Certificado do RT | Certificado e-CPF do RT guardado criptografado no sistema. | `rt_certificate` (um atual: `is_current`); estado **calculado na leitura** (decisão C9) a partir da validade: `VALIDO`, `A_VENCER` (≤ 30 dias, confirmado em R2 2.11), `VENCIDO`; TL-103. Vencido bloqueia emissão (RN-008). | DEC-23; RF-04.4; RN-153 |
| Cliente | Pessoa jurídica (CNPJ) proprietária da instalação. Nos PDFs do Frigus, "Cliente" era o nome fantasia da instalação. | `client`; telas TL-108 e TL-109. Também nome do perfil `CLIENTE` (ver **Usuário do cliente**). | DEC-17; PRD §4 |
| CNPJ | Cadastro Nacional da Pessoa Jurídica, 14 posições com dígito verificador. | `client.cnpj`, `executor_company.cnpj` (`char(14)`, sem máscara, `is_valid_cnpj`). Formato alfanumérico: DM-13 [A VALIDAR]. | DEC-17; RF-05; doc 03 |
| Código de verificação | Identificador aleatório (128 bits) impresso no PDF de PMOC e de relatório da visita, junto com a versão (`v{n}`). No MVP (decisão B7 a). | `pmoc_version.verification_code`, `visit_report_version.verification_code`; RN-187; INT-14, INT-25. Tela pública mínima "Verificar documento" no MVP (decisão R2 2.8 b). | Decisões B7 e D6; doc 06 |
| Código do local | Identificador curto do local, gerado pelo sistema e imutável, usado na TAG (ex.: `L012`). | `site.code`; regra de geração DM-19 (`L001`, `L002`…) [A VALIDAR]. | DEC-26; RF-06.3; RN-047 |
| Código TH | Código da proposta comercial (ex.: `TH12326`). Opcional e digitado. | `contract.th_code`; impresso na capa e no rodapé como `{TH}-{revisão}` só se informado (RN-010). | DEC-02; DEC-21 |
| Compressor | Componente que comprime o fluido refrigerante e o faz circular no ciclo de refrigeração. | Título de atividade ("Verificação do funcionamento do compressor"). | Conhecimento técnico; análise §4.4 |
| Comprovante de visita | Documento da visita assinado no local por um responsável presente (não precisa ser usuário). Não é o relatório da visita e não substitui a assinatura dele. Decisão A3 a, 21/10/2026. | RN-189; 05 §6.9; conteúdo mínimo: nome digitado, imagem da assinatura, data/hora e hash (decisão R2 2.9 a); tabela `visit_receipt` e tela TL-206; funciona sem internet (AF-10). | Decisão A3; doc 05 |
| Condensadora (condensador) | Unidade (geralmente externa) que rejeita para o ambiente o calor retirado pelo evaporador. | Tipo "VRF Condensador", grupo "Condensadora"; títulos de atividade ("Limpeza condensador"). | Conhecimento técnico; análise §3.3, §4.2 |
| Contrato | Vínculo da empresa executora com **um** local, com data de início, data de fim e nº de ART. Define a vigência do PMOC. | `contract`; `contract_status` = `A_INICIAR` (decisão A6), `VIGENTE`, `ENCERRADO`, `CANCELADO`; TL-112; FL-06. | DEC-03; DEC-06; RF-07; RN-142 |
| Corrente (elétrica) | Intensidade de corrente consumida pelo equipamento, em ampères (A). | Atividade de natureza `MEDICAO` com unidade `A`; valor em `occurrence_record.measured_value`. | Conhecimento técnico; DEC-10; RF-08.2 |
| CPF | Cadastro de Pessoas Físicas. | Não aceito como documento do cliente (DEC-17, CA-05.2). | DEC-17 |
| CREA | Conselho Regional de Engenharia e Agronomia, onde a empresa e o profissional são registrados. | `executor_company.crea_registration`. | Conhecimento técnico; análise §2.1 |
| Cronograma | Três usos: (1) seção 6 do PMOC, uma tabela por tipo com a periodicidade de cada atividade; (2) cronograma de ocorrências do contrato inteiro; (3) cronograma de visitas que o cliente vê. | (1) PDF, colunas `MM`, `MB`, `MT`, `MS`, `MA`; (2) tabela `occurrence`, gravada na 1ª emissão (DM-05); (3) TL-301. | Análise §1.4; RF-11; RF-32 |

### D

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Divisão de visita | Separar as ocorrências de uma visita em duas ou mais visitas do mesmo mês de referência. | `visit.origin = 'DIVISAO'`, `split_from_visit_id`; ação "Dividir visita" em TL-131. | RF-17.2 [A VALIDAR]; RN-062; DM-21 |
| Dreno | Tubulação que escoa a água condensada do evaporador. | Título de atividade ("Verificação do dreno"). | Conhecimento técnico; análise §4.3, §4.4 |

### E

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Etapa | Parte da construção do MVP, numerada (Etapa 1, Etapa 2...). Não confundir com "Fase 2". | Commits e tarefas: "Etapa 2"; escopo e critério de pronto no doc 07. | AF-07; doc 07 |
| e-CPF | Certificado digital ICP-Brasil de pessoa física. | Certificado do RT: `rt_certificate`; TL-103. | DEC-16; DEC-23 |
| Eletroduto | Tubo que protege e conduz a fiação elétrica. | Título de atividade ("Verificação dos estados dos eletrodutos"). | Conhecimento técnico; análise §4.1, §4.6 |
| Emissão do PMOC | Ato do ADM que gera o PDF, aplica a assinatura do RT, grava o cronograma e cria as visitas, na mesma transação. | PMOC `RASCUNHO` → `EMITIDO`; nova linha em `pmoc_version`; diálogo TL-121; FL-08. Pré-condições em RN-007. | RF-12; RN-007; RN-009 |
| Empresa executora | Empresa de manutenção que executa o PMOC. Existe só uma no sistema (hoje: Thermo Service). | `executor_company` (linha única, `singleton`); TL-102. | DEC-14; DEC-34; RF-04 |
| Equipamento | Unidade de climatização instalada em um local, com tipo, grupo, ambiente e TAG. | `equipment`; `active_status`; TL-111 (ADM), TL-306 (cliente). | DEC-18; RF-09 |
| Evaporador Monobloco | Tipo que, nos PDFs, reúne os aparelhos de janela (grupo "Tipo Janela"): unidade única com evaporador e condensador. | Valor de `equipment_type.name` (CSL). Usa a mesma lista de 14 atividades do Split. | Análise §3.3, §4.4; conhecimento técnico |
| Evaporadora (evaporador) | Unidade (geralmente interna) onde o fluido refrigerante absorve o calor do ar do ambiente. | Tipos "VRF Evaporador" e "Evaporador Monobloco"; títulos de atividade ("Limpeza evaporador com produto"). | Conhecimento técnico; análise §3.3 |
| Exclusão lógica | "Excluir" sem apagar: o registro some das telas mas fica no banco. | Bloco `[L]`: `deleted_at`, `deleted_by_user_id`, `deletion_reason`. Diferente de inativar (EL-3). | Doc 03 §5.4 |

### F

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Fase 2 | O que fica **depois do MVP** (ex.: offline nível 2, push do PWA, segundo fator para técnico e cliente). Não é uma etapa de construção do MVP. | Coluna "Fase 2" do PRD §6; nada disso é implementado no MVP. | PRD §6; AF-07 |
| Fan coil (fancolete) | Unidade terminal com ventilador e serpentina, geralmente alimentada por água gelada. Fancolete é o fan coil de pequeno porte. | Tipo "Fancoletes" nos PDFs (DOK, grupo Built-in). Cadastrado pelo ADM como `equipment_type`; sigla [A VALIDAR]. | Conhecimento técnico; análise §3.3, §4.1 |
| Ficha atualizada | PDF sem assinatura gerado sob demanda, com a ficha histórico refletindo os registros até a data do pedido. Não é nova versão do PMOC. | `pmoc_ficha_export`; botão "Baixar ficha atualizada" em TL-120 e TL-303. | RN-131 [A VALIDAR]; DM-16; VP-8 |
| Ficha histórico | Página por equipamento (Anexo 2) com uma linha por atividade e uma coluna por mês do contrato, em blocos de 12 meses. | Gerada de `occurrence` + `occurrence_record` (consulta doc 03 §6.1); aba "Ficha histórico" em TL-120. Células: `OK`, `NOK`, `Ø`, `Pendente`, vazio. | Análise §1.5; DEC-22; RN-150 |
| Filtro classe G1 | Filtro de ar grosso, de menor eficiência. O Anexo 1 o cita como mínimo na captação de ar externo. | Só no texto fixo do Anexo 1; não é dado do sistema. | Análise §5; conhecimento técnico |
| Filtro de ar | Elemento que retém partículas do ar que passa pelo equipamento. | Títulos de atividade (limpeza ou substituição do filtro). | Conhecimento técnico; análise §4 |
| Filtro secador | Componente da linha de líquido que retém umidade e impurezas do fluido refrigerante. | Título de atividade ("Verificação filtro secador"). | Conhecimento técnico; análise §4.2, §4.4 |
| Fixo / Modular | Grupo do tipo Splitão nos PDFs. Significado exato [A VALIDAR]. | Valor de `equipment_group.name`. | Análise §3.3 |
| Fluido refrigerante (gás refrigerante) | Substância que circula no ciclo de refrigeração, absorvendo e rejeitando calor. | Só em títulos de atividade ("Verificação de vazamento de gás refrigerante"). O modelo **não** tem campo de fluido do equipamento. | Conhecimento técnico; análise §3.2 |
| Foto | Imagem tirada pelo técnico, por equipamento (e opcionalmente por atividade), com data de captura e legenda. | `photo` + `stored_file` (`file_kind = 'FOTO'`); até 10 por equipamento na visita (decisão D4, R2 2.7 x). | DEC-09; RF-21.5; RNF-11; RN-185 |
| Frigus | Software usado hoje para gerar o PMOC. Será substituído por este sistema. | Não aparece. Logo do rodapé passa a ser a do sistema novo (DEC-32). Migração de dados: Q8 (não no MVP). | DEC-01; DEC-32 |
| Fuso de negócio | Fuso usado para datas de negócio (mês previsto, Pendente, "hoje"). | `America/Sao_Paulo`; datas `date`, timestamps em UTC. | RNF-12 |

### G

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Grupo | Subtipo do equipamento dentro do tipo (ex.: Split → Hi-Wall, Piso-Teto, Cassete). | `equipment_group`; o grupo do equipamento deve pertencer ao tipo (FK composta, RN-041). | Análise §3.3; RN-040 |

### H

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Hash SHA-256 | Resumo criptográfico do arquivo que prova que o PDF não mudou. | `pmoc_version.pdf_sha256`, `document_signature.document_sha256`, `stored_file.sha256`. | RNF-08; RN-125 |
| Hi-Wall | Grupo de split com evaporadora instalada no alto da parede. | Valor de `equipment_group.name` (tipo Split). | Conhecimento técnico; análise §3.3 |
| Histórico (PMOC) | PMOC de contrato encerrado ou cancelado: somente leitura, continua disponível para download. | `pmoc.status = 'HISTORICO'`, `historic_since`; rótulo "Histórico". | DEC-06; RN-014; RN-146 |
| HVAC | Heating, Ventilation and Air Conditioning: aquecimento, ventilação e ar condicionado. | Só no contexto do projeto; não aparece nas telas nem no modelo. | Conhecimento técnico |

### I

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| IA (relatório gerado por IA) | Texto do relatório da visita gerado automaticamente a partir dos dados registrados, revisado pelo técnico. | `visit_report_version.ai_generated_text`, `ai_model`, `ai_prompt_version`, `ai_generation_status` (`NAO_SOLICITADA`, `GERADA`, `FALHOU`); TL-205, TL-133. Prompt: P6 [A VALIDAR]. | DEC-09; DEC-31; DEC-38; RF-24; RNF-10 |
| ICP-Brasil | Infraestrutura de Chaves Públicas Brasileira, cadeia oficial de certificados digitais. | Certificado do RT (`rt_certificate`). Validador usado no teste: [A VALIDAR] (CA-13.1). | Conhecimento técnico; DEC-16 |
| Idempotência | Garantia de que um envio repetido (ex.: após queda de conexão) não duplica dados. | Tabela `idempotency_key`; chave gerada no aparelho (PW-02). | RN-089; DM-22 |
| Inativação | Tirar um registro de uso sem apagá-lo; continua no histórico e nos PDFs existentes. | `status = 'INATIVO'` (`active_status`) em usuário, tipo, grupo, atividade e equipamento. | RN-044; RN-048; RN-141; EL-3 |
| Instalação | Sinônimo de local nos PDFs ("Dados da instalação"). | Seção 1 do PMOC, preenchida com dados de `site`. | Análise §1.1 |
| Intervalo k | Número de meses entre ocorrências de uma periodicidade: `MM`=1, `MB`=2, `MT`=3, `MS`=6, `MA`=12. | Função `periodicity_months(text)`; prevista quando `(m − 1) mod k = 0`. | DEC-04; DEC-05; RN-020; RN-023 |
| Isolamento térmico | Revestimento que evita troca de calor e condensação em tubulações e gabinetes. | Títulos de atividade (VRF Condensador, Splitão). | Conhecimento técnico; análise §4.2, §4.5 |

### L

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Lançamento manual | ADM preenche ou corrige pelo painel uma visita que o técnico não lançou, e pode gerar e enviar o relatório. | TL-132; `record_source = 'PAINEL_ADM'`; `visit.finalization_channel`; FL-13. | DEC-12; DEC-42; RF-29 |
| Lei 13.589/2018 | Lei federal que torna obrigatório o PMOC em edificações de uso público e coletivo com ar climatizado. | Não é origem de nenhuma regra: o conteúdo não está nos arquivos. Não aparece nas telas. | Conhecimento técnico; doc 02 Convenções |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018). | RNF-05: dados mínimos, nada de e-mail, telefone ou IP para a IA (RN-172). Retenção e fluxo do titular [A VALIDAR]. | Conhecimento técnico; RNF-05 |
| Listagem de equipamentos | Seção 5 do PMOC: equipamentos agrupados por tipo + grupo, com quantidade em número e por extenso e as TAGs. | Gerada no PDF (RN-050); plural do tipo em `equipment_type.plural_name` [A VALIDAR]. | Análise §3.1; RN-050 |
| Local | Instalação climatizada de um cliente. Um cliente tem N locais; um contrato por local. | `site` (com `code`); TL-110. Não confundir com o rótulo `Local:` da ficha do Frigus (ver **Ambiente**). | DEC-03; RF-06 |

### M

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Mancal / polia / correia | Peças da transmissão do ventilador: o mancal sustenta o eixo, a polia recebe a correia, que transmite o movimento do motor. | Títulos de atividade (Splitão, Ventilador). | Conhecimento técnico; análise §4.5, §4.6 |
| Manutenção corretiva | Reparo de falha ou defeito encontrado. | **Fora do sistema**: não gera OS (RN-077); o relatório só aponta a necessidade a partir dos NOK. | DEC-11 |
| Medição | Natureza de atividade que exige valor numérico com unidade quando marcada OK. Sem faixa de aceitação. | `activity_nature = 'MEDICAO'`; `unit` obrigatória; `occurrence_record.measured_value`, `measurement_unit`. | DEC-10; DEC-30; RN-042; RN-082 |
| Mês 1 | Mês de calendário da data de início do contrato. Todas as periodicidades contam a partir dele. | `occurrence.month_index = 1`; RN-021. | DEC-05; RN-021 |
| Mês de referência | Mês do contrato cujas ocorrências uma visita cobre. Não muda se a visita for remarcada para outro mês. | `visit.reference_month_index`, `visit.reference_month`; `occurrence.reference_month`. | PRD §4; RN-072 |
| Mês do contrato | Posição do mês dentro do contrato (1 a N). N conta todo mês de calendário tocado pelo contrato. | `occurrence.month_index`; `contract.month_count` (coluna gerada). | DEC-22; RN-022; D-03 a |
| MM, MB, MT, MS, MA | Siglas de periodicidade: mensal, bimestral, trimestral, semestral, anual. | Enum `periodicity`; colunas da seção 6 do PMOC. | DEC-04 |

### N

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Ø (não prevista) | Célula da ficha em que a atividade não está prevista naquele mês. | `occurrence_status = 'NAO_PREVISTA'` ou ausência de linha em `occurrence` (DM-04); `unscheduled_reason` quando deixou de ser prevista. | Análise §1.5; RN-023 |
| Natureza da atividade | Classificação da atividade: verificação (só OK/NOK) ou medição (OK/NOK + valor). | Enum `activity_nature` = `VERIFICACAO`, `MEDICAO`. | DEC-10; RF-08.2 |
| NBR 13971 | Norma ABNT sobre manutenção programada de sistemas de refrigeração, condicionamento de ar e ventilação. Título exato [A VALIDAR]. | Não é origem de nenhuma regra: o conteúdo não está nos arquivos. | Conhecimento técnico; doc 02 Convenções |
| NOK | Atividade **não efetuada** (decisão F1, 21/10/2026): não representa atividade executada com resultado não conforme. Exige observação. Mesma legenda dos PDFs do Frigus ("NOK – não efetuado"). Atividade executada com defeito = `OK` + marca "requer corretiva" (decisão R2 1.3 a; RN-193). | `occurrence_status` e `record_result` = `NOK`; botão "NOK – não efetuado" no PWA. | DEC-11; D-05; RN-083 |
| Nome fantasia | Nome comercial do cliente. | `client.trade_name` (opcional). | RF-05.3 |
| Notificação | Aviso dentro do app. Único canal de alerta: sem e-mail, WhatsApp ou SMS. | `notification`; `notification_event`; `notification_status` = `NAO_LIDA`, `LIDA`; TL-010. | DEC-40; RF-19; RN-100 a RN-107 |

### O

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Observação | Texto livre do técnico ou ADM. Obrigatória em NOK. | `occurrence_record.observation`; observação geral por equipamento em `visit_equipment_note`. | DEC-11; RF-21.5 |
| Ocorrência | Combinação equipamento × atividade × mês do contrato. É a célula da ficha histórico. | `occurrence`; `occurrence_status` = `NAO_PREVISTA`, `PREVISTA`, `PENDENTE`, `OK`, `NOK`. | PRD §4; RF-11 |
| Offline (níveis 1 e 2) | Nível 1 (MVP): o app salva tudo no aparelho e reenvia ao reconectar; inclui "Sincronizar agora" e a agenda dos próximos dias baixada só para leitura (decisão R2 1.1 b). Nível 2 (**Fase 2**, decisão A1 b): a visita inteira é executada sem internet. | Estado de tela `OFFLINE` no PWA; `row_version`, `device_updated_at`, `idempotency_key`; PW-01 a PW-08. | DEC-37; RNF-03 |
| OK | Atividade prevista e executada sem problema. | `occurrence_status` e `record_result` = `OK`. | Análise §1.5; RN-081 |
| Ordem de serviço (OS) | Neste sistema, OS é a própria visita. Não existe entidade nem tela de OS separada. | Ver **Visita**. | D-01 a |

### P

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| PAdES | Padrão de assinatura digital embutida em PDF. | Proposto para a assinatura do RT: [A VALIDAR] (RNF-09). | Conhecimento técnico; RNF-09 |
| Painel de pendências | Tela inicial do ADM com tudo que precisa de ação: ocorrências pendentes, visitas atrasadas, relatórios e PMOCs sem assinatura, contratos e certificado a vencer. | TL-100; FL-20; filtros por cliente, local, técnico e período (RN-117). | DEC-12; RF-28; RN-108 a RN-117 |
| Pendência | Termo amplo: ocorrência pendente **ou** documento (PMOC, relatório) aguardando assinatura. | Itens do painel TL-100. | PRD §4; RF-28 |
| Pendente | Ocorrência prevista sem registro no dia seguinte ao fim do mês previsto. Nunca vira NOK sozinha; o ADM resolve. | `occurrence_status = 'PENDENTE'`, `pending_since`; job diário (RN-029); TL-134 "Resolver pendências"; ação "Incluir pendências" em TL-131. | DEC-12; DEC-25; RN-029; RN-030 |
| Perfil | Papel do usuário no sistema. Cada usuário tem exatamente um. | Enum `user_role` = `ADM`, `TECNICO`, `CLIENTE`. RT não é perfil. | PRD §3.1 |
| Periodicidade | Frequência com que uma atividade deve ser feita. Padrão na biblioteca, ajustável por PMOC só pelo ADM, vale para todos os equipamentos do tipo no PMOC. | `activity_template.default_periodicity`; `pmoc_activity.periodicity`; mudança vai para `audit_log`. | DEC-04; DEC-07; RN-026 |
| Piso-Teto | Grupo de split com evaporadora aparente, instalada no piso ou no teto. | Valor de `equipment_group.name` (tipo Split). | Conhecimento técnico; análise §3.3 |
| Plano do PMOC | Lista de atividades e periodicidades que vale para um PMOC, copiada da biblioteca na criação. | `pmoc_activity`; TL-120. Incluir ou remover atividade do plano: [A VALIDAR] (RF-10.3). | RF-10; RN-002 |
| PMOC | Plano de Manutenção, Operação e Controle do sistema de climatização. Um por contrato, com versões. | `pmoc`; `pmoc_status` = `RASCUNHO`, `EMITIDO`, `ASSINADO_CLIENTE`, `HISTORICO`; TL-120 (ADM), TL-302 e TL-303 (cliente). | DEC-06; D-02 a; RF-12; RN-001 |
| Portal do cliente | Área web dos usuários do cliente: agenda de visitas, PMOCs, relatórios, equipamentos e assinaturas. | Rotas `/cliente`; TL-300 a TL-307. | DEC-20; DEC-36; RF-32 |
| Portaria MS 3.523/1998 | Portaria do Ministério da Saúde sobre limpeza e manutenção de sistemas de climatização, transcrita no Anexo 1. | Texto fixo do Anexo 1. Única norma usada como origem de regras (RN-012, RN-053, RN-093), pelo texto transcrito, cuja fidelidade é [A VALIDAR]. | Análise §1.1; doc 02 Convenções |
| Pressão de descarga e de sucção | Pressões do fluido refrigerante na saída (descarga) e na entrada (sucção) do compressor. | Título de atividade de medição (VRF Condensador). Unidade definida pelo ADM (ex.: `psi`). | Conhecimento técnico; análise §4.2; RF-08.2 |
| Prevista | Ocorrência prevista para o mês, ainda sem registro e dentro do prazo. | `occurrence_status = 'PREVISTA'`; célula vazia na ficha. | Análise §9.4; RN-150 |
| Processamento diário | Rotina automática às 00:05 de `America/Sao_Paulo` (decisão C1) que marca pendências, atualiza estado de contratos e PMOCs e gera alertas. | Job do servidor; FL-18. Horário exato [A VALIDAR]. | RN-029; RN-142; RN-106 |
| Proposta comercial | Documento comercial identificado pelo código TH. Fora do escopo; o código é só texto digitado. | `contract.th_code`. | DEC-02; PRD §9 |
| Proprietário | Dono da instalação, sempre pessoa jurídica. É o próprio cliente. | Seção 2 do PMOC, preenchida com dados de `client`. | DEC-17; análise §2.1 |
| PWA | Progressive Web App: aplicação web instalável no celular. Plataforma do técnico. | Rotas `/tecnico` (decisão C6); TL-200 a TL-205; padrões PW-01 a PW-08. | DEC-33; RNF-01 |

### Q

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| QAI | Qualidade do Ar Interior. A sigla não aparece nos documentos. | **Fora do sistema** (ver **Qualidade do ar**). | Conhecimento técnico; DEC-13 |
| Quadro elétrico | Painel que reúne os dispositivos de comando e proteção elétrica do equipamento. | Título de atividade ("Limpeza do quadro elétrico"). | Conhecimento técnico; análise §4.2 |
| Qualidade do ar | Análise de parâmetros do ar interior (laudo, pontos de coleta, valores de referência). A empresa não realiza. | **Fora do PMOC e do sistema**: sem tabela, tela ou seção. | DEC-13; análise §5 |

### R

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Rascunho | Estado inicial, ainda não enviado. PMOC em rascunho não aparece para cliente nem técnico; registro em rascunho não muda o estado da ocorrência. | `pmoc_status`, `report_status` = `RASCUNHO`; `occurrence_record.finalized_at IS NULL`. | RN-084; RN-147; doc 02 §7.6 |
| Razão social | Nome jurídico da empresa. | `client.legal_name`, `executor_company.legal_name`. | Análise §2.1; RF-05 |
| RE 09/2003 (Anvisa) | Resolução da Anvisa com padrões referenciais de qualidade do ar interior em ambientes climatizados de uso público e coletivo. | **Não usada**: qualidade do ar fora do escopo. Conteúdo não está nos arquivos. | Conhecimento técnico; DEC-13; doc 02 Convenções |
| Reaperto | Reaperto de parafusos, conexões ou terminais elétricos afrouxados por vibração. | Títulos de atividade ("Reaperto elétrico", "Reaperto dos parafusos"). | Conhecimento técnico; análise §4 |
| Recomendações para falha e emergência | Seção nova do PMOC com orientações para falha do equipamento e emergência. | Texto padrão no PDF (RF-12.2). Texto: P2 [A VALIDAR]. | DEC-19; RN-012 |
| Registro de execução | Resultado lançado para uma ocorrência: OK/NOK, valor medido, observação, data e técnico executor. | `occurrence_record` (um por ocorrência, DM-06); `record_source` = `APP_TECNICO`, `PAINEL_ADM`, `RESOLUCAO_PENDENCIA`. | DEC-09; RN-081 a RN-086 |
| Registro do RT | Número de registro profissional do RT, cadastrado em campo separado do registro CREA da empresa. | `technical_responsible.registration_number`. | DEC-29; análise A8 |
| Relatório da visita | Documento de uma visita: dados registrados + texto gerado por IA e revisado, enviado direto ao cliente para assinar. | `visit_report` + `visit_report_version`; `report_status` = `RASCUNHO`, `AGUARDANDO_ASSINATURA`, `ASSINADO_CLIENTE`; TL-205, TL-133, TL-305. | DEC-09; DEC-31; DEC-38; RF-24 a RF-27 |
| Relé de proteção | Dispositivo que desliga o motor em caso de sobrecarga ou falha elétrica. | Título de atividade (Ventilador). | Conhecimento técnico; análise §4.6 |
| Remarcação | Mudança de data ou horário de uma visita já agendada. | Grava `visit_schedule_change` (`field` = `DATA`, `HORARIO`); notifica técnico e cliente (RN-102). | DEC-35; RF-18 |
| Renovação de ar | Troca de parte do ar interno por ar externo. O Anexo 1 cita o mínimo de 27 m³/h/pessoa. | Grupo "Renovação de ar" do tipo Ventilador; o valor de 27 m³/h/pessoa só existe no texto do Anexo 1. | Conhecimento técnico; análise §3.3, §5 |
| Renovação de contrato | Novo contrato do mesmo local, com novo PMOC. O PMOC anterior vira histórico **quando o ADM aciona "Confirmar renovação"** (decisão R2 2.1 c); as visitas restantes do contrato anterior continuam válidas. | `contract.previous_contract_id`; `contract.renewal_confirmed_at` (nome proposto); `pmoc.copied_from_pmoc_id` (cópia do plano, RN-004); FL-06; RN-192. | DEC-06; RF-15 |
| Requer corretiva | Marca em uma ocorrência `OK` cuja atividade foi executada com problema; exige observação; não gera OS. | `occurrence_record.requires_corrective` (nome proposto); RN-193. | Decisão R2 1.3 a |
| Exige foto | Atributo da atividade: sem ao menos 1 foto do equipamento na visita, a ocorrência não é finalizada. | `activity_template.requires_photo`, `pmoc_activity.requires_photo` (nomes propostos); RN-185. | Decisão R2 2.7 a |
| Dispensar / cancelar pendência | Ações do ADM sobre ocorrência `PENDENTE`: dispensar = `NOK` com observação; cancelar = `NAO_PREVISTA` com `unscheduled_reason = PENDENCIA_CANCELADA` (nome proposto). | RN-091; TL-134. | Decisão R2 2.2 a |
| Resolução de pendência | ADM lança OK (com data de execução) ou NOK (com observação) para ocorrência Pendente, sem visita. | Diálogo TL-134; `record_source = 'RESOLUCAO_PENDENCIA'`; FL-15. | DEC-12; RF-30; RN-091 |
| Retirada de assinatura | ADM tira um relatório de "aguardando assinatura" para corrigir e reenviar. | `AGUARDANDO_ASSINATURA` → `RASCUNHO`; `visit_report_version.withdrawn_at`; TL-133. | RF-29.4; RN-129; DM-15 |
| Revisão (R{n}) | Revisão digitada do documento (ex.: `R1`). Opcional; nunca incrementada pelo sistema. Diferente da versão do PMOC. | `contract.revision`; impressa como `{TH}-{revisão}` (ex.: `TH12326-R1`). | DEC-02; DEC-21; RN-016; VP-9 |
| Rotor e voluta | Rotor: parte giratória do ventilador centrífugo. Voluta: carcaça em espiral que conduz o ar. | Título de atividade (Splitão). | Conhecimento técnico; análise §4.5 |
| row_version (conflito de edição) | Contador de versão da linha usado para impedir que uma edição sobrescreva outra sem recarregar. | Coluna do bloco `[P]`; resposta 409 e mensagem de conflito (UF-07). | Doc 03 bloco [P]; doc 04 UF-07 |
| RT (responsável técnico) | Engenheiro, pessoa física e dono da empresa, responsável técnico pelo PMOC. Existe só um. Não usa o sistema. | `technical_responsible` (linha única); seção 4 do PMOC; não tem login (RN-170). | DEC-07; DEC-14; DEC-23; DEC-29 |

### S

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Sincronização para revisar | Registro que chegou do aparelho do técnico e não foi aplicado, ou foi aplicado mas o ADM precisa conferir (CF-01, CF-03, CF-05, CF-06). | `sync_review_item`; grupo em TL-100; aviso em TL-207. | 02 §11.2; AF-03 |
| s/n | "Sem número", para endereço sem número. | `address_without_number = true` (bloco `[E]`); o PDF imprime "s/n". | CA-05.4; análise B6 |
| Serpentina | Feixe de tubos aletados por onde passa o fluido e onde ocorre a troca de calor com o ar. | Títulos de atividade ("Limpeza da serpentina com produto"). | Conhecimento técnico; análise §4.2, §4.3 |
| Sigla do tipo | Abreviação do tipo de equipamento usada na TAG (ex.: `SPL`). | `equipment_type.acronym` (2 a 5 letras maiúsculas [A VALIDAR]); única; imutável após existir equipamento. | DEC-26; RN-040 |
| Snapshot | Cópia congelada dos dados usados para gerar um PDF, para que mudanças posteriores não alterem documentos emitidos. | `pmoc_version.snapshot`, `visit_report_version.data_snapshot` (`jsonb`). | RNF-15; DM-20; VP-3 |
| Split | Ar condicionado dividido em unidade interna (evaporadora) e externa (condensadora). | Tipo de equipamento (`equipment_type`), grupos Hi-Wall, Piso-Teto, Cassete nos PDFs; sigla de exemplo `SPL`. | Conhecimento técnico; análise §3.3; DEC-26 |
| Splitão | Split de grande capacidade, em geral com ventilador de transmissão por correia e distribuição por dutos. | Tipo de equipamento (PBS), grupo "Fixo / Modular". | Conhecimento técnico [A VALIDAR]; análise §3.3, §4.5 |

### T

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| TAG | Identificador único do equipamento, gerado pelo sistema: `{código do local}-{sigla do tipo}-{sequencial de 3 dígitos}` (ex.: `L012-SPL-003`). Imutável e nunca reutilizado. | `equipment.tag`, `tag_sequence`; contador `equipment_tag_counter`. Impressa na listagem do PMOC e mostrada em TL-306. | DEC-18; DEC-26; RN-046 |
| Técnico | Técnico de campo que executa as visitas pelo celular. | `app_user.role = 'TECNICO'`; PWA `/tecnico` (decisão C6). **Técnico atribuído** = `visit.technician_user_id`; **técnico executor** = `visit.executed_by_user_id` / `occurrence_record.executed_by_user_id` (podem diferir quando o ADM lança). | DEC-09; RF-20; RN-090 |
| Tensão (elétrica) | Tensão de alimentação do equipamento, em volts (V). | Atividade de natureza `MEDICAO` com unidade `V`. | Conhecimento técnico; RF-08.2; análise §4 |
| Thermo Service | Empresa executora dos 4 PMOCs de referência (Thermo Service Sistemas de Climatização Ltda). | Dado cadastrado em `executor_company`; não é fixo no código. | Análise §0, §2.2 |
| Tipo de equipamento | Categoria de equipamento (ex.: Split, Splitão, VRF Evaporador), com sigla, grupos e atividades padrão. O ADM cria, edita e exclui. | `equipment_type`; TL-104, TL-105. | DEC-08; RF-08 |
| Tipo Janela | Grupo do Evaporador Monobloco nos PDFs: aparelho de janela. | Valor de `equipment_group.name`. Não imprimir "tipo Tipo Janela" (RN-050). | Análise §3.3, B12 |
| TR | Tonelada de refrigeração: 12.000 BTU/h. O Anexo 1 cita 5 TR (60.000 BTU/h) como limite acima do qual o RT é exigido. | Não é campo nem unidade padrão. O sistema sempre imprime o RT e não calcula a capacidade total (RN-053). | Conhecimento técnico; análise D6; RN-053 |
| Troca de técnico | Mudança do técnico atribuído a uma visita antes de ela começar. | `visit_schedule_change.field = 'TECNICO'`; notificação `TECNICO_TROCADO`. Bloqueada em `EM_ANDAMENTO` (RN-071 [A VALIDAR]). | DEC-35; RN-103 |

### U

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| UF | Unidade da Federação (sigla do estado). | `address_state char(2)`, lista das 27 UFs. | Doc 03 bloco [E] |
| Umidade relativa (UR) | Razão entre a umidade presente no ar e a máxima possível naquela temperatura, em %. | Título de atividade do Splitão (com bulbo seco). | Conhecimento técnico; análise §4.5, §5 |
| Unidade (de medição) | Unidade do valor medido, definida pelo ADM na atividade (ex.: `V`, `A`, `psi`). | `activity_template.unit`, `pmoc_activity.unit`, `occurrence_record.measurement_unit`. | DEC-30; RN-042 |
| Usuário do cliente | Pessoa de uma empresa cliente com acesso ao portal. Um cliente pode ter vários; qualquer um ativo pode assinar (Q3 [A VALIDAR]). | `app_user.role = 'CLIENTE'` com `client_id` obrigatório. Restrição por local: Q2 [A VALIDAR]. | DEC-39; RN-169; RN-124 |

### V

| Termo | Definição | Como aparece no sistema | Fonte |
|---|---|---|---|
| Válvula de controle | Válvula que regula a vazão do fluido que passa pela serpentina conforme a demanda. | Título de atividade (Fancoletes, VRF Evaporador). | Conhecimento técnico; análise §4.1, §4.3 |
| Válvula de serviço | Válvula da unidade condensadora usada para ligar manômetros e carregar ou recolher refrigerante. | Título de atividade (VRF Condensador). | Conhecimento técnico; análise §4.2 |
| Vazão de ar | Volume de ar movimentado por unidade de tempo (ex.: m³/h). | Título de atividade (Splitão, Ventilador). Natureza e unidade definidas pelo ADM. | Conhecimento técnico; análise §4.5, §4.6 |
| Vencimento (da ocorrência) | Último dia do mês previsto. No dia seguinte, sem registro, a ocorrência vira Pendente. | `occurrence.due_date`. | DEC-25; RN-028 |
| Ventilador (renovação de ar) | Tipo de equipamento dos PDFs (PBS) que movimenta ar externo para renovação. | `equipment_type` "Ventilador", grupo "Renovação de ar". | Análise §3.3, §4.6 |
| Ventilador centrífugo | Ventilador em que o ar entra pelo eixo e sai radialmente, impulsionado por rotor. | Título de atividade ("Limpeza dos ventiladores centrífugos"). | Conhecimento técnico; análise §4.3, §4.4 |
| Verificação | Natureza de atividade que registra só OK ou NOK, sem valor numérico. | `activity_nature = 'VERIFICACAO'`; sem unidade (RN-042). | DEC-10; RF-08.2 |
| Versão do PMOC | Cada emissão do PMOC, com PDF próprio assinado pelo RT. Só o ADM decide emitir nova versão. | `pmoc_version` (`version_number`, `is_current`); `pmoc_version_status` = `AGUARDANDO_ASSINATURA`, `ASSINADO_CLIENTE`, `SUBSTITUIDA`; botão "Emitir nova versão" em TL-120. | RN-015; RN-016; D-07 a; VP-1 a VP-9 |
| Versão do relatório | Cada versão do relatório da visita. Relatório assinado não é editado; correção cria nova versão que exige nova assinatura. | `visit_report_version` (`version_number`, `is_current`). | RF-29.5 [A VALIDAR]; RN-130; VR-1 a VR-6 |
| Vigência | Período do contrato (data de início a data de fim). O PMOC não tem validade própria. | `contract.start_date`, `contract.end_date`; impressa na capa (RN-005). | DEC-06; RN-005 |
| Visita | Ida do técnico ao local em uma data para executar as ocorrências de um mês de referência. É a OS do sistema. | `visit`; `visit_status` = `A_AGENDAR`, `AGENDADA`, `EM_ANDAMENTO`, `REGISTRADA`, `CANCELADA`; `visit_origin` = `AUTOMATICA`, `RECALCULO`, `DIVISAO`, `AVULSA`; ocorrências em `visit_occurrence`. Telas TL-131, TL-200 a TL-204. | PRD §4; RF-17 a RF-23; D-01 a |
| Visita avulsa | Visita criada manualmente pelo ADM para um mês de referência, com ocorrências que não estão em outra visita ativa. | `visit.origin = 'AVULSA'`; botão "Nova visita avulsa" em TL-130. | RF-17.3 [A VALIDAR]; RN-063 |
| Visor de líquido | Visor na linha de líquido que mostra se o refrigerante passa sem bolhas e sem umidade. | Título de atividade (Splitão). | Conhecimento técnico; análise §4.5 |
| VRF | Variable Refrigerant Flow (fluxo de refrigerante variável): sistema em que uma ou mais condensadoras atendem várias evaporadoras, variando a vazão de refrigerante. | Tipos "VRF Condensador" e "VRF Evaporador" nos PDFs (AUR). O modelo **não** guarda o vínculo condensadora ↔ evaporadora. | Conhecimento técnico; análise §3.2, §3.3 |

## 3. Termos que podem confundir

| Termo | Cuidado |
|---|---|
| Local × Ambiente | `Local` = entidade `site` (a instalação do cliente). O rótulo `Local:` da ficha do Frigus corresponde ao **ambiente** do equipamento (`equipment.location_description`). |
| Cliente × Proprietário × Usuário do cliente | Cliente e proprietário são a mesma pessoa jurídica (`client`). Usuário do cliente é a pessoa que acessa o portal (`app_user` com `role = 'CLIENTE'`). |
| Versão × Revisão | Versão = `pmoc_version.version_number`, criada pelo sistema a cada emissão. Revisão = `contract.revision`, texto digitado (ex.: `R1`), nunca incrementado. |
| Pendente × Pendência | Pendente = estado de ocorrência. Pendência = qualquer item do painel do ADM, inclusive documento sem assinatura. |
| Cronograma | Pode ser a seção 6 do PDF, a tabela `occurrence` ou a agenda de visitas do cliente (TL-301). Diga sempre qual. |
| Visita × OS | Mesma coisa (D-01 a). Não criar entidade, tela ou rota de "ordem de serviço". |
| NOK | No sistema novo = "não efetuado" (decisão F1), como no Frigus. Não usar para "executado com problema": usar `OK` + "requer corretiva" (decisão R2 1.3 a; RN-193). A recomendação anterior de D-05 a ("não conforme") **não** foi adotada. |
| Inativar × Excluir | Inativar (`status = 'INATIVO'`) mantém no histórico e nos PDFs. Excluir (`deleted_at`) tira de todas as telas. Usuário só é inativado. |
| Técnico atribuído × Técnico executor | Atribuído = quem está agendado (`visit.technician_user_id`). Executor = quem fez (`executed_by_user_id`), informado pelo ADM no lançamento manual. |

## 4. Vocabulário canônico (decisão F5, 21/10/2026)

Um termo por conceito. Nos documentos 00 a 06 os termos antigos foram trocados onde havia ocorrência clara; se ainda aparecer um termo da coluna "Não usar", trocar ao tocar o trecho.

| Conceito | Termo canônico | Não usar | Observação |
|---|---|---|---|
| Cada emissão de PMOC ou de relatório | **versão** (`pmoc_version`, `visit_report_version`) | "revisão" para PMOC; "versão" para outras coisas | Só PMOC e relatório têm versão. Revisão é só `contract.revision` (`R{n}`), texto digitado |
| Registro fora de uso, sem apagar | **inativo** (estado `INATIVO`), ação **inativar** | "desativado", "desativar" | "Desativar MFA" e "desativar o certificado" no doc 06 não são estado `INATIVO` e ficam como estão |
| Ordem de serviço | **visita** (`visit`) | "OS" como entidade ou tela | "OS" só como sinônimo explicado (D-01 a) |
| Documento de uma visita | **relatório da visita** | "relatório de visita", "relatório de manutenção", "laudo" | O doc 01 §9.6 mantém o título original por ser a análise histórica |
| Mês que uma visita cobre | **mês de referência** | — | Diferente de **mês previsto** (mês em que a ocorrência está prevista) e de **mês do contrato** (posição 1 a N) |
| Tela inicial do ADM com ações | **Painel de pendências** (TL-100) | "painel do ADM" quando se refere à tela TL-100; "dashboard" | "Saúde do sistema" é outra tela e está em "Depois" (D7.6) |
| Resultado da atividade não executada | **NOK = não efetuado** | "não conforme" | Decisão F1 |
| Assinatura do cliente (valor do enum) | **`ASSINADO_CLIENTE`** (PMOC, versão do PMOC e relatório) | `ASSINADA`, `ASSINADO` | Decisão F2 |
| Colunas do PDF assinado pelo cliente | **`client_signed_pdf_*`** | `signed_pdf_*` | Decisão F3 |
| Rota do técnico | **`/tecnico`** | `/app` | Decisão C6 |
| Rotas de senha | **`/senha/definir`**, **`/senha/esqueci`** | `/senha/recuperar`, `definir-senha`, `esqueci-senha` | Decisão C7 |
