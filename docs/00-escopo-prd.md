# 00 – Escopo e PRD do Sistema PMOC

> **Versão:** 1.2 – 27/10/2026 (decisões da auditoria final AF-01 a AF-20 incorporadas: `docs/auditoria-final.md` §5; ordem de construção em `docs/07-plano-de-implementacao.md`). Neste documento, "Fase 2" quer dizer **depois do MVP**; as etapas de construção do MVP se chamam "Etapa" (doc 07).
> **Base:** `pmoc/01-analise-pmocs-existentes.md` (decisões `DEC-01` a `DEC-32` e regras da §9) + respostas do usuário em 17/10/2026 (`DEC-33` a `DEC-42`, §1.3 deste documento).
> **Leitor principal:** IA de código. Cada requisito tem ID único; use os IDs em commits, testes e tarefas.

## Convenções

| Marca | Significado |
|---|---|
| **deve** | Obrigatório. Não implementar = requisito não atendido. |
| **pode** | Permitido, não obrigatório. |
| `DEC-xx` | Decisão do usuário. Não alterar sem nova decisão. |
| `§9.x` | Regra da seção 9 de `01-analise-pmocs-existentes.md`. |
| **[A VALIDAR]** | Não veio dos arquivos nem do usuário. É proposta: implementar como descrito, mas de forma fácil de mudar (configuração ou código isolado). Lista completa na §10. |
| **(inferido)** | Dedução a partir das decisões; não foi dita literalmente. |
| `CA-xx.y` | Critério de aceite `y` do requisito `RF-xx`. |

---

## 1. Problema e objetivo

### 1.1 Problema

| # | Problema atual | Evidência |
|---|---|---|
| 1 | O PMOC é gerado no Frigus, que não atende o fluxo da empresa e será substituído. | DEC-01 |
| 2 | O cronograma dos PDFs não segue regra única de meses; periodicidades mudam por cliente sem controle. | Análise §4.7, A2–A3, A6 |
| 3 | Ocorrências sem registro ficam em branco para sempre; não há tratamento de pendência. | A4, A11, DEC-12 |
| 4 | Não há data, técnico, valor medido, foto ou observação por execução; só OK/NOK por mês. | D2, D4 |
| 5 | Não há relatório por visita nem assinatura do cliente. | D9, DEC-09, DEC-20 |
| 6 | Cadastros aceitam dados inválidos (`null` impresso, CNPJ com 13 dígitos, CPF no lugar de CNPJ, ART vazia). | B1–B13 |
| 7 | Visitas mudam de data e de técnico com frequência, e isso não é controlado no sistema atual. | DEC-35 |
| 8 | Quando o técnico não lança a manutenção, não há como completar o registro e o relatório manualmente. | DEC-12, DEC-42 |

### 1.2 Objetivo

Construir um sistema próprio, de empresa única, que permita **completar o ciclo inteiro do PMOC** (DEC-41):

1. Cadastrar empresa, RT, clientes, locais, contratos, tipos de equipamento, atividades e equipamentos.
2. Emitir o PMOC em PDF, assinado pelo RT (e-CPF) e pelo cliente.
3. Gerar o cronograma de ocorrências e agendar visitas de forma flexível.
4. Permitir que o técnico registre a manutenção no celular (PWA) e gere o relatório da visita com IA.
5. Permitir que o cliente acompanhe visitas e assine relatórios e PMOC.
6. Permitir que o ADM corrija manualmente manutenções e resolva pendências.

**Critério de sucesso do MVP:** é possível executar, sem sair do sistema, todas as etapas da §5 para um contrato real.

### 1.3 Decisões desta rodada (novas)

| ID | Tema | Decisão |
|---|---|---|
| DEC-33 | Plataforma | ADM e cliente: aplicação web. Técnico: PWA mobile. |
| DEC-34 | Escala e tenancy | **Emendada em 27/10/2026 (AF-12):** ~223 usuários no total (3 ADM, ~20 técnicos, ~200 de cliente), ~200 clientes, ~2.000 equipamentos, maior cliente com ~50 equipamentos. **Sem multiempresa**: uma única empresa executora. (Texto anterior: ~100 usuários.) |
| DEC-35 | Agendamento | Agendamentos devem ser flexíveis: data da visita e técnico mudam constantemente. |
| DEC-36 | Acesso do cliente | O cliente acessa o cronograma de visitas dele, o PMOC e os relatórios. |
| DEC-37 | Offline | Trabalho offline do técnico **nem sempre é necessário, mas deve ser possível**. |
| DEC-38 | Responsável pelo relatório | A elaboração do relatório gerado por IA é responsabilidade do **técnico** (ele revisa e envia). O ADM **não** aprova. Reforça DEC-31. |
| DEC-39 | Usuários do cliente | Um cliente pode ter **vários usuários**. |
| DEC-40 | Notificações | Mudanças de agendamento são avisadas **somente por notificação dentro do app**. Sem e-mail, WhatsApp ou SMS. |
| DEC-41 | MVP | O MVP deve permitir no mínimo o **ciclo completo do PMOC**. Aceita a sugestão de MVP: cadastros, contratos, agendamento flexível, app do técnico, relatório com IA, painel de correção manual, PMOC e assinaturas. |
| DEC-42 | Painel manual | Quando o técnico não lança a manutenção, o ADM insere as informações manualmente no painel para gerar o relatório e enviá-lo para o cliente assinar. |

---

## 2. Público-alvo

| Público | Quem é | Uso principal | Plataforma |
|---|---|---|---|
| Empresa executora (ADM) | Equipe administrativa da empresa de manutenção (hoje: Thermo Service) | Gerenciar cadastros, contratos, PMOCs, agenda e pendências | Web (desktop) |
| Técnicos | Técnicos de campo da empresa | Executar visitas e registrar manutenções | PWA no celular |
| Clientes | Usuários das empresas contratantes (proprietário pessoa jurídica, DEC-17) | Acompanhar visitas, baixar e assinar PMOC e relatórios | Web (desktop e navegador do celular) |
| Responsável técnico (RT) | Engenheiro, pessoa física, dono da empresa (DEC-29) | **Não usa o sistema** (DEC-07). Aparece no PMOC e assina via certificado guardado (DEC-23) | — |

Volume: ~100 usuários no total (DEC-34). Divisão entre perfis: [A VALIDAR].

---

## 3. Perfis de usuário e permissões

### 3.1 Perfis

| Perfil | Descrição | Escopo de dados |
|---|---|---|
| `ADM` | Usuário da empresa executora com acesso total | Todos os dados |
| `TECNICO` | Técnico de campo | Somente visitas atribuídas a ele (e dados necessários para executá-las) |
| `CLIENTE` | Usuário vinculado a **um** cliente (CNPJ). Vários por cliente (DEC-39) | Somente dados do cliente ao qual está vinculado. Por padrão vê **todos os locais** desse cliente; restrição por local é [A VALIDAR] (§10, Q2) |
| RT | Não é usuário (DEC-07) | — |

Regras gerais:
- Um usuário tem **exatamente um** perfil.
- Toda checagem de permissão **deve** ser feita no servidor; esconder botão na interface não basta.
- Usuário inativo não faz login; seus registros históricos permanecem.

### 3.2 Matriz de permissões

Legenda: ✅ permitido · 👁 só leitura · ❌ proibido · "próprias" = visitas atribuídas ao técnico · "seus" = do cliente do usuário.

| Ação | ADM | TECNICO | CLIENTE |
|---|---|---|---|
| Gerenciar usuários (criar, editar, inativar) | ✅ | ❌ | ❌ |
| Cadastrar empresa executora, RT e certificado e-CPF | ✅ | ❌ | ❌ |
| Cadastrar clientes, locais, contratos | ✅ | ❌ | 👁 seus |
| Cadastrar tipos de equipamento e atividades | ✅ | ❌ | ❌ |
| Cadastrar equipamentos | ✅ | 👁 das próprias visitas | 👁 seus |
| Alterar periodicidade no PMOC (DEC-07) | ✅ | ❌ | ❌ |
| Emitir PMOC | ✅ | ❌ | ❌ |
| Ver e baixar PMOC | ✅ | ❌ (decisão B1) | 👁 seus |
| Assinar PMOC (DEC-16, DEC-20) | ❌ | ❌ | ✅ seus |
| Agendar, remarcar, trocar técnico, cancelar visita | ✅ | ❌ | ❌ |
| Ver agenda de visitas | ✅ todas | 👁 próprias | 👁 seus (DEC-36) |
| Registrar execução da manutenção | ✅ via painel (DEC-42) | ✅ próprias | ❌ |
| Gerar, editar e enviar relatório para assinatura | ✅ via painel (DEC-42) | ✅ próprias (DEC-38) | ❌ |
| Ver e baixar relatórios | ✅ | 👁 próprias | 👁 seus |
| Assinar relatório (DEC-20) | ❌ | ❌ | ✅ seus |
| Resolver pendências (Pendente → OK/NOK) (DEC-12) | ✅ | ❌ | ❌ |
| Ver trilha de auditoria | ✅ | ❌ | ❌ |
| Receber notificações no app | ✅ | ✅ | ✅ |

---

## 4. Glossário

| Termo | Definição |
|---|---|
| Cliente | Pessoa jurídica (CNPJ) proprietária da instalação (DEC-17). |
| Local | Instalação climatizada de um cliente. Um cliente tem N locais (DEC-03). Tem um **código** usado na TAG. |
| Contrato | Vínculo com **um** local, com data de início, data de fim e nº de ART. Um contrato vigente por local (DEC-03). |
| PMOC | Documento do contrato. Na renovação do contrato, cria-se um PMOC novo; o anterior vira histórico (DEC-06). |
| Tipo de equipamento | Ex.: Split, Splitão, VRF Evaporador. Tem sigla (usada na TAG) e lista de atividades padrão (DEC-08). |
| Atividade | Item do checklist de um tipo. Natureza: **verificação** (OK/NOK) ou **medição** (OK/NOK + valor numérico com unidade) (DEC-10, DEC-30). Só título, sem procedimento (DEC-27). |
| Periodicidade | `MM` mensal, `MB` bimestral, `MT` trimestral, `MS` semestral, `MA` anual (DEC-04). |
| Ocorrência | Combinação equipamento × atividade × mês do contrato. Estados na §9.4 da análise. |
| Visita | Ida do técnico ao local em uma data, para executar ocorrências de um mês de referência. |
| Mês de referência | Mês do contrato (mês 1, 2, …) cujas ocorrências a visita cobre. |
| Relatório da visita | Documento gerado por IA a partir do registro da visita, revisado pelo técnico e assinado pelo cliente (DEC-09, DEC-38). |
| Pendência | Ocorrência prevista sem registro após o fim do mês, ou relatório/PMOC sem assinatura. |

---

## 5. Ciclo completo do PMOC (fluxo do MVP)

| Passo | Quem | O que acontece | RF |
|---|---|---|---|
| 1 | ADM | Cadastra empresa executora, RT e certificado e-CPF (uma vez) | RF-04 |
| 2 | ADM | Cadastra tipos de equipamento e atividades padrão (biblioteca) | RF-08 |
| 3 | ADM | Cadastra cliente, local, usuários do cliente e técnicos | RF-02, RF-05, RF-06 |
| 4 | ADM | Cadastra contrato do local (datas, ART, TH/revisão opcionais) | RF-07 |
| 5 | ADM | Cadastra equipamentos do local (TAG gerada) | RF-09 |
| 6 | ADM | Monta o plano do PMOC e ajusta periodicidades se necessário | RF-10 |
| 7 | Sistema | Gera o cronograma de ocorrências do contrato inteiro | RF-11 |
| 8 | ADM / Sistema | Emite o PMOC em PDF; RT assina automaticamente | RF-12, RF-13 |
| 9 | CLIENTE | Assina o PMOC | RF-14 |
| 10 | Sistema / ADM | Gera visitas a agendar; ADM define data e técnico; remarca quando preciso | RF-17, RF-18, RF-19 |
| 11 | TECNICO | Executa a visita e registra cada equipamento | RF-20 a RF-23 |
| 12 | TECNICO | Gera relatório por IA, revisa e envia para assinatura | RF-24, RF-25 |
| 13 | CLIENTE | Assina o relatório | RF-26 |
| 14 | ADM | Trata pendências e manutenções não lançadas pelo painel | RF-28 a RF-30 |
| 15 | Sistema | Ficha histórico do PMOC reflete os registros | RF-16 |
| 16 | ADM | Na renovação do contrato, cria o contrato e o PMOC novos e aciona "Confirmar renovação"; o PMOC anterior vira histórico | RF-15 |

---

## 6. Escopo: MVP vs. fases futuras

| Módulo | MVP | Fase 2 | Futuro |
|---|---|---|---|
| Autenticação e usuários (3 perfis) | ✅ | — | Segundo fator opcional para TECNICO e CLIENTE (decisão B2); para o ADM ele já é MVP (linha "Segundo fator TOTP" abaixo) |
| Cadastros (empresa, RT, clientes, locais, contratos, tipos, atividades, equipamentos) | ✅ | — | — |
| Plano do PMOC e periodicidade por PMOC | ✅ | — | — |
| Cronograma de ocorrências e estados (Ø, Prevista, Pendente, OK, NOK) | ✅ | — | — |
| Emissão do PMOC em PDF | ✅ | — | — |
| Assinatura do RT (e-CPF A1 automática) | ✅ (certificado A1, decisão A7) | — | — |
| Comprovante de visita assinado no local pelo responsável presente (decisão A3; RN-189) | ✅ | — | — |
| Código de verificação nos PDFs de PMOC e relatório (decisão B7; RN-187) | ✅ | — | — |
| Tela pública mínima "Verificar documento" (decisão R2 2.8 b; 06 INT-14) | ✅ | — | — |
| Segundo fator TOTP para o ADM (decisão R2 1.2 b; RN-194) | ✅ | Para TECNICO e CLIENTE (opcional) | — |
| Assinatura eletrônica simples do cliente (PMOC e relatórios) | ✅ | — | — |
| Agendamento flexível (data, técnico, remarcação, histórico) | ✅ | — | — |
| Notificações dentro do app | ✅ | Push do PWA [A VALIDAR] | — |
| App do técnico (PWA) online | ✅ | — | — |
| Registro offline com sincronização (DEC-37) | Rascunho local que não se perde se a conexão cair, reenvio, "Sincronizar agora", painel de envios pendentes e **agenda dos próximos dias baixada só para leitura** (RNF-03, nível 1; decisão R2 1.1 b) | Visita inteira offline (baixar a visita, executar e finalizar sem internet) com fila de sincronização (RNF-03, nível 2) | — |
| Relatório da visita por IA, revisado pelo técnico | ✅ | — | — |
| Painel do ADM: pendências e edição manual de manutenções | ✅ | — | — |
| Portal do cliente (agenda, PMOC, relatórios, assinaturas) | ✅ | — | — |
| Trilha de auditoria | ✅ (registro) | Tela de consulta com filtros [A VALIDAR] | — |
| Indicadores / dashboard gerencial | — | — | [A VALIDAR] |
| Itens de 05/06 incorporados ao MVP (decisão D7) | Ver §6.1 | Ver §6.1 | Ver §6.1 |
| Importação de dados do Frigus | — | [A VALIDAR] (§10, Q8) | — |
| Notificação por e-mail, WhatsApp ou SMS | ❌ fora de escopo (DEC-40) | — | — |

### 6.1 Requisitos de 05/06 e decisão de escopo (D7, 21/10/2026)

| Item | Decisão | Onde está especificado | Observação |
|---|---|---|---|
| D7.1 PIN, bloqueio e apagamento remoto do aparelho | Depois | 05 §6.6 (SD-02 a SD-04), 06 SEG-14 | Risco aceito por escrito no MVP, com apagamento dos dados após envio confirmado (decisão R2 1.5 a); o comprovante segue a mesma regra, sem cifra própria (AF-10) |
| D7.2 Códigos de recuperação, redefinição por outro ADM, mínimo de 2 ADMs | Sim, para o ADM (que passa a ter TOTP no MVP, decisão R2 1.2 b) | 06 SEG-05, SEG-06, SEG-17, GL-04; 02 RN-194 | — |
| D7.3 Reautenticação e tela de sessões ativas | Sim, simplificado (decisão R2 2.10 a): reautenticação só com senha; sessões ativas só do próprio usuário | 06 SEG-12 | — |
| D7.4 Direitos do titular e tela "Meu perfil" | Sim, simplificado (decisão R2 2.10 a): "Meu perfil" com dados e troca de senha; pedido do titular por canal de contato, com registro simples | 06 §2.5 (LG-20 em diante) | Tela TL-005 (04 §4.5) e tabela `data_subject_request` (03 §2.11) (AF-09, AF-16) |
| D7.5 Aviso ao tirar foto | Sim | 06 LG-04 | — |
| D7.6 Tela "Saúde do sistema" | Depois | 06 OBS-11 | — |
| D7.7 Modo manutenção com aviso de 48 h | Depois | 06 DSP-21 | — |
| D7.8 Limites de geração por IA | Sim (a IA está no MVP) | 06 SEG-65 | — |
| D7.9 Itens no painel para conflitos e sincronização pendente | Sim, simplificado; vale para o nível 1 (decisão R2 1.1 b) | 05 §6.5, 04 DFT-08 | — |
| D7.10 Baixar a agenda com antecedência, "Baixar mais 7 dias" e "Sincronizar agora" | Sim, mas a agenda baixada é **só para leitura**; "Sincronizar agora" vale para o nível 1 (decisão R2 1.1 b) | 05 §6.7 | Executar e finalizar a visita offline: Fase 2 |
| D7.11 Link da política de privacidade no login | Sim | 06 LG-50 | Texto [A VALIDAR – advogado] |

---

## 7. Requisitos funcionais

Formato: **Perfil** · **Fase** · **Origem**, seguido de regras e critérios de aceite (`Dado / Quando / Então`).

### 7.1 Acesso e usuários

#### RF-01 – Autenticação
- **Perfil:** todos · **Fase:** MVP · **Origem:** DEC-33
- Regras:
  1. Login com e-mail e senha (Better Auth; senha com no mínimo 8 caracteres, hash scrypt; decisão B6).
  2. Recuperação de senha por link de uso único enviado por e-mail (exceção ao DEC-40, que trata de alertas de agenda; decisão B4).
  3. Usuário inativo não autentica.
  3a. O `ADM` autentica também com código TOTP (decisão R2 1.2 b; RN-194); `TECNICO` e `CLIENTE` só com e-mail e senha no MVP.
  4. Após login, o usuário é levado à área do seu perfil (ADM web, CLIENTE web, TECNICO PWA).
- Critérios de aceite:
  - CA-01.1 Dado um usuário ativo com credenciais corretas, quando faz login, então acessa somente a área do seu perfil.
  - CA-01.2 Dado um usuário inativo, quando tenta login, então o acesso é negado.
  - CA-01.3 Dado um TECNICO, quando acessa uma URL da área ADM, então recebe acesso negado (checagem no servidor).

#### RF-02 – Gestão de usuários
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-34, DEC-39
- Regras:
  1. ADM cria usuários `ADM`, `TECNICO` e `CLIENTE`.
  2. Usuário `CLIENTE` **deve** estar vinculado a exatamente um cliente. Um cliente pode ter N usuários.
  3. Campos mínimos: nome, e-mail (único no sistema), perfil, ativo/inativo. Telefone opcional [A VALIDAR].
  4. Usuário não é excluído; é inativado (preserva assinaturas e registros).
  5. O ADM não altera o perfil de um usuário já criado (decisão B6; DFT-04; perfil fixo para qualquer usuário, confirmado em AF-16).
- Critérios de aceite:
  - CA-02.1 Dado um cliente com 3 usuários, quando qualquer um faz login, então vê os mesmos dados do cliente.
  - CA-02.2 Dado um e-mail já cadastrado, quando o ADM tenta criar outro usuário com ele, então o sistema bloqueia.
  - CA-02.3 Dado um usuário CLIENTE sem cliente vinculado, quando o ADM tenta salvar, então o sistema bloqueia.
  - CA-02.4 Dado um técnico inativado com visitas futuras, quando é inativado, então o sistema lista as visitas futuras dele para o ADM reatribuir.
  - CA-02.5 Dado um usuário já criado, quando o ADM tenta mudar o perfil dele, então o sistema não permite.
  - CA-02.6 Dada uma senha com menos de 8 caracteres, quando o usuário a define, então o sistema rejeita.

#### RF-03 – Isolamento de dados por perfil
- **Perfil:** todos · **Fase:** MVP · **Origem:** §9.1, DEC-36
- Regras:
  1. CLIENTE só lê dados (locais, contratos, equipamentos, visitas, PMOCs, relatórios) do seu cliente.
  2. TECNICO só lê e grava visitas atribuídas a ele, e lê os dados do local e dos equipamentos dessas visitas.
- Critérios de aceite:
  - CA-03.1 Dado um usuário do cliente A, quando requisita por ID um relatório do cliente B, então recebe acesso negado.
  - CA-03.2 Dado um técnico, quando a visita é reatribuída a outro técnico, então ele deixa de ver a visita (exceto registros que já enviou, ver RF-20 regra 3).
  - CA-03.3 Dado um técnico, quando requisita por ID uma visita de outro técnico, então recebe acesso negado. Os testes automatizados de isolamento cobrem os perfis `TECNICO` **e** `CLIENTE` (decisão B13).

### 7.2 Cadastros

#### RF-04 – Empresa executora e RT
- **Perfil:** ADM · **Fase:** MVP · **Origem:** §2.1, DEC-14, DEC-23, DEC-29, DEC-34
- Regras:
  1. Existe **um único** registro de empresa executora e **um único** RT (DEC-14, DEC-34).
  2. Empresa: razão social, CNPJ, telefone, endereço completo (logradouro, nº, bairro, cidade, UF, CEP), registro CREA, logo (imagem). Todos obrigatórios (§9.5).
  3. RT (pessoa física, campos separados da empresa – DEC-29): nome, título, nº de registro, telefone, e-mail, endereço completo. Todos obrigatórios.
  4. Certificado e-CPF do RT: upload de arquivo A1 + senha, guardados criptografados (RNF-09). Sistema mostra titular e data de validade do certificado.
  5. Alterar empresa/RT não muda PMOCs já emitidos (o PDF emitido é imutável, RNF-15).
- Critérios de aceite:
  - CA-04.1 Dado que a empresa já existe, quando o ADM tenta criar outra, então o sistema não permite (só edição).
  - CA-04.2 Dado um certificado com validade vencida, quando o ADM tenta emitir PMOC, então a emissão é bloqueada com mensagem "certificado do RT vencido".
  - CA-04.3 Dado um certificado a vencer em ≤ 30 dias [A VALIDAR: prazo], então o ADM vê um alerta no painel.

#### RF-05 – Clientes
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-17, §9.5, B1–B7
- Regras:
  1. Cliente é sempre pessoa jurídica. CPF não é aceito (DEC-17).
  2. Obrigatórios: razão social, CNPJ válido (dígito verificador), endereço completo (logradouro, nº ou "s/n", cidade, UF, CEP com 8 dígitos).
  3. Opcionais: nome fantasia, telefones (até 2, sem duplicar).
  4. CNPJ único no sistema.
  5. Armazenar CNPJ, CEP e telefone **sem máscara**; aplicar máscara só na exibição/PDF.
- Critérios de aceite:
  - CA-05.1 Dado o CNPJ `28.474.019/0001-9` (13 dígitos), quando o ADM salva, então o sistema rejeita.
  - CA-05.2 Dado um CPF válido no campo CNPJ, quando o ADM salva, então o sistema rejeita.
  - CA-05.3 Dado o CEP `88.020-30` (7 dígitos), quando o ADM salva, então o sistema rejeita.
  - CA-05.4 Dado um endereço sem número, quando o ADM marca "s/n", então salva e o PDF imprime "s/n".

#### RF-06 – Locais
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-03, DEC-26, §9.5
- Regras:
  1. Um cliente tem N locais.
  2. Obrigatórios: nome, endereço completo. Telefone opcional.
  3. **Código do local**: gerado pelo sistema, único, imutável, usado na TAG (formato do exemplo `L012`) [A VALIDAR: regra exata de geração].
- Critérios de aceite:
  - CA-06.1 Dado um cliente com 2 locais, então cada local tem código distinto.
  - CA-06.2 Dado um local com equipamentos, quando o ADM tenta mudar o código, então o sistema não permite.

#### RF-07 – Contratos
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-02, DEC-03, DEC-06, DEC-15, DEC-21, DEC-28
- Regras:
  1. Um contrato pertence a um local. Um local tem **no máximo um contrato vigente** (períodos não podem se sobrepor).
  2. Obrigatórios ao salvar: data de início, data de fim (fim > início), nº de ART (decisão B8).
  3. Opcionais: código TH (ex.: `TH12326`) e revisão (ex.: `R1`), digitados manualmente.
  4. Duração livre por contrato (DEC-06).
  5. Estados: `A_INICIAR` (início futuro), `VIGENTE`, `ENCERRADO` (data de fim passou) e `CANCELADO` (decisão A6; D-08). Só contrato `A_INICIAR` ou `VIGENTE` pode ser cancelado; `ENCERRADO` e `CANCELADO` não (decisão R2 2.6).
- Critérios de aceite:
  - CA-07.1 Dado um local com contrato vigente até 30/07/2027, quando o ADM cria outro contrato começando em 01/06/2027, então o sistema rejeita por sobreposição.
  - CA-07.2 Dado um contrato sem ART, quando o ADM tenta salvá-lo, então o sistema bloqueia e informa o campo faltante (decisão B8). A checagem na emissão (RF-12, CA-12.1) permanece como garantia redundante.
  - CA-07.3 Dado um contrato sem código TH, então o PMOC é emitido normalmente e nada é impresso no lugar do código.

#### RF-08 – Tipos de equipamento e atividades (biblioteca)
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-04, DEC-08, DEC-10, DEC-27, DEC-30
- Regras:
  1. ADM cria, edita e exclui tipos. Campos: nome, **sigla** (usada na TAG, ex.: `SPL`; única), lista de grupos permitidos (ex.: Hi-Wall, Cassete).
  2. Cada tipo tem N atividades padrão. Campos da atividade: título, periodicidade padrão (`MM|MB|MT|MS|MA`), natureza (`VERIFICACAO` ou `MEDICAO`), unidade (obrigatória se `MEDICAO`, ex.: `V`, `A`, `psi`), ordem de exibição, **exige foto** (sim/não; decisão R2 2.7 a; RN-185).
  3. Sem campo de procedimento (DEC-27) e sem faixa de aceitação (DEC-10).
  4. Exclusão de tipo ou atividade já usado em PMOC: **não apaga** histórico; vira inativo e some de novos PMOCs (inferido).
  5. A biblioteca é **padrão**; alterá-la não muda PMOCs já criados (a cópia fica no PMOC, RF-10).
  6. Carga inicial: os tipos e atividades da análise §4 podem ser importados como semente [A VALIDAR].
- Critérios de aceite:
  - CA-08.1 Dado uma atividade `MEDICAO` sem unidade, quando o ADM salva, então o sistema rejeita.
  - CA-08.2 Dado um tipo usado em um PMOC, quando o ADM exclui, então o tipo fica inativo e o PMOC existente continua íntegro.
  - CA-08.3 Dado que o ADM muda a periodicidade padrão de uma atividade, então PMOCs já criados não mudam.

#### RF-09 – Equipamentos
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-18, DEC-26, §3.2
- Regras:
  1. Equipamento pertence a um local.
  2. Obrigatórios: tipo, grupo, ambiente/localização interna (ex.: "Consultório 03").
  3. Opcionais: marca, modelo, nº de série, capacidade (número) + unidade [A VALIDAR: unidade padrão "BTU/h"].
  4. **TAG gerada** no formato `{código do local}-{sigla do tipo}-{nº sequencial de 3 dígitos}`, ex.: `L012-SPL-003` (DEC-26). Sequencial por local + tipo. TAG é imutável e nunca reutilizada.
  5. Equipamento pode ser inativo (não excluído se tiver histórico).
  6. Inclusão/inativação de equipamento com PMOC vigente: ver §10, Q5 [A VALIDAR].
- Critérios de aceite:
  - CA-09.1 Dado o local `L012` com 2 Splits, quando o ADM cadastra o terceiro, então a TAG é `L012-SPL-003`.
  - CA-09.2 Dado que `L012-SPL-002` foi inativado, quando outro Split é cadastrado, então recebe `L012-SPL-004` (não reutiliza).
  - CA-09.3 Dado um equipamento sem ambiente, quando o ADM salva, então o sistema rejeita.

### 7.3 PMOC e cronograma

#### RF-10 – Plano de manutenção do PMOC
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-07, §9.2, §9.3
- Regras:
  1. Ao criar o PMOC de um contrato, o sistema copia, para cada tipo de equipamento presente no local, as atividades ativas da biblioteca com a periodicidade padrão.
  2. ADM pode alterar a periodicidade de cada atividade **neste PMOC** (vale para todos os equipamentos daquele tipo no PMOC). Só ADM (DEC-07).
  3. ADM pode remover ou incluir atividade no plano deste PMOC [A VALIDAR].
  4. Alteração de periodicidade **depois** da emissão: recalcula só ocorrências futuras sem registro; ocorrências com registro (OK/NOK) não mudam (inferido). Fica registrada na auditoria.
- Critérios de aceite:
  - CA-10.1 Dado a biblioteca com "Tensão" = MS para Split, quando o ADM muda para MM no PMOC do local X, então só o PMOC do local X usa MM.
  - CA-10.2 Dado uma alteração de periodicidade, então a auditoria guarda usuário, data/hora, valor anterior e novo.

#### RF-11 – Cronograma de ocorrências e estados
- **Perfil:** Sistema · **Fase:** MVP · **Origem:** DEC-05, DEC-12, DEC-22, DEC-25, §9.3, §9.4
- Regras:
  1. Mês 1 = mês de calendário da data de início do contrato. O cronograma cobre **toda a duração do contrato** (DEC-22).
  2. Intervalo `k`: MM=1, MB=2, MT=3, MS=6, MA=12. Ocorrência prevista nos meses `1, 1+k, 1+2k, …` dentro do contrato.
  3. Estados: `NAO_PREVISTA` (Ø), `PREVISTA`, `PENDENTE`, `OK`, `NOK`.
  4. `PREVISTA` → `PENDENTE` automaticamente no **dia seguinte ao último dia do mês previsto**, se não houver registro (DEC-25). Fuso: RNF-12.
  5. `PENDENTE` **nunca** vira `NOK` automaticamente (DEC-12).
  6. `NOK` exige observação (DEC-11).
  7. Uma ocorrência registrada após o fim do mês continua pertencendo ao mês previsto; a data real de execução fica no registro (inferido).
- Critérios de aceite:
  - CA-11.1 Dado contrato de 14/08/2026 a 30/07/2027 e atividade MS, então ela é prevista nos meses 1 (ago/26) e 7 (fev/27).
  - CA-11.2 Dado contrato de 18 meses e atividade MA, então ela é prevista nos meses 1 e 13.
  - CA-11.3 Dado ocorrência prevista em set/2026 sem registro, então em 01/10/2026 ela está `PENDENTE`, e em nenhum momento vira `NOK` sem ação do ADM.
  - CA-11.4 Dado registro NOK sem observação, então o sistema rejeita.

#### RF-12 – Emissão do PMOC (PDF)
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-01, DEC-02, DEC-13, DEC-15, DEC-19, DEC-21, DEC-28, DEC-32, §9.7
- Regras:
  1. Pré-condições para emitir: empresa e RT completos; certificado do RT válido; cliente, local e contrato completos; **nº de ART preenchido** (DEC-28, ver §10 P1); ao menos um equipamento ativo; plano com ao menos uma atividade.
  2. Conteúdo, nesta ordem: Capa → 1. Dados da instalação → 2. Dados do proprietário → 3. Dados da empresa executora → 4. Dados do responsável técnico (com assinatura) → 5. Listagem de equipamentos (agrupada por tipo + grupo, com TAGs) → 6. Cronograma (uma tabela por tipo, colunas `MM|MB|MT|MS|MA`) → Recomendações para falha e emergência (texto padrão, §10 P2) → Anexo 1: Portaria MS 3.523/1998 (texto padrão, §10 P3) → Anexo 2: Ficha histórico (uma por equipamento, toda a duração do contrato, blocos de 12 meses).
  3. Código TH e revisão impressos na capa e no rodapé **somente se informados**, no formato `{TH}-{revisão}` (ex.: `TH12326-R1`).
  4. Sem seção de qualidade do ar (DEC-13).
  5. Rodapé: `Página {n} de {total}`, data de geração, logo do sistema novo (DEC-32).
  6. Layout pode ser melhorado em relação ao Frigus (DEC-01); regras de formatação em RNF-07.
  7. Estados do PMOC: `RASCUNHO` → `EMITIDO` (assinado pelo RT) → `ASSINADO_CLIENTE`. Contrato encerrado ou renovado → `HISTORICO`.
- Critérios de aceite:
  - CA-12.1 Dado contrato sem ART, quando o ADM emite, então o sistema bloqueia e informa o campo faltante.
  - CA-12.2 Dado um campo opcional vazio (ex.: telefone), então o PDF não imprime `null` nem o rótulo vazio [A VALIDAR: omitir rótulo ou deixar em branco].
  - CA-12.3 Dado contrato de 18 meses, então cada ficha histórico cobre os 18 meses.
  - CA-12.4 Dado contrato com TH `TH12326` e revisão `R1`, então capa e rodapé mostram `TH12326-R1`.

#### RF-13 – Assinatura do PMOC pelo RT
- **Perfil:** Sistema · **Fase:** MVP · **Origem:** DEC-16, DEC-23
- Regras:
  1. Na emissão, o sistema assina o PDF automaticamente com o certificado e-CPF ICP-Brasil do RT guardado (RNF-09).
  2. O PDF mostra os dados do RT obrigatórios (RF-04 regra 3) e a indicação de assinatura digital.
  3. O MVP usa certificado tipo **A1** (arquivo; decisão A7). Fluxo alternativo para A3 (ADM baixa o PDF, RT assina fora, ADM envia o PDF assinado) não está previsto no MVP (confirmado em R2 2.11).
- Critérios de aceite:
  - CA-13.1 Dado um PMOC emitido, quando o PDF é aberto em um validador de assinatura ICP-Brasil [A VALIDAR: qual validador], então a assinatura do RT é reconhecida como válida.

#### RF-14 – Assinatura do PMOC pelo cliente
- **Perfil:** CLIENTE · **Fase:** MVP · **Origem:** DEC-16, DEC-20, DEC-24
- Regras:
  1. PMOC `EMITIDO` aparece no portal do cliente como "aguardando assinatura" e gera notificação no app (RF-19).
  2. Assinatura eletrônica simples (RNF-08): usuário lê o documento, marca o aceite e confirma.
  3. **Uma** assinatura de qualquer usuário ativo do cliente é suficiente [A VALIDAR, §10 Q3].
  4. Após assinado, o PMOC fica `ASSINADO_CLIENTE` e o PDF assinado é imutável.
- Critérios de aceite:
  - CA-14.1 Dado um PMOC assinado, então o registro guarda usuário, nome, e-mail, data/hora, IP e hash do documento.
  - CA-14.2 Dado um PMOC já assinado, quando outro usuário do cliente abre, então vê quem assinou e não há botão de assinar.

#### RF-15 – Renovação e histórico de PMOC
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-06
- Regras:
  1. Novo contrato do mesmo local → novo PMOC. O PMOC anterior vira `HISTORICO` (somente leitura, continua disponível para download) **imediatamente após o ADM acionar "Confirmar renovação"** (decisões C10 e R2 2.1 c; RN-192). As visitas restantes do contrato anterior continuam válidas, com o cronograma existente (R2 2.1 x). Salvar o contrato novo ou emitir o PMOC novo não confirma a renovação.
  1a. PMOC em `RASCUNHO` de contrato cancelado ou encerrado também vira `HISTORICO` (decisão A5); esse histórico nunca foi emitido e **não** aparece para cliente nem técnico (R2 2.4; RN-147).
  2. O novo PMOC pode copiar plano e equipamentos do anterior como ponto de partida (inferido).
- Critérios de aceite:
  - CA-15.1 Dado um local com 2 contratos sucessivos, então o cliente vê os 2 PMOCs, o mais antigo marcado como histórico.

#### RF-16 – Ficha histórico atualizada
- **Perfil:** ADM, CLIENTE · **Fase:** MVP · **Origem:** DEC-12, DEC-20, §9.7
- Regras:
  1. A ficha histórico (Anexo 2) mostra por ocorrência: Ø, OK, NOK, Pendente, ou vazio para prevista futura. Legenda inclui Pendente.
  2. ADM e cliente podem baixar a qualquer momento uma versão do PMOC com a ficha atualizada até a data do download.
  3. Relação entre essa versão atualizada e o PMOC assinado: ver §10 Q6 [A VALIDAR]. Proposta: o PDF assinado não muda; a versão atualizada é um novo PDF com data de geração no rodapé.
- Critérios de aceite:
  - CA-16.1 Dado uma ocorrência que o ADM mudou de Pendente para OK, quando o cliente baixa o PMOC atualizado, então a ficha mostra OK.

### 7.4 Agendamento

#### RF-17 – Visitas a agendar
- **Perfil:** Sistema, ADM · **Fase:** MVP · **Origem:** DEC-35 (inferido a partir do cronograma)
- Regras:
  1. Para cada mês do contrato com ao menos uma ocorrência prevista, o sistema cria uma visita `A_AGENDAR` com mês de referência, local e todos os equipamentos com ocorrências naquele mês [A VALIDAR].
  2. ADM pode dividir as ocorrências de um mês em mais de uma visita (ex.: local com muitos equipamentos atendido em dias diferentes) [A VALIDAR].
  3. ADM pode criar visita avulsa vinculada a um mês de referência [A VALIDAR].
- Critérios de aceite:
  - CA-17.1 Dado contrato com atividades só MT, então existem visitas a agendar nos meses 1, 4, 7 e 10 (e seguintes, se o contrato passar de 12 meses).
  - CA-17.2 Dado uma visita dividida em duas, então cada equipamento do mês fica em exatamente uma das duas visitas.

#### RF-18 – Agendamento flexível
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-35
- Regras:
  1. ADM define data (e horário opcional [A VALIDAR]) e técnico da visita → estado `AGENDADA`.
  2. ADM pode **a qualquer momento antes de a visita ser iniciada**: mudar data, mudar horário, trocar técnico, cancelar. Sem limite de vezes.
  3. Cada mudança grava histórico: campo, valor anterior, novo valor, usuário, data/hora, motivo opcional.
  4. Data fora do mês de referência é permitida, com aviso ao ADM; a visita continua cobrindo as ocorrências do mês de referência (RF-11 regra 7).
  5. Visita cancelada não apaga ocorrências; elas seguem o fluxo normal (podem virar `PENDENTE`).
  6. Estados da visita: `A_AGENDAR` → `AGENDADA` → `EM_ANDAMENTO` → `REGISTRADA` → (relatório, RF-24 a RF-26). `CANCELADA` a partir de `A_AGENDAR` ou `AGENDADA`.
  7. Visão de agenda para o ADM: lista e calendário por técnico e por data [A VALIDAR: formato de calendário].
- Critérios de aceite:
  - CA-18.1 Dado uma visita agendada para o técnico A em 10/11, quando o ADM troca para o técnico B em 12/11, então A deixa de ver a visita, B passa a ver, e o histórico registra as duas mudanças.
  - CA-18.2 Dado uma visita `EM_ANDAMENTO`, quando o ADM tenta trocar o técnico, então o sistema bloqueia [A VALIDAR].
  - CA-18.3 Dado uma visita remarcada para fora do mês de referência, então o ADM vê o aviso e a visita continua ligada ao mês original.

#### RF-19 – Notificações no app
- **Perfil:** todos · **Fase:** MVP · **Origem:** DEC-40
- Regras:
  1. Somente notificações **dentro do app** (central de notificações com contador de não lidas). Sem e-mail, WhatsApp ou SMS.
  2. Eventos mínimos:

| Evento | Quem recebe |
|---|---|
| Visita agendada, remarcada (data/horário) ou cancelada | Técnico atribuído; usuários do cliente |
| Técnico trocado | Técnico anterior, técnico novo; usuários do cliente |
| Relatório aguardando assinatura | Usuários do cliente |
| PMOC aguardando assinatura | Usuários do cliente |
| Relatório assinado pelo cliente | ADM; técnico da visita |
| Ocorrências que viraram Pendente | ADM |

- Critérios de aceite:
  - CA-19.1 Dado uma visita remarcada, então o técnico e os usuários do cliente veem uma notificação não lida com a data antiga e a nova.
  - CA-19.2 Dado uma remarcação ou troca de técnico, então nenhum e-mail, SMS ou WhatsApp é enviado.

### 7.5 App do técnico (PWA)

#### RF-20 – Agenda do técnico
- **Perfil:** TECNICO · **Fase:** MVP · **Origem:** DEC-33, DEC-35
- Regras:
  1. Lista das visitas atribuídas, ordenada por data, com local, endereço e estado.
  2. Detalhe da visita: endereço, equipamentos (TAG, tipo, grupo, ambiente, marca, modelo) e atividades previstas por equipamento.
  3. O técnico continua vendo, somente leitura, as visitas que ele registrou, mesmo que depois reatribuídas (inferido).
- Critérios de aceite:
  - CA-20.1 Dado um técnico com 5 visitas futuras, então vê as 5 e nenhuma de outro técnico.

#### RF-21 – Registro da manutenção
- **Perfil:** TECNICO · **Fase:** MVP · **Origem:** DEC-09, DEC-10, DEC-11
- Regras:
  1. Técnico inicia a visita → `EM_ANDAMENTO`; o sistema grava data/hora de início.
  2. Por equipamento, para cada ocorrência prevista: marcar `OK` ou `NOK`. `NOK` significa "não efetuado": a atividade não foi executada (decisão F1); NOK não representa atividade executada com resultado não conforme. Atividade **executada com problema** = `OK` com a marca "requer corretiva" e observação obrigatória (decisão R2 1.3 a; RN-193).
  3. Atividade `MEDICAO`: valor numérico obrigatório quando OK, com a unidade cadastrada (DEC-10, DEC-30). Sem faixa de aceitação.
  4. `NOK` exige observação (DEC-11).
  5. Fotos: até 10 por equipamento, 10 MB por foto, JPEG, PNG ou WebP, tiradas com a câmera ou da galeria (decisão D4; RN-185). Não são obrigatórias por padrão, mas passam a ser obrigatórias (pelo menos 1 foto do equipamento na visita) quando a atividade está marcada como "exige foto" (decisão R2 2.7 a e x; limite de 10 por equipamento na visita). Observação geral por equipamento, opcional.
  6. Técnico não inclui atividade fora do plano [A VALIDAR]; pode usar a observação.
  7. Salvamento automático a cada alteração (RNF-03 nível 1).
- Critérios de aceite:
  - CA-21.1 Dado uma atividade de medição "Tensão" (V) marcada OK sem valor, então o sistema não deixa finalizar.
  - CA-21.2 Dado uma atividade NOK sem observação, então o sistema não deixa finalizar.
  - CA-21.3 Dado uma atividade `OK` com a marca "requer corretiva" sem observação, então o sistema não deixa finalizar (RN-193).
  - CA-21.4 Dado uma atividade que exige foto, marcada sem nenhuma foto do equipamento na visita, então o sistema não deixa finalizar (RN-185).
  - CA-21.5 Dado que o app foi fechado no meio do registro, quando o técnico reabre, então os dados preenchidos continuam lá.

#### RF-22 – Registro offline
- **Perfil:** TECNICO · **Fase:** nível 1 no MVP, nível 2 na Fase 2 · **Origem:** DEC-37
- Regras: ver RNF-03.
- Critérios de aceite:
  - CA-22.1 (nível 1) Dado que a conexão cai durante o registro, então nada do que foi preenchido se perde e o envio é refeito quando a conexão volta.
  - CA-22.2 (nível 2) Dado uma visita baixada previamente, quando o técnico a executa inteira sem internet, então ao reconectar todos os registros e fotos são sincronizados e a visita fica `REGISTRADA`.

#### RF-23 – Finalização da visita
- **Perfil:** TECNICO · **Fase:** MVP · **Origem:** DEC-09
- Regras:
  1. Só finaliza se todas as ocorrências previstas da visita tiverem OK ou NOK com os dados obrigatórios (RF-21).
  2. Ao finalizar: grava data/hora de fim, atualiza estados das ocorrências, visita → `REGISTRADA`, e abre a geração do relatório (RF-24).
  3. Após finalizar, o técnico não altera registros; correções só pelo ADM (RF-29) [A VALIDAR].
- Critérios de aceite:
  - CA-23.1 Dado uma visita com 1 ocorrência sem marcação, então o botão finalizar fica bloqueado e indica qual falta.
  - CA-23.2 Dado uma visita finalizada, então as ocorrências aparecem como OK/NOK na ficha histórico (RF-16).

### 7.6 Relatório da visita

#### RF-24 – Geração do relatório por IA
- **Perfil:** TECNICO (ou ADM no painel) · **Fase:** MVP · **Origem:** DEC-09, DEC-11, DEC-31, DEC-38
- Regras:
  1. Entrada da IA: **somente** dados registrados na visita (equipamentos, atividades, OK/NOK, medições, observações, legendas/descrição das fotos se houver) e dados cadastrais do local. Sem dados pessoais desnecessários (RNF-05).
  2. Saída: texto do relatório com, no mínimo, resumo da visita, situação por equipamento e **necessidades de manutenção corretiva** apontadas a partir das ocorrências com a marca "requer corretiva", dos NOK (não efetuados) e das observações (DEC-11 emendada em 27/10/2026, AF-13: OK = preventiva executada; o relatório aponta a necessidade de corretiva e o cliente decide se faz).
  3. A IA **não pode** inventar medições, atividades ou equipamentos que não estão no registro (RNF-10).
  4. Estrutura detalhada e prompt: §10 P6 [A VALIDAR].
  5. Se a IA falhar ou estiver indisponível, o técnico pode escrever o texto manualmente (inferido).
- Critérios de aceite:
  - CA-24.1 Dado uma visita com 2 NOK, então o relatório gerado cita os 2 equipamentos/atividades como necessidade de corretiva.
  - CA-24.2 Dado uma visita sem medição de pressão, então o relatório não contém valor de pressão.

#### RF-25 – Revisão e envio pelo técnico
- **Perfil:** TECNICO · **Fase:** MVP · **Origem:** DEC-31, DEC-38
- Regras:
  1. O técnico lê e **pode editar** o texto gerado. Ele é o responsável pela elaboração (DEC-38).
  2. Ao enviar, o relatório vai **direto para assinatura do cliente**, sem aprovação do ADM (DEC-31, DEC-38). Estado: `AGUARDANDO_ASSINATURA`.
  3. O PDF do relatório identifica o técnico responsável (nome) e a data da visita.
  4. Conteúdo do PDF: dados do cliente e local, data e horário da visita, técnico, tabela por equipamento (TAG, atividades, OK/NOK, valores com unidade, observações), fotos, texto da IA revisado, campo de assinatura do cliente [A VALIDAR: layout].
  5. O sistema guarda o texto gerado pela IA e o texto final enviado (rastreabilidade, RNF-10).
- Critérios de aceite:
  - CA-25.1 Dado um relatório enviado pelo técnico, então ele aparece no portal do cliente sem passar por nenhuma tela de aprovação do ADM.
  - CA-25.2 Dado que o técnico editou o texto, então o sistema guarda as duas versões (IA e final).

#### RF-26 – Assinatura do relatório pelo cliente
- **Perfil:** CLIENTE · **Fase:** MVP · **Origem:** DEC-20, DEC-24
- Regras:
  1. Assinatura eletrônica simples (RNF-08) pelo portal do cliente.
  2. Uma assinatura de qualquer usuário ativo do cliente basta [A VALIDAR, §10 Q3].
  3. Estado final: `ASSINADO_CLIENTE`. PDF assinado imutável.
  4. O relatório não é assinado no celular do técnico. Existe o **comprovante de visita**, assinado no local por um responsável presente (decisão A3; RN-189; 05 §6.9), que não substitui a assinatura do relatório (Q1). O comprovante guarda só nome digitado, imagem da assinatura, data/hora e hash (decisão R2 2.9 a); sem CPF, cargo nem geolocalização.
  5. Cliente não assina: tratado pelo ADM no painel (RF-28, RF-29).
- Critérios de aceite:
  - CA-26.1 Dado um relatório assinado, então o PDF baixado contém nome do assinante, data/hora, IP e identificador de verificação.
  - CA-26.2 Dado um código de verificação válido digitado na tela pública "Verificar documento" (sem login), então a tela mostra só tipo do documento, data, hash e situação, sem nome de pessoa nem dado do cliente (06 INT-14; decisão R2 2.8 b).

#### RF-27 – Consulta e download de relatórios
- **Perfil:** ADM, CLIENTE, TECNICO (próprias) · **Fase:** MVP · **Origem:** DEC-20
- Critérios de aceite:
  - CA-27.1 Dado um cliente com 2 locais, então ele lista relatórios filtrando por local, período e estado (aguardando/assinado).
  - CA-27.2 Dado um relatório, então o download entrega o PDF da última versão (assinada, se houver).

### 7.7 Painel do ADM

#### RF-28 – Painel de pendências
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-12, DEC-42
- Regras: lista, com filtro por cliente, local, técnico e período:
  1. Ocorrências `PENDENTE`.
  2. Visitas com data passada não iniciadas ou não finalizadas.
  3. Visitas `REGISTRADA` sem relatório enviado.
  4. Relatórios `AGUARDANDO_ASSINATURA` há mais de N dias [A VALIDAR: N].
  5. PMOCs `EMITIDO` sem assinatura do cliente.
  6. Contratos a vencer em ≤ N dias e certificado do RT a vencer [A VALIDAR: N].
  7. Visitas `A_AGENDAR` sem data.
  8. Itens de sincronização (decisão D7.9, simplificado): registros do técnico não aplicados ou para conferir (`sync_review_item`, CF-01, CF-03, CF-05, CF-06) e técnicos com sincronização pendente há mais de 24 h (`device.oldest_pending_at`, decisão C3; AF-03). Vale para o offline nível 1 (decisão R2 1.1 b).
- Critérios de aceite:
  - CA-28.1 Dado 3 ocorrências pendentes no local X, então aparecem no painel e o filtro por local X mostra só elas.

#### RF-29 – Edição manual da manutenção
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-12, DEC-42
- Regras:
  1. ADM pode, em qualquer visita: preencher ou corrigir registros (OK/NOK, medições, observações, fotos), definir data de execução e técnico executor, finalizar a visita.
  2. ADM pode gerar o relatório por IA (RF-24), editar o texto e enviá-lo para assinatura do cliente.
  3. O relatório indica quem o elaborou (técnico ou ADM) [A VALIDAR: se o PDF mostra que foi lançado pelo ADM].
  4. Relatório `AGUARDANDO_ASSINATURA` pode ser retirado de assinatura pelo ADM, corrigido e reenviado.
  5. Relatório `ASSINADO_CLIENTE` não é editado; correção gera nova versão que exige nova assinatura [A VALIDAR].
  6. Relatório não assinado pelo cliente: ADM pode registrar a ação tomada [A VALIDAR: opções, §10 Q4].
  7. Toda edição grava auditoria (RF-31).
- Critérios de aceite:
  - CA-29.1 Dado uma visita sem nenhum registro do técnico, quando o ADM preenche tudo e envia o relatório, então o cliente recebe o relatório para assinar.
  - CA-29.2 Dado que o ADM alterou um OK para NOK, então a auditoria mostra usuário, data/hora, valor anterior e novo.

#### RF-30 – Resolução de pendências
- **Perfil:** ADM · **Fase:** MVP · **Origem:** DEC-12, DEC-25
- Regras:
  1. Para ocorrência `PENDENTE`, o ADM escolhe: lançar como `OK` (esquecimento do técnico; informa data de execução), `NOK` (observação obrigatória), **dispensar** (= `NOK` com observação obrigatória) ou **cancelar** (a ocorrência vira `NAO_PREVISTA` com motivo `PENDENCIA_CANCELADA`) (decisões B9 e R2 2.2; RN-091).
  2. Resolução em lote para várias ocorrências da mesma visita/mês [A VALIDAR].
- Critérios de aceite:
  - CA-30.1 Dado uma pendência resolvida como NOK sem observação, então o sistema rejeita.

#### RF-31 – Trilha de auditoria
- **Perfil:** ADM · **Fase:** MVP (registro) · **Origem:** §9.4 (inferido), RNF-06
- Regras: registrar criação, alteração e exclusão/inativação de cadastros, periodicidades, agendamentos, registros de ocorrência, relatórios, emissões e assinaturas, com usuário, data/hora, entidade, campo, valor anterior e novo.
- Critérios de aceite:
  - CA-31.1 Dado qualquer alteração feita pelo painel, então existe um registro de auditoria correspondente que não pode ser editado nem apagado pela interface.

### 7.8 Portal do cliente

#### RF-32 – Portal do cliente
- **Perfil:** CLIENTE · **Fase:** MVP · **Origem:** DEC-20, DEC-36, DEC-39
- Regras: o usuário do cliente vê, por local:
  1. **Cronograma de visitas**: próximas visitas (data, técnico) e visitas realizadas, só as autorizadas por DFT-15 e só dos contratos e locais do próprio cliente (decisão D5). Sem edição.
  2. PMOCs (vigente e históricos) para visualizar e baixar.
  3. Relatórios para visualizar e baixar.
  4. Itens aguardando assinatura (PMOC e relatórios) em destaque. A versão atual de cada PMOC e relatório vem destacada; as versões históricas continuam disponíveis (decisão D5; RN-186).
  5. Lista de equipamentos com TAG (somente leitura).
- Critérios de aceite:
  - CA-32.1 Dado uma visita remarcada pelo ADM, então o cronograma do cliente mostra a nova data e o novo técnico logo após a alteração.
  - CA-32.2 Dado um usuário do cliente, então ele não tem nenhuma ação de edição de cadastro ou agenda.

---

## 8. Requisitos não funcionais

| ID | Tema | Requisito | Origem |
|---|---|---|---|
| RNF-01 | Plataformas | ADM e cliente: aplicação web responsiva. Técnico: PWA instalável em celular. Navegadores e versões mínimas (Android/iOS, Chrome/Safari) [A VALIDAR]. | DEC-33 |
| RNF-02 | Escala e tenancy | Dimensionar para ~223 usuários (3 ADM, ~20 técnicos, ~200 de cliente), ~200 clientes e ~2.000 equipamentos (DEC-34 emendada, AF-12). Os testes de desempenho (spikes S-01 e S-05) usam esses números. **Instância de empresa única**: não criar modelo multi-tenant (sem `tenant_id`). | DEC-34 |
| RNF-03 | Offline | (Decisão A1: nível 2 é Fase 2.) **Nível 1 (MVP):** o PWA salva o registro localmente a cada alteração e reenvia automaticamente quando a conexão volta; nenhum dado digitado ou foto se perde por queda de conexão; o técnico pode acionar "Sincronizar agora" e baixar a agenda dos próximos dias **só para leitura** (decisão R2 1.1 b). **Nível 2 (Fase 2):** técnico baixa a visita **para executá-la** com antecedência, executa tudo sem internet e sincroniza depois; o app mostra claramente o que está pendente de envio. Conflito (ADM alterou a visita enquanto o técnico estava offline): o registro do técnico prevalece para ocorrências, e a alteração de agenda do ADM prevalece para data/técnico; regras completas CF-01 a CF-07 em `02`, §11.2 [A VALIDAR]. A arquitetura do MVP deve permitir o nível 2 sem reescrita. | DEC-37 |
| RNF-04 | Segurança | HTTPS obrigatório. Senhas com hash scrypt, mínimo de 8 caracteres (decisão B6). Sessão com expiração [A VALIDAR: tempo]. Autorização por perfil no servidor (RF-03). Segundo fator TOTP para o ADM (decisão R2 1.2 b; RN-194). Arquivos (PDFs, fotos) acessados só por URL autenticada ou assinada com expiração. | Boa prática (inferido) |
| RNF-05 | LGPD | 1. Dados pessoais tratados: nome, e-mail e telefone de usuários; IP e data/hora das assinaturas; dados do RT; fotos (podem captar pessoas). 2. Coletar só o necessário para o PMOC e os relatórios. 3. Na IA, enviar só os dados da visita; não enviar e-mail, telefone ou IP de usuários. 4. Política de privacidade e termo de uso acessíveis no app [A VALIDAR: texto]. 5. Retenção (decisão A8): registro oficial de PMOC emitido não é apagado automaticamente; correção de documento emitido gera nova versão e preserva o histórico; dados temporários e logs têm política própria; dados pessoais são apagados ou anonimizados quando permitido e cabível, respeitada a retenção legal; nenhum expurgo automático antes de categorias e prazos aprovados (RN-191). Prazos [A VALIDAR – advogado] (`docs/auditoria-final.md` §6). 6. Atendimento a pedidos do titular (acesso, correção) feito pelo ADM, registrado em `data_subject_request` (06 §2.5; AF-16). 7. Fornecedor de IA e de hospedagem com tratamento de dados compatível com a LGPD. Localização (AF-14): dados no Brasil são **preferíveis**, não obrigatórios: banco, arquivos e funções em São Paulo; a IA processa fora do Brasil. | Pedido do usuário; detalhes [A VALIDAR] |
| RNF-06 | Auditoria | Registros de auditoria (RF-31) são somente de inclusão; não podem ser alterados pela aplicação. | §9.4 (inferido) |
| RNF-07 | PDF | A4 retrato. PMOC e relatório da visita imprimem versão e código de verificação (decisão D6, RN-187). Gerado no servidor. Mesmo dado → mesmo conteúdo. Datas `dd/mm/aaaa`. CNPJ `00.000.000/0000-00`, CEP `00000-000`, telefone `(00) 0000-0000` ou `(00) 00000-0000`. Nunca imprimir `null`, `undefined` ou rótulo de campo vazio [A VALIDAR: omitir ou deixar em branco]. Quantidade por extenso com concordância correta (ex.: "1 (um) Split"; corrige B13). Sem texto duplicado tipo "tipo Tipo Janela" (B12). Cabeçalho com logo e dados da empresa; rodapé com paginação, data de geração, código TH-revisão quando houver e logo do sistema. | §9.7, DEC-32, B1–B13 |
| RNF-08 | Assinatura do cliente | Assinatura eletrônica simples (DEC-24). Evidências gravadas: ID do usuário, nome, e-mail, data/hora com fuso, IP, user-agent [A VALIDAR], hash SHA-256 do PDF assinado, texto do aceite exibido (§10 P5). O PDF final inclui uma página ou bloco de evidências da assinatura. Documento assinado é imutável. | DEC-16, DEC-20, DEC-24 |
| RNF-09 | Assinatura do RT | Certificado ICP-Brasil e-CPF. Assinatura automática exige tipo A1 (§10 P4). Arquivo e senha do certificado guardados criptografados, nunca expostos à interface nem a logs. Formato da assinatura no PDF (ex.: PAdES) [A VALIDAR]. | DEC-16, DEC-23 |
| RNF-10 | IA do relatório | 1. Fornecedor e modelo [A VALIDAR]. 2. Prompt instrui a usar só os dados fornecidos e a não inventar valores. 3. Guardar, por relatório: versão do prompt, modelo usado, texto gerado e texto final. 4. Falha da IA não bloqueia o fluxo (texto manual permitido). 5. Tempo máximo de geração [A VALIDAR]. | DEC-09, DEC-38 |
| RNF-11 | Fotos | Compressão no próprio celular antes do envio: JPEG, lado maior 1600 px, qualidade 0,7 (AF-17). Guardar data/hora da captura. Limites e formatos (decisão D4): até 10 fotos por equipamento, 10 MB por foto; aceita JPEG, PNG, WebP e HEIC na escolha e envia sempre JPEG; uma foto por requisição (RN-185). | DEC-09, decisão D4 |
| RNF-12 | Data e fuso | Datas de negócio (mês previsto, Pendente no dia seguinte) calculadas no fuso `America/Sao_Paulo` (inferido: empresa em SC). Timestamps gravados em UTC. O processamento diário roda às 00:05 `America/Sao_Paulo` (decisão C1). | DEC-25 |
| RNF-13 | Disponibilidade e backup | Backup diário do banco e dos arquivos com restauração testada. Metas adotadas (AF-20): disponibilidade mensal de 99,5% (06 DSP-01), perda máxima de 24 h de dados (DSP-03), retenção do backup externo de 30 diários + 12 mensais (05 ARQ-09). | 06 §4; AF-20 |
| RNF-14 | Idioma e usabilidade | Interface em português do Brasil. App do técnico usável com uma mão, botões OK/NOK grandes [A VALIDAR]. | DEC-33 |
| RNF-15 | Imutabilidade e versões | PDF de PMOC ou relatório, depois de emitido/assinado, nunca é sobrescrito; qualquer mudança gera nova versão com número sequencial e mantém as anteriores. | DEC-06, DEC-24 |
| RNF-16 | Desempenho | Para ~223 usuários (DEC-34 emendada): telas comuns respondem em até 2 s (decisão C5) e a emissão síncrona de PMOC com **200 equipamentos** (tamanho pessimista; o maior cliente atual tem ~50) termina em até 15 min (decisões C4 e R2 1.4 c; o tempo-alvo de 15 min com 200 equipamentos é provisório até o spike S-01); PDF com 30 equipamentos em até 30 s (06 DES-07; AF-20). Limite técnico: a função da Vercel para em 800 s, então a meta de 15 min é cumprida terminando em até 800 s; o spike S-01 mede isso antes da etapa de emissão, e o plano B (geração em partes) só entra se reprovar (AF-11). | Decisão C4, C5; [A VALIDAR] |

---

## 9. Fora de escopo

| Item | Motivo |
|---|---|
| Qualidade do ar (análise, laudo, parâmetros RE 09/2003) | DEC-13 |
| Abertura, execução ou controle de manutenção corretiva | DEC-11: o relatório só aponta a necessidade; o cliente decide |
| Anexar PDF da ART | DEC-15: só o número |
| Acesso do RT ao sistema | DEC-07, DEC-23 |
| Multiempresa (várias empresas executoras) | DEC-34 |
| Proprietário pessoa física (CPF) | DEC-17 |
| Aprovação do relatório pelo ADM antes do cliente | DEC-31, DEC-38 |
| Notificação por e-mail, WhatsApp ou SMS sobre agenda | DEC-40 |
| Faixa de aceitação / alarme de medição fora do padrão | DEC-10 |
| Procedimento detalhado por atividade | DEC-27 |
| Financeiro, faturamento, propostas comerciais, estoque de peças | Não citados pelo usuário. O código TH é só texto digitado (DEC-02) |
| Reproduzir o layout do Frigus | DEC-01 |

---

## 10. Pendências e pontos [A VALIDAR]

### 10.1 Herdadas da análise (§10 de `01-analise-pmocs-existentes.md`)

| ID | Pendência | Afeta |
|---|---|---|
| P1 | ~~Confirmar que o PMOC **não** é emitido sem ART (DEC-28)~~ Resolvida em 21/10/2026: a ART é exigida ao salvar o contrato (decisão B8) | RF-07, RF-12 |
| P2 | Texto padrão de recomendações para falha e emergência | RF-12 |
| P3 | Fidelidade do texto da Portaria 3.523/1998 e correção dos erros C1–C3 | RF-12 |
| P4 | ~~Tipo do certificado do RT~~ Resolvida em 21/10/2026: A1 (decisão A7). Validador e perfil PAdES: spike S-02 (AF-19) | RF-13, RNF-09 |
| P5 | Texto do aceite da assinatura eletrônica simples | RF-14, RF-26, RNF-08 |
| P6 | Prompt e estrutura do relatório gerado por IA | RF-24, RF-25 |
| P7 | Periodicidades padrão de tipos novos (o ADM define) | RF-08 |

### 10.2 Novas (não bloqueiam o início da implementação)

| ID | Pergunta | Proposta adotada até a resposta | Afeta |
|---|---|---|---|
| Q1 | O cliente assina o relatório **no celular do técnico** ao fim da visita, ou só pelo portal? | Só pelo portal, com usuário logado (cumpre DEC-24). O comprovante de visita assinado no local (A3) existe, mas não substitui a assinatura do relatório. | RF-26 |
| Q2 | Usuário do cliente vê todos os locais do cliente ou só alguns? | Todos os locais do cliente. | RF-03, RF-32 |
| Q3 | Qualquer usuário do cliente pode assinar, ou só alguns marcados como "assinante"? | Qualquer usuário ativo; uma assinatura basta. | RF-14, RF-26 |
| Q4 | O que o ADM faz com relatório que o cliente não assina (anexar assinatura obtida fora, encerrar como "não assinado" com motivo, só cobrar)? | Manter aguardando + painel de pendências; ADM pode registrar observação. | RF-29 |
| Q5 | Incluir ou inativar equipamento com PMOC vigente: gera nova versão do PMOC ou só atualiza a ficha? | Atualiza plano e ficha; ADM decide se emite nova versão (a revisão `R{n}` do contrato continua manual). | RF-09, RF-12 |
| Q6 | O PMOC assinado é o da emissão, e a ficha atualizada é um PDF à parte? Ou o cliente reassina periodicamente? | PDF assinado imutável; ficha atualizada gerada sob demanda, sem nova assinatura. | RF-16 |
| Q7 | Visita remarcada para outro mês: as ocorrências continuam no mês original da ficha? | Sim, ficam no mês de referência; data real fica no registro. | RF-11, RF-18 |
| Q8 | Haverá migração de clientes, equipamentos e históricos do Frigus? | Não no MVP; cadastro manual. | §6 |
| Q9 | O técnico pode cadastrar equipamento encontrado em campo e não listado? | Não; registra na observação e o ADM cadastra. | RF-09, RF-21 |
