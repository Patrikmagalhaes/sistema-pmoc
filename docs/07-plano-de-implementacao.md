# 07 – Plano de implementação do MVP (Etapas)

> **Versão:** 1.0 – 27/10/2026 (decisão AF-07 da auditoria final, `docs/auditoria-final.md` §5)
> **Base:** docs 00 a 06, glossário e CLAUDE.md. Este documento **não** cria regra nem requisito: só define a ordem de construção, o que cada etapa entrega e quando ela está pronta.
> **Leitor principal:** IA de código. Cite a etapa em tarefas e commits (ex.: `feat(acesso): Etapa 2 – RF-01 login`).

## Convenções

| Item | Regra |
|---|---|
| Etapa | Parte da construção do MVP, numerada de 1 a 10. "Etapa 1" é o que o usuário chama de "Fase 1 (fundação)"; "Etapa 2" é "Fase 2 (autenticação e permissões)". |
| "Fase 2" nos docs 00–06 | Quer dizer **depois do MVP** (ex.: offline nível 2). Nada marcado "Fase 2", "Depois" ou "Futuro" entra em nenhuma etapa. |
| Ordem | Uma etapa só começa quando a anterior cumpre o critério de pronto, exceto onde a coluna "Pode correr junto" diz o contrário. |
| Spike | Teste técnico curto do doc 05 §10.4. O spike indicado roda **antes** da etapa; se reprovar, pare e pergunte. |
| Pronto | Vale para toda etapa, além do critério próprio: `biome check`, `tsc --noEmit` e testes passando no CI; testes de isolamento (06 SEG-25) para toda rota nova acessível a `CLIENTE` ou `TECNICO`; doc de origem atualizado se uma regra mudou. |

## Visão geral

| Etapa | Nome | Spikes antes | Pode correr junto |
|---|---|---|---|
| 1 | Fundação | — | — |
| 2 | Autenticação e permissões | S-04, S-05 | — |
| 3 | Cadastros | — | — |
| 4 | Plano, cronograma e emissão do PMOC | S-01, S-02 | — |
| 5 | Agenda, visitas, notificações e jobs | S-03 | Etapa 6 pode começar quando a Etapa 5 tiver visitas agendáveis |
| 6 | App do técnico (PWA, offline nível 1) e comprovante | S-06 | — |
| 7 | Painel do ADM: lançamento manual e pendências | — | Etapa 8 |
| 8 | Relatório da visita com IA | — | Etapa 7 |
| 9 | Portal do cliente e assinaturas | — | — |
| 10 | Operação, LGPD e go-live | — | — |

## Etapa 1 – Fundação

**Objetivo:** projeto rodando, banco completo e a base de contexto, auditoria e isolamento pronta para todas as outras etapas.

| Entrega | Fonte |
|---|---|
| Repositório com a estrutura de pastas do doc 05 §5, versões exatas da stack (CLAUDE.md), Biome, `tsc`, Vitest, Testcontainers, Playwright e CI | 05 §3, §5, §7 |
| Regra de lint que impede importar arquivo interno de outro módulo | 05 MOD-02 |
| Projeto Supabase e Vercel na região São Paulo; API REST automática do Supabase desligada | 05 ADR-02; 06 GL-03; AF-14 |
| Papéis do banco (`app_rw` sem `BYPASSRLS` e sem ser dono; dono separado; `backup_ro`) | 03 E18; 05 §4.2 |
| Migrações de **todas** as tabelas do doc 03 (incluindo §2.11 e §2.12), com enums (`text` + `CHECK`), FKs, `CHECK`s, `UNIQUE`, `EXCLUDE` e índices da §5.2 | 03 §2, §4, §5.2 |
| Triggers genéricos: blocos `[P]` (`updated_at`, `row_version`), `[I]` (imutável), `BEFORE DELETE` (EL-1), auditoria `audit_row_change()` com a lista de exceções, proteção do `audit_log`, preenchimento e imutabilidade do `client_id` desnormalizado | 03 §5.3, §5.4; AF-06 |
| `withTransaction(ctx, fn)` gravando o contexto `app.*` com `set_config(..., true)` e parâmetros; leituras e escritas passam por ela | 05 MOD-05; AF-05 |
| `RequestContext` (tipo e montagem), helper `can(ctx, acao, recurso)` negando por padrão | 05 MOD-04; 06 SEG-20 |
| Função `app_visible_client` e as políticas de RLS da 05 §4.2 | 05 §4.2; ADR-05 |
| Seed mínimo de desenvolvimento (dados fictícios) | 05 §7.1; 06 LG-06 |

**Fora desta etapa:** triggers de regra de negócio (transições de estado, RN-122 e similares) entram na etapa do módulo que os usa.

**Pronto quando:** `pnpm db:migrate` cria o banco do zero; testes de integração provam que (a) escrita sem contexto falha, (b) leitura sem contexto nas tabelas com RLS volta vazia, (c) `CLIENTE` A não vê linha de B em nenhuma tabela com RLS, mesmo com `SELECT` sem filtro, (d) `audit_log` não aceita `UPDATE` nem `DELETE`.

## Etapa 2 – Autenticação e permissões

**Antes:** spike S-04 (Better Auth com tabelas `auth_*`, sem cadastro público, TOTP do ADM, sessões por perfil) e S-05 (RLS com `set_config` no pooler e desempenho com a escala da DEC-34).

| Entrega | Fonte |
|---|---|
| Better Auth 1.7 com tabelas `auth_*` ligadas por `app_user.auth_user_id`, fora da auditoria e da RLS; gancho que recusa `INATIVO` lendo `app_user` com contexto `SISTEMA` | 03 §2.1; 05 §3.3; AF-04 |
| Login, recuperação e senha inicial (FL-01; TL-001, TL-002, TL-003) | RF-01; 04 FL-01 |
| TOTP obrigatório do ADM com 10 códigos de recuperação (TL-004); redefinição por outro ADM; mínimo de 2 ADMs | RN-194; 06 SEG-05, SEG-06, SEG-17 |
| Sessões: web 12 h sem uso e 7 dias no máximo; PWA 30 dias renováveis; revogação | 06 SEG-10, SEG-13; AF-08 |
| Bloqueio por tentativas e limites de login e TOTP | 06 SEG-07, SEG-60, SEG-62 |
| Recusa de senha vazada ou óbvia | 06 SEG-02; AF-19 |
| `security_event` gravado em todo evento de acesso | 06 SEG-09, §3.3.3 |
| Gestão de usuários pelo ADM (TL-106, TL-107): criar com compensação, inativar (banir + revogar), perfil fixo | RF-02; RN-141, RN-179; AF-04, AF-16 |
| Minha conta (TL-005) | 04 §4.5; AF-09 |
| Matriz de permissões por perfil e testes de isolamento | RF-03; 02 §9; 06 SEG-20 a SEG-25 |

**Pronto quando:** S-04 e S-05 aprovados; ADM sem TOTP só vê TL-004; usuário inativo não entra; sessão expira conforme o perfil; testes de isolamento passam.

## Etapa 3 – Cadastros

| Entrega | Fonte |
|---|---|
| Empresa executora, RT e upload do certificado A1 cifrado (TL-102, TL-103) | RF-04; 03 §2.2; 06 §1.6 |
| Biblioteca de tipos, grupos e atividades, com `requires_photo` (TL-104, TL-105) | RF-08; RN-185 |
| Clientes, locais e contratos, com ART obrigatória e "Confirmar renovação" (TL-108 a TL-112) | RF-05 a RF-07, RF-15; RN-176, RN-192 |
| Equipamentos e TAG (TL-111) | RF-09; RN-046 |
| Uploads (logo, certificado) com chave gerada pelo servidor | 06 SEG-50 a SEG-53 |

**Pronto quando:** todos os CA de RF-04 a RF-09 passam; regras de unicidade e exclusão lógica testadas.

## Etapa 4 – Plano, cronograma e emissão do PMOC

**Antes:** spike S-01 (PDF de 200 equipamentos dentro de 800 s; AF-11) e S-02 (assinatura PAdES com A1 de teste; AF-19).

| Entrega | Fonte |
|---|---|
| Plano do PMOC e periodicidade por PMOC (TL-120) | RF-10 |
| `buildSchedule` e ocorrências | RF-11; RN-023 |
| Emissão síncrona: PDF, assinatura do RT, cronograma, visitas `A_AGENDAR` e notificação, numa transação (TL-121) | RF-12, RF-13; RN-009, RN-188 |
| Versões do PMOC, ficha atualizada, código de verificação | RF-15, RF-16; RN-187 |
| Tela pública "Verificar documento" (TL-007) com limite por IP | 04 §4.5; 06 INT-14; AF-09 |
| Texto padrão `RECOMENDACOES_PMOC` inserido por migração de dados (texto provisório; P2) | 03 `standard_text`; AF-16 |

**Pronto quando:** S-01 e S-02 aprovados; PDF de 1, 30 e 200 equipamentos com snapshot de texto (05 §3.11); falha em qualquer passo da emissão desfaz tudo.

## Etapa 5 – Agenda, visitas, notificações e jobs

**Antes:** spike S-03 (pg-boss acionado por cron, sem worker permanente).

| Entrega | Fonte |
|---|---|
| Agenda do ADM, agendar, remarcar, trocar técnico, cancelar, dividir, avulsa, incluir pendências (TL-130, TL-131) | RF-17, RF-18; FL-10 |
| Notificações no app (TL-010) | RF-19 |
| Jobs J-01 a J-04, J-07 (encerra ao esvaziar) e `job_run` | 05 §3.9; 06 OBS-10; AF-18, AF-20 |
| Painel de pendências TL-100 (grupos da 04 §4.2) | RF-28 |

**Pronto quando:** visitas geradas na emissão podem ser agendadas; job diário muda `PREVISTA` → `PENDENTE` e gera a notificação agrupada.

## Etapa 6 – App do técnico (PWA, offline nível 1) e comprovante

**Antes:** spike S-06 (PWA no iPhone: instalar, câmera, HEIC → JPEG, fotos, `persist()`, offline).

| Entrega | Fonte |
|---|---|
| PWA (Serwist), banco local (Dexie) com `device_id`, agenda e execução (TL-200 a TL-204) | RF-20, RF-21, RF-23; 05 §6 |
| Sincronização `/api/sync/v1` com idempotência, `X-Device-Id`, `device`, `sync_review_item` e regras CF-01 a CF-07 | RF-22; 02 §11.2; 05 §6.4; AF-03 |
| Fotos: conversão para JPEG, 1600 px, qualidade 0,7, upload direto, limites | RN-185; RNF-11; AF-17 |
| Envios pendentes, "Sincronizar agora" e "Baixar mais 7 dias" (TL-207) | 04 §4.5; AF-09 |
| Comprovante de visita offline (TL-206, `visit_receipt`, PDF no servidor) | RN-189; AF-10 |
| Blocos de sincronização no TL-100 | 04 §4.5; AF-03 |
| Texto padrão `TERMO_COMPROVANTE` inserido por migração de dados (texto provisório) | 03 `standard_text`; AF-16 |

**Fora desta etapa:** finalizar sem conexão, baixar visita para executar offline, PIN (Fase 2 / Depois).

**Pronto quando:** E2E com `setOffline(true)` (05 §3.11): registrar, fotografar e coletar comprovante sem conexão, reconectar, conferir no servidor e finalizar; nenhum dado perdido ao fechar o app.

## Etapa 7 – Painel do ADM: lançamento manual e pendências

| Entrega | Fonte |
|---|---|
| Lançamento manual e correção (TL-132), com "requer corretiva" e foto obrigatória | RF-29; FL-13; RN-090, RN-092, RN-193 |
| Resolver, dispensar e cancelar pendências (TL-134) | RF-30; FL-15; RN-091 |

**Pronto quando:** CA de RF-29 e RF-30 passam; toda correção aparece no `audit_log` com valor anterior.

## Etapa 8 – Relatório da visita com IA

| Entrega | Fonte |
|---|---|
| Geração do texto pela IA com limites (`ai_generation_count`, `rate_limit_counter`), revisão, versões, envio e PDF (TL-205, TL-133) | RF-24, RF-25; RN-128; 06 SEG-65; AF-18 |
| Texto que destaca "requer corretiva" e NOK como "não efetuado"; a decisão de fazer a corretiva é do cliente | DEC-11 emendada (AF-13) |

**Pronto quando:** CA de RF-24 e RF-25 passam; com a IA fora do ar, o texto manual funciona (RNF-10).

## Etapa 9 – Portal do cliente e assinaturas

| Entrega | Fonte |
|---|---|
| Portal do cliente (TL-300 a TL-306), com comprovante na aba Realizadas | RF-27, RF-32; AF-10 |
| Assinatura eletrônica simples de PMOC e relatório com evidências (TL-307) | RF-14, RF-26; RN-122 a RN-125 |
| Texto padrão `ACEITE_ASSINATURA` inserido por migração de dados (texto provisório; P5) | 03 `standard_text`; AF-16 |

**Pronto quando:** CA de RF-14, RF-26, RF-27 e RF-32 passam; testes de isolamento cobrem todas as rotas do portal.

## Etapa 10 – Operação, LGPD e go-live

| Entrega | Fonte |
|---|---|
| Backup externo J-08 e teste de restauração | 05 §3.9; 06 §4.2 |
| Sentry, Better Stack e health checks, sem alerta ativo (só painéis) | 05 §7.6; 06 §6; AF-15 |
| Pedidos de titular (TL-140) e exportação de dados | 06 §2.5; AF-16 |
| Checklist de go-live | 06 §8.1 |

**Pronto quando:** todos os itens **B** do checklist GL estão cumpridos.
