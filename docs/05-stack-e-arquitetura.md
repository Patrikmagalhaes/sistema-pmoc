# 05 – Stack e arquitetura do Sistema PMOC

> **Versão:** 1.2 – 27/10/2026 (decisões da auditoria final AF-01 a AF-20 incorporadas: `docs/auditoria-final.md` §5; ordem de construção em `docs/07-plano-de-implementacao.md`)
> **Base:** `docs/00-escopo-prd.md` (RF, RNF, DEC), `docs/02-regras-de-negocio.md` (RN, D-01 a D-08), `docs/03-modelo-de-dados.md` (DM-01 a DM-23), `docs/04-fluxos-e-telas.md` (FL, TL, PW, DFT) e o pedido do usuário de 17/10/2026 (premissas de escala, operação e orçamento).
> **Leitor principal:** IA de código. Cada decisão tem ID (`ADR-xx`, `ARQ-xx`). Use os IDs em commits, tarefas e testes.
> **Preços e versões:** consultados na web em **17/10/2026** (fontes na §11). Conversão: **US$ 1 = R$ 5,0693** (dólar comercial de 17/10/2026, 04h30). Valores **sem IOF e impostos** sobre serviço importado [A VALIDAR].

## Convenções

| Marca | Significado |
|---|---|
| **deve** | Obrigatório para a implementação. |
| **pode** | Permitido, não obrigatório. |
| `ADR-xx` | Registro de decisão de arquitetura (§9). |
| `ARQ-Qx` | Pergunta feita ao usuário nesta rodada, ainda sem resposta. O documento já aplica a opção sugerida. |
| `ARQ-xx` | Item de arquitetura a validar (§10.3). |
| `S-xx` | Spike técnico obrigatório antes de implementar a parte afetada (§10.4). |
| **[A VALIDAR]** | Não veio dos arquivos nem do usuário. Implementar como descrito, de forma fácil de mudar. |
| **[A VALIDAR – advogado]** | Questão jurídica. Não decidir sem parecer. |
| **(estimativa)** | Número calculado por mim a partir das premissas; não é medição nem preço publicado. |

### Perguntas desta rodada (respondidas em 21/10/2026; ARQ-Q4 em 27/10/2026)

| ID | Pergunta | Opção aplicada neste documento | Se a resposta for diferente |
|---|---|---|---|
| ARQ-Q1 | Visita inteira offline (RNF-03 **nível 2**) já no MVP? | **Respondida (A1 b, 21/10/2026): Fase 2.** O MVP fica no nível 1 (rascunho local e reenvio). O texto original aplicava "Sim"; leia a §6 como desenho-alvo da Fase 2, com `OFFLINE_LEVEL=1` no MVP. | Texto original: Nível 1 no MVP: a arquitetura da §6 continua igual; só o "Finalizar offline" e o download antecipado ficam desligados por flag (`OFFLINE_LEVEL=1`). |
| ARQ-Q2 | Cliente assina no celular do técnico, ao fim da visita, sem internet? | **Respondida (A3 a): Sim**, como **comprovante de visita** (§6.9; RN-189). O relatório da IA continua sendo assinado no portal. Conteúdo mínimo decidido em R2 2.9 a. Funciona sem internet como o resto do nível 1, sem cifra própria (AF-10). | Não: remover §6.9; RN-135 fica como está. |
| ARQ-Q3 | Certificado do RT é A1 ou A3? (PRD P4) | **Respondida (A7): A1**: assinatura automática no servidor (ADR-07). Validador: spike S-02 (AF-19). | A3: fluxo manual já previsto em RN-120 e doc 03 §8.2. |
| ARQ-Q4 | Dados precisam ficar no Brasil? (RNF-05.7) | **Respondida (AF-14, 27/10/2026): preferível.** Banco, arquivos e funções na região São Paulo. A IA processa fora do Brasil (§3.12). | Obrigatório: a IA vira o bloqueio (ARQ-12); Indiferente: Neon + R2 ficam equivalentes (§8). |

### Mudanças que este documento propõe nos documentos anteriores

Situação em 21/10/2026: a tabela abaixo foi a lista de mudanças propostas na escrita deste documento; cada linha informa se foi **aplicada**, **rejeitada** ou continua **pendente**.

| ID afetado | Documento | Mudança proposta | Motivo |
|---|---|---|---|
| RNF-03, RF-22, §6 do PRD | 00 | ~~Nível 2 passa para o MVP.~~ **Rejeitada (A1 b):** nível 2 continua na Fase 2. | ARQ-Q1. |
| PW-07, DFT-06, DFT-07 | 04 | ~~Download antecipado e finalizar offline.~~ **Rejeitada (A1 b):** 04 permanece (PW-07, DFT-07). D7.10 (baixar agenda) vale só para leitura (R2 1.1 b). | ARQ-Q1. |
| RN-135, PRD Q1 | 02, 00 | Novo "comprovante de visita" assinado no celular do técnico (§6.9). **Aplicada (A3 a):** RN-135, RN-189, RF-26. | ARQ-Q2. |
| DM-08 | 03 | Isolamento na aplicação **mais** Row Level Security para o perfil `CLIENTE` (ADR-05). **Aplicada (B3 a).** | Isolamento entre clientes é requisito de segurança crítico (pedido do usuário). |
| DM-11 | 03 | Chave de criptografia do certificado em variável de ambiente da hospedagem (§3.13). **Pendente** (sem resposta). | Fecha o [A VALIDAR] de DM-11. |
| DM-23 | 03 | PostgreSQL na versão oferecida pelo Supabase, mínimo 16 [A VALIDAR]. **Pendente** (sem resposta). | Hospedagem escolhida (ADR-02). |
| RNF-02 | 00 | ~~Dimensionar para o ano 3, não para ~100 usuários.~~ **Rejeitada (B5 a):** vale DEC-34 (~100 usuários). | Novas premissas de escala. |

---

## 1. Resumo executivo

### 1.1 Arquitetura em 10 linhas

1. **Monolito modular** em **Next.js 16.4 (App Router) + TypeScript 7 + PostgreSQL**: um repositório, um deploy, módulos por domínio (ADR-01).
2. Hospedagem gerenciada: **Vercel Pro** (funções na região São Paulo, `gru1`) + **Supabase Pro** (Postgres e Storage em São Paulo, `sa-east-1`) (ADR-02).
3. Acesso ao banco com **Drizzle ORM**; regras críticas ficam no próprio banco (CHECK, EXCLUDE, triggers do doc 03) (ADR-03).
4. Autenticação com **Better Auth**: sem cadastro público, contas criadas só pelo ADM; segundo fator TOTP **só para o ADM** no MVP (R2 1.2 b; ADR-04); para TECNICO e CLIENTE é fase futura.
5. Isolamento entre clientes em duas camadas: autorização centralizada no servidor **e** Row Level Security para o perfil `CLIENTE` (ADR-05). Sem `tenant_id`.
6. App do técnico é **PWA offline-first**: IndexedDB (Dexie), service worker (Serwist), fila de envio própria com idempotência e `row_version` (ADR-06).
7. Conflitos evitados por desenho (uma visita = um técnico; equipe grande = visita dividida) e resolvidos por regra fixa por campo (§6.5).
8. PDFs gerados no servidor com **@react-pdf/renderer**, de forma **síncrona** na emissão do PMOC e do relatório (A2 a; ADR-07); PMOC assinado com e-CPF A1 (PAdES) no servidor (ADR-07).
9. Jobs (pendências diárias, vencimentos, limpeza) com **Vercel Cron + fila no Postgres (pg-boss)**; alertas só dentro do app; e-mail só para senha (Resend).
10. Custo estimado do ano 1: **≈ R$ 340/mês** (cabe no orçamento); backups externos diários e alertas automáticos para quem opera sozinho (§7, §8).

### 1.2 Premissas de escala usadas no dimensionamento

> **Decisão B5 a (21/10/2026): vale a DEC-34** (~100 usuários no total, empresa única). A tabela abaixo foi escrita com premissas maiores (ano 3: 300–500 usuários CLIENTE) e **não foi recalculada**. Os números reais informados em R2 (bloco 3) são: ~200 clientes, ~2.000 equipamentos no total, maior cliente ~50 equipamentos, 3 ADM, ~20 técnicos, ~200 usuários de cliente (~223 usuários). **Em 27/10/2026 a DEC-34 foi emendada para esses números (AF-12).** A tabela abaixo continua como cenário de folga para custos (ano 3); dimensionamento e testes de desempenho usam os números reais. O caso de teste de desempenho é de **200 equipamentos** por PMOC (R2 1.4 c).

| Item | Ano 1 | Ano 3 | Origem |
|---|---|---|---|
| Clientes | 100 | 300 | Usuário |
| Equipamentos | 200 | 800+ | Usuário |
| Usuários ADM / TECNICO / CLIENTE | 5 / 30 / ~100 | 5–10 / 30–50 / 300–500 | Usuário |
| Pico de usuários simultâneos | 60 | **≈ 185** (estimativa) | Ano 1: usuário. Ano 3: ver regra abaixo |
| Maior cliente | ~50 equipamentos (R2); testes com 200 (R2 1.4 c) | 200 equipamentos (teste pessimista) | Usuário |
| Relatórios de visita por mês | ≈ 400 (estimativa) | ≈ 1.200 (estimativa) | 1 a 4 visitas/mês por cliente ativo [A VALIDAR] |
| Fotos novas por mês | ≈ 1 GB (estimativa) | ≈ 3 GB (estimativa) | 3 fotos × 300 KB por equipamento visitado [A VALIDAR] |

**Regra do pico (estimativa):** 100% dos técnicos + 100% dos ADMs + 25% dos acessos de cliente simultâneos. Ano 1: 30 + 5 + 25 = 60 (bate com o informado). Ano 3: 50 + 10 + 125 = **185**. Dimensionar para **200**.

Para esse volume, a carga é pequena: 200 usuários simultâneos geram poucas dezenas de requisições por segundo (estimativa). O que exige cuidado não é o volume, e sim o **cliente grande**: PDF de 200 equipamentos, listagens longas e carga offline (§3.8, §6.7).

### 1.3 Avaliação crítica da stack pretendida

| Escolha | Veredito | Comentário |
|---|---|---|
| **TypeScript** | Manter | Um só idioma no servidor, na web e no PWA; tipos compartilhados entre API de sincronização e app offline. Versão 7.0 (compilador nativo) é suportada pelo `next build` desde o Next.js 16.3. |
| **PostgreSQL** | Manter | O doc 03 depende de recursos do Postgres (`EXCLUDE` com `btree_gist`, `citext`, triggers, `jsonb`, RLS). Não trocar. |
| **Next.js** | Manter, **com 3 cuidados** | É bom para web ADM + portal + PWA no mesmo código. Os cuidados: (1) **Server Actions não servem para a sincronização offline**: o PWA precisa de API HTTP estável e versionada (§3.1); (2) em hospedagem serverless não há processo rodando o tempo todo, então jobs e PDFs grandes precisam de fila (§3.9); (3) o framework muda rápido (4 versões menores em 12 meses), então fixar versão e atualizar de forma planejada. |
| O que **não** faltou na sua escolha, mas faltava no projeto | Adicionar | Camada offline (Dexie + Serwist + fila), fila de jobs, armazenamento de objetos, backup externo e monitoramento. |

**Alternativa considerada e descartada para o app do técnico:** app nativo/híbrido (React Native/Expo ou Capacitor). Comparação e gatilhos de revisão na §6.11. Conclusão: **o PWA basta para o MVP**, com ressalvas do iOS.

---

## 2. Estilo arquitetural

### 2.1 Recomendação: monolito modular

| Critério | Monolito modular | Serviços / microsserviços |
|---|---|---|
| Deploy | 1 projeto, 1 pipeline | N pipelines, versionamento entre serviços |
| Transações | Uma transação cobre emissão do PMOC + cronograma + visitas (D-04 a) | Exige saga/eventos para a mesma operação |
| Auditoria por trigger (DM-07) | Funciona direto (contexto `app.*` gravado com `set_config` na mesma transação) | Cada serviço precisaria repetir |
| Operação por 1 pessoa | Viável | Inviável no orçamento e no tempo |
| Escala necessária (≈ 200 simultâneos) | Sobra capacidade | Nenhum ganho |

**Decisão:** monolito modular (ADR-01). Microsserviços **não** se justificam: não há equipes separadas, nem partes com escala muito diferente, nem requisito de deploy independente.

### 2.2 Regras do monolito modular (para a IA de código)

| ID | Regra |
|---|---|
| MOD-01 | Cada módulo de domínio fica em `src/modules/<modulo>/` e expõe só o que está em `index.ts`. |
| MOD-02 | Um módulo **não** importa arquivos internos de outro módulo (`repo.ts`, `domain/*`). Só pelo `index.ts`. Garantido por regra de import no lint (§3.14). |
| MOD-03 | Só a camada `repo.ts` de cada módulo acessa o banco. Telas, Server Actions e Route Handlers chamam serviços (`service.ts`). |
| MOD-04 | Toda função de serviço recebe um `ctx` (`RequestContext`: usuário, perfil, `clientId` quando `CLIENTE`, `requestId`, IP, canal) e checa permissão antes de qualquer leitura ou escrita (RN-160 a RN-172). |
| MOD-05 | Todo acesso ao banco (escrita **e** leitura) roda dentro de `withTransaction(ctx, fn)`, que grava o contexto `app.*` com `SELECT set_config(..., $n, true)` e parâmetros do driver (doc 03 §5.3; §4.2; AF-05). Nunca montar texto de `SET LOCAL`. Leitura fora dessa função devolve zero linhas nas tabelas com RLS (falha fechada), e escrita fora dela falha no trigger de auditoria. Exceção: as tabelas `auth_*`, acessadas só pelo Better Auth (doc 03 §2.1, AF-04). |
| MOD-06 | Regras de cálculo puras (ex.: `buildSchedule`, RN-023) ficam em `domain/` sem acesso a banco, rede ou relógio do sistema (data recebida por parâmetro, RNF-12). |
| MOD-07 | O processamento diário e as limpezas autorizadas rodam como **job** (§3.9). **Exceção por decisão A2 a:** a emissão do PMOC e o PDF do relatório rodam **de forma síncrona** na requisição (sem job e sem estado "emitindo"), assim como a geração do texto da IA, com tempo máximo (RNF-10.5). |

### 2.3 Módulos

| Módulo | Conteúdo | Documentos |
|---|---|---|
| `acesso` | Login, sessão, usuários, MFA, recuperação de senha | RF-01, RF-02, FL-01, FL-05 |
| `autorizacao` | Políticas por perfil, `RequestContext`, helpers de escopo | RF-03, RN-160 a RN-172 |
| `empresa` | Empresa executora, RT, certificado | RF-04, FL-02 |
| `clientes` | Cliente, local, contrato | RF-05 a RF-07 |
| `biblioteca` | Tipos, grupos, atividades | RF-08 |
| `equipamentos` | Equipamentos, TAG | RF-09 |
| `pmoc` | Plano, versões, emissão, ficha | RF-10 a RF-16 |
| `cronograma` | Ocorrências, estados, pendências | RF-11, RN-029 |
| `visitas` | Agenda, remarcação, divisão | RF-17, RF-18 |
| `execucao` | Registros, fotos, notas, finalização, API de sincronização | RF-20 a RF-23 |
| `relatorios` | IA, versões, envio | RF-24, RF-25 |
| `assinaturas` | Assinatura do cliente, evidências, comprovante de visita | RF-14, RF-26, §6.9 |
| `notificacoes` | Central de notificações | RF-19 |
| `auditoria` | Leitura do `audit_log` | RF-31 |
| `arquivos` | `stored_file`, URLs assinadas, upload direto | DM-12, RN-171 |
| `jobs` | Fila, agendamentos, reprocessamento | §3.9 |

---

## 3. Stack completa

Versões = última estável publicada no npm em 17/10/2026. **Fixar versão exata** no `package.json` (sem `^`) e atualizar com Renovate/Dependabot em lote mensal.

### 3.0 Tabela resumo

| Camada | Escolha | Versão | Alternativa descartada | Motivo do descarte |
|---|---|---|---|---|
| Framework | Next.js (App Router) | 16.4.2 | Remix/React Router, SPA + API separada (NestJS) | Dois projetos para uma pessoa manter; Next já cobre web, portal e PWA |
| UI | React | 19.3.1 | — | Vem com o Next.js |
| Linguagem | TypeScript | 7.0.2 | TypeScript 6 | TS 7 é suportado pelo `next build` desde 16.3; manter `@typescript/typescript6` só se uma ferramenta usar a API do compilador |
| Mutações web | Server Actions (+ `next-safe-action` 8.7.3) | — | API REST para tudo | Mais código para telas internas sem ganho |
| API do PWA | Route Handlers versionados (`/api/sync/v1/*`) | — | Server Actions | Server Actions não têm contrato HTTP estável nem versionamento; o PWA offline roda versões antigas por dias |
| Banco | PostgreSQL (Supabase) | ver ADR-02 | MySQL, MongoDB | Doc 03 usa recursos exclusivos do Postgres |
| ORM | Drizzle ORM / drizzle-kit | 0.45.4 / 0.31.11 | Prisma 7.10.1 (8.0 em RC) | §3.2 |
| Driver | `postgres` (postgres.js) | 3.4.9 | `pg` 8.23.1 | Ambos servem; postgres.js é o padrão documentado do Drizzle com pooler em modo transação (`prepare: false`) |
| Autenticação | Better Auth (plugins `admin` e `twoFactor`) | 1.7.10 | Auth.js, Clerk, Supabase Auth | §3.3 |
| Validação | Zod | 4.6.7 | Valibot, Yup | Padrão do ecossistema (Drizzle, next-safe-action, Better Auth) |
| PDF | @react-pdf/renderer | 4.9.0 | Chromium/Playwright HTML→PDF | §3.6 |
| Assinatura PDF (RT) | @signpdf/signpdf | 3.3.0 | Serviço externo de assinatura | §3.6, S-02 |
| Arquivos | Supabase Storage (S3-compatível) | — | Cloudflare R2, Vercel Blob | §3.7 |
| Jobs agendados | Vercel Cron (Pro) | — | GitHub Actions como cron | Cron da Vercel chama a própria aplicação, com logs no mesmo lugar |
| Fila | pg-boss (no mesmo Postgres) | 12.38.0 | Vercel Queues, Inngest, Trigger.dev, Redis/BullMQ | §3.9 |
| Offline (dados) | Dexie (IndexedDB) | 4.4.6 | PowerSync, ElectricSQL/PGlite, RxDB | §6.3 |
| Offline (service worker) | Serwist (`@serwist/next`) | 9.5.13 | next-pwa, Workbox puro | next-pwa sem manutenção ativa [A VALIDAR]; Serwist é o sucessor baseado em Workbox |
| Estado de dados no cliente | TanStack Query | 5.104.4 | SWR | Melhor controle de modo offline e reenvio |
| E-mail transacional | Resend | 6.34.1 (SDK) | Amazon SES, SMTP próprio | §3.10 |
| IA do relatório | Anthropic API (`@anthropic-ai/sdk`) | 0.135.0 | — | RNF-10.1 [A VALIDAR], §3.12 |
| Testes unitários/integração | Vitest + Testcontainers Postgres | 5.0.5 / 12.2.1 | Jest | Mais rápido, ESM nativo |
| Testes E2E | Playwright | 1.64.1 | Cypress | Emula celular e modo offline (`context.setOffline`) |
| Lint + formatação | Biome | 2.5.15 | ESLint 10.13 + Prettier 3.9 | §3.14 |
| Erros | Sentry (`@sentry/nextjs`) | 11.8.0 | Só logs da Vercel | §7.6 |
| Disponibilidade | Better Stack (uptime + heartbeat) | — | UptimeRobot | §7.6 |

### 3.1 Framework: Next.js 16.4, App Router, Server Actions vs. API

| Uso | Mecanismo | Regra |
|---|---|---|
| Telas ADM e portal do cliente (leitura) | **Server Components** chamando serviços | Sem API intermediária. Sempre passando `ctx` (MOD-04). |
| Formulários ADM e ações do cliente (assinar) | **Server Actions** via `next-safe-action` com schema Zod | Uma action por caso de uso; nome = verbo + entidade (`emitirPmoc`, `assinarDocumento`). Checagem de permissão dentro do serviço, não só na action. |
| PWA do técnico (sincronização) | **Route Handlers** em `/api/sync/v1/*` | Contrato JSON versionado; cabeçalhos `Idempotency-Key` (DM-22) e `X-App-Version`. Nunca Server Action. |
| Upload de fotos e arquivos | Route Handler que devolve **URL de upload assinada** do Storage | O arquivo vai direto do aparelho para o Storage. Motivo: limite de **4,5 MB** no corpo de requisição das funções da Vercel. |
| Download de PDFs e fotos | Route Handler `/api/arquivos/:id` que checa permissão e redireciona para URL assinada curta | RN-171. |
| Cron e jobs | Route Handlers `/api/cron/*` protegidos por segredo (`CRON_SECRET`) | §3.9. |

Configuração obrigatória:
- `runtime = "nodejs"` em todas as rotas (sem Edge runtime: o driver do Postgres e a assinatura de PDF precisam de Node).
- Região das funções: `gru1` (São Paulo), a mesma do banco.
- `maxDuration`: 60 s nas rotas comuns; 300 s na geração de texto da IA; até 800 s na rota que processa jobs (limite do Pro).

### 3.2 ORM: Drizzle

| Critério | Drizzle 0.45 | Prisma 7.10 |
|---|---|---|
| Proximidade do SQL | Alta: o schema é TypeScript que espelha as tabelas | Média: DSL própria |
| Recursos do doc 03 (EXCLUDE, CHECK com regex, índices parciais, triggers, RLS) | Ficam em migrações SQL escritas à mão, versionadas junto | Também exigem SQL à mão; o schema Prisma não os representa |
| Contexto `app.*` por transação (`set_config(..., true)`, auditoria e RLS) | Direto, na mesma transação | Possível, com mais cuidado com o pool |
| Peso em serverless | Leve | Mais pesado historicamente; a v7 reduziu [A VALIDAR] |
| Estabilidade da versão | 0.45 estável; 1.0 em RC | 7.10 estável; o npm marca 8.0 RC como `latest`, o que exige cuidado na instalação |

**Decisão:** Drizzle (ADR-03). Regras:
- `src/server/db/schema/*.ts` define tabelas para tipagem e consultas.
- Migrações: `drizzle-kit generate` para tabelas e colunas; **SQL à mão** (`db/sql/*.sql`) para triggers, funções, CHECK complexos, EXCLUDE, políticas RLS e permissões (`GRANT/REVOKE`). Ambos aplicados em ordem por um único comando (`pnpm db:migrate`).
- Exclusão lógica (EL-5): consultas usam views `*_live` ou helper `live(table)`; nunca esquecer `deleted_at IS NULL`.
- Atualizar para Drizzle 1.0 quando sair estável, em tarefa separada.

### 3.3 Autenticação e autorização

**Biblioteca:** Better Auth 1.7 (ADR-04), com tabelas no próprio Postgres.

| Requisito | Como atender |
|---|---|
| Sem autocadastro | Cadastro público desligado; rota de sign-up não exposta [A VALIDAR: nome exato da opção na versão 1.7, ver S-04]. |
| Só o ADM cria contas | Plugin `admin`: criação de usuário, banimento, listagem e revogação de sessões. A **troca de perfil fica desligada**: o ADM não troca o perfil de um usuário (decisão B6; DFT-04). |
| Senha inicial | ADM cria → sistema envia link "Definir senha" por e-mail (DFT-01; token em `auth_verification`, decisão B6 e AF-04; rotas `/senha/definir` e `/senha/esqueci`, decisão C7). |
| Tabelas e ligação (AF-04) | Tabelas próprias do Better Auth com prefixo `auth_` (`auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_two_factor`, `auth_rate_limit`), ligadas por `app_user.auth_user_id`. Ficam fora do trigger de auditoria e sem RLS; eventos de acesso vão para `security_event`. Ganchos do Better Auth que leem `app_user` (ex.: recusar usuário `INATIVO`) usam `withTransaction` com contexto `SISTEMA`. Detalhe: doc 03 §2.1. |
| 3 perfis (RBAC) | Coluna `app_user.role` (`ADM`, `TECNICO`, `CLIENTE`) do doc 03. O papel interno do Better Auth é sincronizado com ela; a **fonte de verdade é `app_user.role`**. |
| Vínculo usuário-cliente | `app_user.client_id` obrigatório para `CLIENTE` (RN-169). Carregado no `RequestContext` a cada requisição. |
| MFA | **MVP só para o ADM (decisão R2 1.2 b, 21/10/2026; revê B2 b nesse ponto).** Plugin `twoFactor` (TOTP + 10 códigos de recuperação), obrigatório para ADM; TECNICO e CLIENTE: **fase futura** (opcional). Motivo: o ADM tem acesso a tudo, inclusive ao certificado do RT. Regra de negócio: 02 RN-194. Tabela `auth_two_factor` (AF-04); nomes das opções do plugin na versão 1.7: spike S-04. |
| Sessão | Sessão em banco (`auth_session`) + cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Duração **decidida (AF-08)**: web ADM e CLIENTE expira após 12 h sem uso, limite absoluto de 7 dias; PWA do técnico 30 dias renováveis a cada uso (06 SEG-10). |
| Usuário inativo | Ao inativar: banir + revogar todas as sessões (RN-141, CA-01.2). |
| Senha | Hash **scrypt**; mínimo **8** caracteres (decisão B6; DFT-21). Recusa de senha vazada ou óbvia: 06 SEG-02. O mínimo de 8 fica abaixo do recomendado pelo NIST para senha sem segundo fator; risco aceito com SEG-02 e o bloqueio de SEG-07 (AF-19). |
| Limite de tentativas | Rate limit no login e na recuperação de senha. |

**Alternativas descartadas:**

| Alternativa | Motivo |
|---|---|
| Auth.js (NextAuth) | Agora mantido pela equipe do Better Auth, que recomenda Better Auth para projetos novos. |
| Clerk / serviço pago | Custo por usuário ativo e dados de usuário fora do nosso banco; o requisito é simples. |
| Supabase Auth | Funciona, mas prende a autenticação ao Supabase e complica a migração de hospedagem (§8.4). |

**Autorização (não é da biblioteca de login):** fica no módulo `autorizacao`, em código nosso:
- `can(ctx, acao, recurso)` com a matriz do PRD §3.2 como tabela de dados.
- Helpers de escopo: `scopeClient(ctx)` (CLIENTE), `scopeTechnician(ctx)` (TECNICO).
- Recurso de outro cliente devolve **404**, não 403 (RN-162: não revelar existência).
- Segunda camada no banco: RLS (§4).

### 3.4 Validação: Zod 4

- Um schema Zod por entrada (formulário, payload de sincronização, variável de ambiente).
- Schemas em `src/modules/<modulo>/schemas.ts`, **compartilhados** entre servidor, web e PWA.
- Validação no cliente é conveniência; a do servidor é obrigatória.
- Variáveis de ambiente validadas na inicialização (`src/server/env.ts`); a aplicação não sobe com variável faltando.
- Validadores de domínio (`isValidCnpj` alfanumérico, DM-13; CEP; UF) em `src/lib/validators/`, com o mesmo algoritmo das funções SQL do doc 03.

### 3.5 Notificações e e-mail

Ver §3.10.

### 3.6 Geração de PDF (inclusive PMOC grande)

| Critério | @react-pdf/renderer 4.9 | Chromium headless (Playwright/Puppeteer) |
|---|---|---|
| Roda em função serverless | Sim (JavaScript puro) | Exige binário do Chromium no pacote (limite de 250 MB) e mais memória |
| Controle de paginação, cabeçalho, rodapé `Página n de total` (RNF-07) | Nativo | Via CSS de impressão, menos previsível |
| Mesmo dado → mesmo PDF (RNF-07) | Sim | Depende de fontes e versão do navegador |
| Layout complexo (tabelas do cronograma) | Mais trabalhoso | Mais fácil (HTML/CSS) |

**Decisão:** @react-pdf/renderer (ADR-07). Chromium fica como plano B se o spike S-01 falhar, e é a escolha natural numa VPS (§8).

**PMOC do cliente grande (200 equipamentos, tamanho pessimista; o maior cliente atual tem ~50):**
- Tamanho esperado: uma ficha histórico por equipamento (RF-12.2) → **200+ páginas** (estimativa).
- A emissão é **síncrona** (decisão A2 a): o ADM clica "Emitir", a tela fica em "Gerando e assinando o PDF…" (04 E-08.7) até terminar, numa única função. O desenho original em job assíncrono (estado "emitindo", notificações "PDF pronto" e "job falhou") **não** vale; só volta se o spike S-01 mostrar que o limite de tempo não cabe (AF-11).
- Memória da função: 4 GB (máximo do Pro); tempo máximo: 800 s. A meta decidida é de **15 min (900 s)** (C4), agora dimensionada para **200 equipamentos** (R2 1.4 c), e continua **maior** que esses 800 s: o spike S-01 mede o tempo real com 200 equipamentos e confirma que cabe: **decidido (AF-11)**: cumprir os 15 min significa terminar dentro de 800 s. O S-01 roda antes da etapa de emissão (doc 07); se reprovar, entra o plano B do ADR-07 (geração em partes). Não trava o início do projeto.
- Se o spike S-01 mostrar que 200 equipamentos não cabem em 800 s ou 4 GB: gerar por partes (capa + seções; fichas em lotes de 100) e juntar as partes antes de assinar.
- O PDF final é gravado em `stored_file` (nunca sobrescrito, RN-126) e só depois assinado.
- Relatório da visita: PDF pequeno, gerado também de forma síncrona (A2 a), costuma terminar em segundos.

**Assinatura do RT (A1, ARQ-Q3):**
- `@signpdf/signpdf` com o PKCS#12 do RT decifrado só em memória, dentro da requisição síncrona de emissão (A2 a; RN-121).
- Formato PAdES [A VALIDAR] (RNF-09). Validar o resultado no validador oficial do ITI [A VALIDAR] (CA-13.1).
- Spike S-02 antes de implementar.

### 3.7 Armazenamento de arquivos

| Item | Regra |
|---|---|
| Serviço | **Supabase Storage**, bucket **privado**, região São Paulo. 100 GB incluídos no Pro; excedente US$ 0,0213/GB. |
| Chave do objeto | `{kind}/{yyyy}/{mm}/{uuid}.{ext}`. Nunca nome original na chave. `stored_file.storage_key` (DM-12). |
| Imutabilidade | Objeto nunca é sobrescrito nem apagado pela aplicação (RN-126). O usuário de Storage da aplicação não tem permissão de exclusão [A VALIDAR: política do Supabase Storage]. |
| Upload de fotos | Aparelho pede URL de upload assinada → envia direto ao Storage → confirma em `/api/sync/v1/photos/confirm` com `sha256` e tamanho. Só depois da confirmação a foto conta como enviada. |
| Download | Sempre por `/api/arquivos/:id` (checa permissão) → URL assinada de **5 minutos** [A VALIDAR] (RN-171). |
| Assinaturas desenhadas e comprovantes | Mesmo bucket, `kind` próprio. |
| Certificado do RT | **Não** vai para o Storage. Fica no banco criptografado (DM-11, §3.13). |
| Backup | O backup diário do Supabase **não inclui os arquivos** do Storage. Cópia externa obrigatória (§7.5). |

**Descartadas:** Cloudflare R2 como armazenamento principal (sem região no Brasil confirmada [A VALIDAR]; fica como destino de backup externo, §7.5); Vercel Blob (mais caro por GB em `gru1`: US$ 0,041 vs. US$ 0,0213 do Supabase).

### 3.8 Listagens e paginação (cliente grande)

| Regra | Detalhe |
|---|---|
| Paginação no servidor | Toda lista com mais de 25 itens possíveis é paginada no servidor. Página padrão **25** (decisão C2; UL-01). |
| Tipo | **Keyset** (cursor por `(ordem, id)`) nas listas grandes (equipamentos, ocorrências, auditoria); `OFFSET` só em listas pequenas. |
| Filtros | Sempre por local antes de qualquer outra coisa nas telas do cliente grande. |
| Índices | Os do doc 03 §5.2 cobrem os filtros principais; conferir com `EXPLAIN` no spike S-05 com 200 equipamentos × 12 meses. |
| Exportação | Listas exportáveis rodam como job quando passam de 1.000 linhas [A VALIDAR]. |

### 3.9 Filas e jobs agendados

**Desenho:** **Vercel Cron** dispara rotas; trabalho pesado vai para a fila **pg-boss**, que mora no mesmo Postgres (ADR-01, sem serviço extra).

| ID | Job | Quando | Regra atendida |
|---|---|---|---|
| J-01 | Processamento diário: `PREVISTA` → `PENDENTE`, notificação agrupada | 00:05 `America/Sao_Paulo` = **03:05 UTC** (cron da Vercel é em UTC) | RN-029, RN-106 |
| J-02 | Estados de contrato (`A_INICIAR` → `VIGENTE` → `ENCERRADO`) | Junto do J-01 | RN-142 |
| J-03 | Vencimento do certificado do RT (`A_VENCER`, `VENCIDO`) | Junto do J-01 | RN-114 |
| J-04 | Itens do painel com prazo (relatório parado há N dias, contrato a vencer) | Calculado na consulta do painel; não precisa de job | RN-111, RN-113 |
| J-05 | ~~Geração de PDF via fila~~ **Não vale no MVP (A2 a):** PMOC e relatório são gerados de forma síncrona. Ficha atualizada e PDF com evidências de assinatura: execução síncrona; limite de tempo conferido no S-01 (AF-11) | Sob demanda | RF-12, RF-25, RN-125, RN-131 |
| J-06 | Limpeza de `idempotency_key` expirados | Diário | DM-22. É limpeza de dado temporário; precisa de política aprovada (RN-191); suspenso até lá. `password_reset_token` não existe mais: os tokens ficam em `auth_verification` e a biblioteca cuida deles (AF-04) |
| J-07 | Processador da fila | Cron **a cada minuto**: encerra assim que a fila estiver vazia; com jobs, executa até 700 s e encerra (06 FIN-08; AF-20) | — |
| J-08 | Backup externo (banco + Storage) | Diário, fora da Vercel (GitHub Actions) | RNF-13, §7.5 |

**Geração de OS (visitas):** **não** é job. As visitas são criadas na mesma transação da emissão do PMOC (D-04 a, RN-060). Assim nunca existe PMOC emitido sem visitas.

**Regras da fila:**
- Todo job é idempotente (rodar duas vezes não duplica nada) e tem `singletonKey` quando faz sentido (ex.: `visit_report:{visit_report_version_id}`).
- Até 3 tentativas com espera crescente; falha final gera notificação para os ADMs e evento no Sentry.
- J-01 envia **heartbeat** ao Better Stack ao terminar; se não chegar, você recebe alerta (§7.6).
- Fuso: todo cálculo de data de negócio usa `America/Sao_Paulo` (RNF-12), nunca o fuso do servidor.

**Descartadas:**

| Alternativa | Motivo |
|---|---|
| Vercel Queues | Prende a fila à Vercel; o pg-boss migra junto com o banco para qualquer hospedagem. |
| Inngest / Trigger.dev | Mais um fornecedor, conta e cobrança para algo que o Postgres resolve neste volume. |
| Redis + BullMQ | Exige servidor Redis e processo sempre ligado. |

Pendência: confirmar o pg-boss em modo "buscar sob demanda" (sem worker permanente) e com conexão direta ao banco (não pelo pooler em modo transação). Spike S-03.

### 3.10 E-mail e notificações

| Canal | Uso | Regra |
|---|---|---|
| Notificação dentro do app | **Todos** os alertas (RN-100 a RN-107) | Tabela `notification`; contador de não lidas atualizado a cada navegação e a cada 60 s com a aba aberta [A VALIDAR]. Sem WebSocket. |
| E-mail (Resend) | Definir senha, recuperar senha e e-mails de segurança e ao operador (exceção a RN-100, decisão B4 a); código de MFA **não** é enviado por e-mail (06 SEG-06a) | Plano gratuito: 3.000 e-mails/mês, 100/dia. Pro: US$ 20/mês, 50.000/mês. O gratuito cobre o volume (estimativa: < 100 e-mails/mês). Domínio próprio com SPF e DKIM. |
| Push do PWA | **Fase 2** (PRD §6) | No iOS, push web só para app adicionado à tela de início (iOS/iPadOS 16.4+). |
| WhatsApp, SMS | Proibido (DEC-40) | — |

### 3.11 Testes

| Nível | Ferramenta | O que cobre | Quando roda |
|---|---|---|---|
| Unitário | Vitest | Regras puras: `buildSchedule` (RN-023), meses por periodicidade, TAG, validadores (CNPJ, CEP), máscaras do PDF (RNF-07), resolução de conflito (§6.5) | Cada commit (CI) |
| Integração | Vitest + Testcontainers (Postgres real) | Migrações, triggers (auditoria, imutabilidade, transições), CHECK/EXCLUDE, **RLS**, serviços com `ctx`, API de sincronização com idempotência | Cada PR (CI) |
| Isolamento entre clientes | Vitest (integração) | Para **cada** rota e action acessível ao `CLIENTE`: usuário do cliente A pede IDs do cliente B → 404 (CA-03.1, RN-162). Lista de rotas gerada automaticamente; rota nova sem teste quebra o CI. | Cada PR |
| E2E | Playwright | Ciclo completo da §5 do PRD; PWA em viewport de celular com `setOffline(true)`: registrar, fotografar e coletar o comprovante sem conexão, reconectar, conferir no servidor e só então finalizar (no MVP, finalizar exige conexão: 04 DFT-07) | Cada PR (contra o deploy de preview) |
| PDF | Vitest | Snapshot de texto extraído do PDF (não de imagem) para PMOC de 1, 30 e 200 equipamentos | Cada PR (o de 500, só no noturno) |
| Carga | k6 ou Playwright em lote [A VALIDAR] | 200 usuários simultâneos (§1.2) | Antes do go-live e a cada mudança grande |

Meta de cobertura: 90% em `domain/` e `autorizacao`; sem meta numérica no resto [A VALIDAR].

### 3.12 IA do relatório

| Item | Decisão |
|---|---|
| Fornecedor | Anthropic API [A VALIDAR] (RNF-10.1). |
| Modelo | `claude-opus-5-5` (US$ 4 / 1M tokens de entrada; US$ 20 / 1M de saída). Alternativa mais barata: `claude-sonnet-5-5` (US$ 2 / US$ 10). Escolha final após comparar qualidade em 20 visitas reais [A VALIDAR]. |
| Custo por relatório | ≈ 3.000 tokens de entrada + 1.500 de saída (estimativa) → **US$ 0,042** (Opus 5.5) ou **US$ 0,021** (Sonnet 5.5). |
| Custo mensal | Ano 1 (≈ 400): US$ 16,80 ≈ **R$ 85**. Ano 3 (≈ 1.200): US$ 50,40 ≈ **R$ 256** (Opus) ou US$ 25,20 ≈ **R$ 128** (Sonnet). |
| Onde roda | Na requisição do técnico/ADM, com `maxDuration` 300 s e resposta em streaming; exige conexão (E-12.4). |
| Saída | Estruturada (JSON validado por Zod) → texto do relatório; guarda modelo, versão do prompt, texto da IA e texto final (RN-128). |
| Dados enviados | Só os dados da visita e do local; sem e-mail, telefone ou IP (RN-172). |
| Localização dos dados | A API permite escolher a geografia de processamento (`inference_geo`), mas **não há opção Brasil** conhecida; o processamento ocorre fora do país. Transferência internacional sob a LGPD [A VALIDAR – advogado] (ARQ-12). |
| Falha | Texto manual permitido (RNF-10.4). |

### 3.13 Segredos e certificado do RT

| Segredo | Onde fica |
|---|---|
| Variáveis da aplicação (banco, Storage, Resend, Anthropic, `CRON_SECRET`, `AUTH_SECRET`) | Variáveis de ambiente criptografadas da Vercel, separadas por ambiente. |
| PKCS#12 e senha do e-CPF | Banco (`rt_certificate`), cifrados com AES-256-GCM pela aplicação; chave mestra `CERT_ENCRYPTION_KEY` só em variável de ambiente de produção (fecha DM-11). Troca de chave: script de recriptografia [A VALIDAR]. |
| Cópia de emergência das chaves | Gerenciador de senhas com acesso de emergência (§10.2, SPOF-01). |

### 3.14 Lint, formatação e qualidade

| Item | Decisão |
|---|---|
| Lint + formatação | **Biome 2.5** (um binário, uma configuração). |
| Tipos | `tsc --noEmit` (TypeScript 7) no CI. |
| Regra de módulos (MOD-02) | Restrição de imports no Biome (`noRestrictedImports`) para caminhos internos de outros módulos [A VALIDAR: sintaxe na 2.5]. |
| Hooks de commit | `lefthook` ou `husky` rodando Biome nos arquivos alterados [A VALIDAR]. |
| Mensagens de commit | Conventional Commits com ID do requisito (`feat(execucao): RF-21 ...`). |

**Descartado:** ESLint 10 + Prettier 3.9. Duas ferramentas, duas configurações e mais dependências; o `next lint` foi descontinuado no Next.js 15.5, então não há integração obrigatória a preservar.

---

## 4. Isolamento de dados entre clientes

### 4.1 Opções avaliadas

| Opção | Segurança | Esforço para quem opera sozinho | Veredito |
|---|---|---|---|
| A. Só na aplicação (filtro por `client_id` em toda consulta, DM-08) | Boa, **se** ninguém esquecer o filtro. Um único `WHERE` esquecido vaza dados. | Baixo | Insuficiente sozinha para acesso externo |
| B. A + **Row Level Security para o perfil `CLIENTE`** | Alta: mesmo com bug na aplicação, o banco não devolve linhas de outro cliente | Médio-baixo: a infraestrutura de contexto `app.*` já existe para a auditoria (doc 03 §5.3) | **Recomendada** |
| C. B + RLS para `TECNICO` | Alta | Alto: regras do técnico dependem de atribuição de visita e histórico (RN-164, RN-165), mais difíceis de expressar e testar em SQL | Não no MVP |
| D. `tenant_id` em todas as tabelas | Isola **empresas executoras**, não clientes | Alto, sem benefício (empresa única, DEC-34, RNF-02) | **Não** |

**Por que `tenant_id` não resolve:** o risco aqui é um cliente ver dados de **outro cliente da mesma empresa**. `tenant_id` separa empresas executoras (SaaS). O "dono" de cada dado do portal já é o `client_id` (direto ou via `site` → `client`).

### 4.2 Recomendação (ADR-05)

**Camada 1 – aplicação (obrigatória para todos os perfis):**
1. Toda consulta passa por um serviço que recebe `ctx` (MOD-04).
2. Para `CLIENTE`, os repositórios usam `scopeClient(ctx)`, que injeta `client_id = ctx.clientId`.
3. Recurso fora do escopo → 404 (RN-162).

**Camada 2 – banco (para o perfil `CLIENTE`):**
1. A aplicação usa o usuário de banco `app_rw`, **sem** `BYPASSRLS` e **sem** ser dono das tabelas (o doc 03 §5.3 já prevê dono separado).
2. Em toda transação, `withTransaction` grava também (com parâmetros, AF-05; lista completa no doc 03 §5.3):
   ```sql
   SELECT set_config('app.actor_role', $1, true),  -- 'CLIENTE'; já existe para auditoria
          set_config('app.client_id',  $2, true);  -- uuid do cliente; '' para outros perfis
   ```
3. Função auxiliar `app_visible_client(client_id uuid) RETURNS boolean`:
   - `true` se `app.actor_role` ≠ `'CLIENTE'` (ADM, TECNICO, SISTEMA: controle fica na camada 1);
   - senão, `client_id = current_setting('app.client_id')::uuid`;
   - se `app.actor_role` estiver vazio → `false` (falha fechada: conexão sem contexto não vê nada).
4. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + política `USING (app_visible_client(<client_id da linha>))` nas tabelas que o portal lê:

| Tabela | Como chega ao `client_id` |
|---|---|
| `client` | `id` |
| `site` | `client_id` |
| `contract`, `equipment` | via `site_id` → `site.client_id` |
| `pmoc`, `pmoc_ficha_export` | via `contract` → `site` |
| `occurrence`, `visit_occurrence`, `visit_schedule_change` | via `site` ou `contract` |
| `visit_report`, `document_signature`, `photo` | via `visit` ou documento de origem |
| `pmoc_version`, `visit`, `visit_report_version`, `stored_file`, `visit_receipt` | coluna `client_id` própria (desnormalizada, AF-06) |
| `notification` | `recipient_user_id = app.actor_user_id` (todos os perfis) |
| `app_user` | `CLIENTE` vê só usuários do próprio cliente (nome de quem assinou, CA-14.2) |

5. **Decidido (AF-06):** `client_id` desnormalizado (preenchido por trigger, imutável) em `pmoc_version`, `visit`, `visit_report_version`, `stored_file` e `visit_receipt`; as políticas dessas tabelas usam a própria coluna. Em `stored_file`, `client_id` nulo = arquivo sem cliente, nunca visível ao `CLIENTE`. O spike S-05 mede o desempenho com esse desenho.
6. Jobs rodam com `app.actor_role = 'SISTEMA'`.
7. As tabelas `auth_*` do Better Auth não têm RLS (AF-04): só o servidor as acessa, e a API REST automática do Supabase fica desligada (06 GL-03).

**Arquivos:** bucket privado, chave com `uuid`, download só via rota que checa permissão (§3.7). O Storage nunca é exposto ao navegador do cliente com credencial própria.

**Testes obrigatórios (CI):** para cada tabela com RLS, teste de integração que abre transação como `CLIENTE` A e confirma zero linhas de B, inclusive com `SELECT` direto sem filtro (simula bug da aplicação).

### 4.3 Porta para SaaS no futuro

| Pergunta | Resposta |
|---|---|
| Vale preparar agora? | **Não adicionar `tenant_id` agora.** Vai contra DEC-34/RNF-02 e cobra em toda consulta e teste. |
| O que já deixa a porta aberta, sem custo | PK `uuid` (DM-01); `executor_company` como registro único (vira "um por tenant"); RLS e contexto `app.*` já existentes (basta somar `app.tenant_id`); módulos isolados. |
| Custo de virar SaaS depois (estimativa) | Migração com `tenant_id` em ~30 tabelas, preenchido com o tenant atual; política RLS por tenant em todas as tabelas; unicidades passam a incluir `tenant_id` (ex.: `site.code`, `equipment.tag`, e-mail); certificado e configuração por tenant; cobrança e cadastro público. Ordem de grandeza: **semanas de trabalho**, não meses, porque a base (RLS, contexto por transação) já existe. Sem número preciso [A VALIDAR]. |

---

## 5. Estrutura de pastas do repositório

Repositório único, gerenciador **pnpm**, sem monorepo (um só app).

```
pmoc/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                  # lint, tipos, unit, integração, E2E no preview
│     ├─ migrate-production.yml  # aplica migrações (aprovação manual)
│     └─ backup.yml              # J-08: pg_dump + cópia do Storage para fora (diário)
├─ db/
│  ├─ migrations/                # geradas pelo drizzle-kit + SQL à mão, numeradas
│  ├─ sql/                       # funções, triggers, RLS, GRANT/REVOKE (fonte dos SQL à mão)
│  └─ seed/                      # dados mínimos de dev (biblioteca de tipos, usuários de teste)
├─ docs/
│  ├─ 00-escopo-prd.md … 05-stack-e-arquitetura.md
│  └─ runbooks/                  # restaurar backup, trocar certificado, rotacionar chave, incidente
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login, senha/definir, senha/esqueci
│  │  ├─ (adm)/adm/...           # TL-1xx
│  │  ├─ (cliente)/cliente/...   # TL-3xx
│  │  ├─ (tecnico)/tecnico/...   # TL-2xx (PWA)
│  │  ├─ api/
│  │  │  ├─ auth/[...all]/route.ts
│  │  │  ├─ sync/v1/             # bootstrap, pull, push, photos/upload-url, photos/confirm
│  │  │  ├─ arquivos/[id]/route.ts
│  │  │  └─ cron/                # daily, jobs (processador da fila), cleanup
│  │  ├─ sw.ts                   # service worker (Serwist)
│  │  └─ layout.tsx
│  ├─ modules/
│  │  └─ <modulo>/               # ver §2.3
│  │     ├─ index.ts             # única porta de entrada (MOD-01)
│  │     ├─ domain/              # regras puras (MOD-06)
│  │     ├─ service.ts           # casos de uso com ctx (MOD-04)
│  │     ├─ repo.ts              # acesso ao banco (MOD-03)
│  │     ├─ schemas.ts           # Zod
│  │     ├─ actions.ts           # Server Actions (web)
│  │     └─ *.test.ts
│  ├─ server/
│  │  ├─ db/                     # cliente Drizzle, schema/, withTransaction
│  │  ├─ auth/                   # configuração do Better Auth
│  │  ├─ context.ts              # RequestContext
│  │  ├─ jobs/                   # pg-boss, registro de handlers
│  │  ├─ pdf/                    # componentes react-pdf, fontes, assinatura
│  │  ├─ ai/                     # cliente Anthropic, prompts versionados
│  │  ├─ storage/                # URLs assinadas, upload
│  │  ├─ crypto/                 # cifra do certificado
│  │  └─ env.ts                  # validação das variáveis (Zod)
│  ├─ pwa/
│  │  ├─ db.ts                   # Dexie: tabelas locais
│  │  ├─ sync/                   # outbox, pull, push, conflitos
│  │  └─ photos.ts               # compressão e fila de upload
│  ├─ components/                # UI compartilhada
│  └─ lib/                       # formatação (máscaras RNF-07), datas (America/Sao_Paulo), validadores
├─ tests/
│  ├─ integration/
│  ├─ isolation/                 # testes de isolamento entre clientes (§4.2)
│  ├─ e2e/
│  └─ fixtures/                  # cliente pequeno (1 equip.), médio (30), grande (200)
├─ biome.json
├─ drizzle.config.ts
├─ next.config.ts
├─ vercel.json                   # crons, região gru1
└─ package.json
```

---

## 6. Estratégia offline-first (PWA)

**Decisão A1 b (21/10/2026): o nível 2 é Fase 2.** Esta seção descreve o desenho-alvo; no MVP vale o nível 1 (rascunho local e reenvio, `OFFLINE_LEVEL=1`). PW-07 e DFT-07 do doc 04 permanecem como estão. **Decisão R2 1.1 b:** o MVP inclui também "Sincronizar agora", o painel de envios pendentes e a agenda dos próximos dias baixada **só para leitura** ("Baixar mais 7 dias"); baixar uma visita **para executá-la offline** e finalizar offline continuam na Fase 2 (nível 2).

### 6.1 Princípios

| ID | Princípio |
|---|---|
| OF-01 | O servidor é a fonte da verdade. O aparelho guarda uma **cópia parcial** (só o que o técnico precisa) e uma **fila de alterações** (outbox). |
| OF-02 | Toda ação do técnico grava primeiro no IndexedDB e só depois é enviada (PW-01). A tela nunca espera a rede. |
| OF-03 | Cada alteração na fila tem `idempotency_key` (DM-22), `entity_id` gerado no aparelho (DM-01, PW-04), `base_row_version` e a hora do aparelho (gravada nas colunas da 06 INT-20; AF-03). |
| OF-04 | A unidade de trabalho offline é a **visita**. O técnico só escreve em visitas atribuídas a ele (RN-164). |
| OF-05 | Nada é apagado do aparelho antes da confirmação do servidor (PW-08). |
| OF-06 | O app mostra sempre o estado: "Salvo no aparelho", "Enviando…", "Enviado", "Não enviado – nova tentativa automática" (PW-03) e um contador global de pendências de envio. |

### 6.2 O que fica no aparelho

| Item | Onde | Quando baixa | Quando sai |
|---|---|---|---|
| App (HTML, JS, CSS, fontes, ícones) | Cache do service worker (precache Serwist) | Na instalação e a cada nova versão | Nova versão substitui |
| Agenda do técnico: visitas `AGENDADA`/`EM_ANDAMENTO` atribuídas a ele | IndexedDB | Sincronização (§6.4) | Visita sai da janela ou é reatribuída, **depois** de tudo enviado |
| Para cada visita: local, endereço, equipamentos (TAG, tipo, grupo, ambiente, marca, modelo), ocorrências previstas, atividades (natureza, unidade) | IndexedDB | Junto com a visita | Junto com a visita |
| Inventário do local (todos os equipamentos ativos, só leitura) | IndexedDB | Junto com a visita | Junto com a visita |
| PMOC vigente do local (PDF) | Cache do service worker | **Sob demanda** ("Baixar PMOC para consulta offline") [A VALIDAR: técnico pode ver PMOC, hoje ❌ no PRD §3.2 e RN-166] | Ao sair a visita |
| Registros, notas, fotos, assinaturas feitas pelo técnico | IndexedDB (fotos como `Blob`) | Criados no aparelho | Após confirmação do servidor |
| Visitas já finalizadas pelo técnico (somente leitura, RN-165) | **Não** ficam offline | — | — |
| Dados de outros clientes, outros técnicos, contratos, auditoria | **Nunca** | — | — |

### 6.3 Armazenamento local e bibliotecas

| Camada | Escolha | Motivo |
|---|---|---|
| Banco local | **Dexie 4.4** sobre IndexedDB | API simples, transações, índices, suporte a `Blob`; sem servidor extra. |
| Service worker | **Serwist 9.5** (`@serwist/next`) | Precache do app, estratégia de cache por rota, atualização controlada. |
| Sincronização | **Código próprio** (`src/pwa/sync/`) | O domínio é pequeno (uma visita, poucos tipos de alteração) e o servidor já tem idempotência e `row_version`. |
| Compressão de fotos | Canvas/`createImageBitmap` nativos | Sem dependência; a lib `browser-image-compression` não é publicada desde 2023. |

Tabelas Dexie (mínimo):

| Tabela local | Chave | Conteúdo |
|---|---|---|
| `visits` | `id` | Visita + `row_version` + `downloaded_at` |
| `equipment`, `occurrences`, `activities`, `sites` | `id` | Cópias de leitura |
| `records` | `id` (uuid do aparelho) | `occurrence_record` local |
| `notes` | `id` | `visit_equipment_note` local |
| `photos` | `id` | Metadados + `Blob` comprimido + `upload_state` |
| `outbox` | `seq` (autoincremento) | Operação, payload, `idempotency_key`, tentativas, último erro |
| `receipts` | `id` | Comprovante de visita local (nome, imagem da assinatura, conteúdo, hash) até o envio (AF-10) |
| `meta` | chave | `device_id` (uuid gerado na primeira abertura, AF-03), `last_pull_cursor`, `app_version`, `offline_grant_until` |

### 6.4 Fila de sincronização

**Endpoints (`/api/sync/v1`):** toda chamada envia `X-Device-Id` (o `id` de `device`, doc 03 §2.11) e `X-App-Version`.

| Endpoint | Função |
|---|---|
| `GET bootstrap` | Baixa a janela de trabalho do técnico (§6.7). |
| `GET pull?cursor=` | Devolve só o que mudou desde o cursor (por `updated_at`, `id`), dentro do escopo do técnico, incluindo visitas que saíram do escopo (para remover localmente). |
| `POST push` | Recebe um lote de operações da outbox, em ordem. Cada uma é aplicada em sua própria transação e devolve `ok`, `duplicada` (mesma chave já aplicada) ou `conflito` com o estado atual do servidor. Cada operação leva `idempotency_key`, `base_row_version` e a hora do aparelho; o lote leva também `pending_operations` e `oldest_pending_at`, gravados em `device` (AF-03). Operação não aplicada ou para conferir vira `sync_review_item` (02 §11.2). |
| `POST photos/upload-url` | Devolve URL de upload assinada para uma foto já registrada localmente. |
| `POST photos/confirm` | Confirma upload (tamanho e `sha256`) e cria `stored_file` + `photo`. |

**Quando sincroniza:**
1. Ao abrir o app.
2. Ao voltar a conexão (evento `online`).
3. Ao voltar o app para o primeiro plano (`visibilitychange`).
4. A cada 2 minutos com o app aberto e conectado [A VALIDAR].
5. Botão "Sincronizar agora".

**Não depender** da Background Sync API: não é suportada em todos os navegadores (MDN marca como "disponibilidade limitada"; Safari/iOS sem suporte [A VALIDAR na época da implementação]). Consequência: **no iOS, nada é enviado com o app fechado**. O técnico precisa abrir o app com sinal. O app mostra aviso quando houver pendências há mais de 24 h [A VALIDAR].

**Ordem e garantias:**
- Push respeita a ordem `seq` por visita (ex.: "iniciar" antes dos registros, "finalizar" por último).
- Operação com erro definitivo (422, permissão) para a fila **daquela visita** e mostra o erro; outras visitas continuam.
- Erro de rede ou 5xx: nova tentativa com espera crescente (até 5 min).
- O servidor rejeita `X-App-Version` abaixo do mínimo suportado com 426; o app força atualização **depois** de enviar a fila, se o endpoint de push ainda aceitar a versão; senão, guarda a fila e atualiza (§7.4).

### 6.5 Resolução de conflitos

**Prevenção por desenho (primeiro):**
- Uma visita tem **um** técnico (`visit.technician_user_id`). Dois técnicos não editam a mesma visita.
- Cliente grande com equipe: o ADM **divide** a visita (DM-21), uma por técnico, cada uma com seu conjunto de ocorrências. Este é o caminho oficial para "dois técnicos na mesma OS".
- Visita `EM_ANDAMENTO` não troca técnico nem data (RN-071).

**Regras fixas para o que sobra:**

As regras **CF-01 a CF-07** (ADM remarcou offline, mesmo registro lançado pelo ADM e pelo técnico, visita já finalizada, dois aparelhos, reatribuição, equipamento inativado, técnico inativado) foram movidas para `02-regras-de-negocio.md` §11.2, com os mesmos IDs e o mesmo conteúdo (decisão D2, 21/10/2026). Este documento mantém só a implementação técnica.

Implementação: a lógica CF-01 a CF-07 (regras em `02` §11.2) fica em uma função pura no servidor (`execucao/domain/resolveConflict.ts`) com teste unitário por linha da tabela.

### 6.6 Segurança dos dados no aparelho

> **Decisão D7.1 (21/10/2026): PIN, bloqueio e apagamento remoto ficam para "Depois"** (fora do MVP). SD-02 a SD-04 abaixo são o desenho-alvo. Enquanto não existirem, os dados da visita ficam no aparelho sem cifra por PIN. **Risco aceito por escrito para o MVP (decisão R2 1.5 a)**, reduzido por apagar os dados locais após o envio ser confirmado (OF-05) e pela revogação de sessões. O comprovante de visita segue a mesma regra, sem cifra própria (AF-10).

| ID | Medida | Detalhe |
|---|---|---|
| SD-01 | Escopo mínimo | Só a janela de trabalho (§6.7). Sem dados de outros clientes. |
| SD-02 | PIN do app | Ao instalar, o técnico cria um PIN de 6 dígitos [A VALIDAR]. O PIN deriva uma chave (PBKDF2, WebCrypto) que **cifra com AES-GCM** os registros, notas e fotos locais. Sem PIN, os dados no IndexedDB ficam ilegíveis. |
| SD-03 | Bloqueio | App pede o PIN ao abrir e após 15 min em segundo plano [A VALIDAR]. 5 PINs errados → apaga dados locais **já enviados** e exige login online; dados não enviados ficam cifrados até o login [A VALIDAR]. |
| SD-04 | Perda ou roubo | ADM inativa o técnico ou revoga as sessões do aparelho. No próximo contato com o servidor, o app recebe "revogado" e **apaga tudo**. Enquanto o aparelho não se conecta, a proteção é o PIN + bloqueio de tela do celular. |
| SD-05 | Sem segredos no aparelho | Nada de chaves de API, certificado ou dados de outros técnicos. |
| SD-06 | Política de uso | Celular com bloqueio de tela obrigatório (regra da empresa, não técnica) [A VALIDAR]. |

Limitação honesta: um PWA não tem acesso ao cofre seguro do sistema (Keychain/Keystore). A cifra com PIN protege contra quem pega o aparelho desbloqueado sem o PIN, mas não contra malware no aparelho. Para este caso de uso, é aceitável [A VALIDAR].

### 6.7 Quanto cada técnico baixa

**Janela padrão:** visitas atribuídas com data **de ontem até +7 dias** e todas as `EM_ANDAMENTO` [A VALIDAR]. O técnico pode pedir "Baixar mais 7 dias".

| Item | Tamanho por unidade (estimativa) | Cliente grande (200 equip.) |
|---|---|---|
| Equipamento + atividades da visita | ≈ 2,5 KB | ≈ 0,5 MB de JSON |
| Visita comum (30 equip.) | — | ≈ 75 KB |
| Semana típica de um técnico (10 visitas comuns) | — | < 1 MB |
| PMOC em PDF (sob demanda) | — | Dezenas de MB [A VALIDAR no S-01] |
| **Fotos tiradas** (não baixadas; ficam até enviar) | 300 KB cada após compressão | 200 equip. × 2 fotos = **≈ 120 MB** |

Conclusão: **dados de leitura são pequenos**; o que pesa são as **fotos ainda não enviadas**. Regras:
- Fotos comprimidas no aparelho: lado maior 1600 px, JPEG qualidade 0,7 [A VALIDAR] (RNF-11, PW-05).
- Envio de fotos começa assim que houver conexão, uma por vez, em segundo plano com o app aberto.
- Foto confirmada pelo servidor → `Blob` local apagado na hora (mantém só miniatura de 20 KB até a visita sair do aparelho).
- Alerta no app quando houver mais de 200 MB de fotos pendentes [A VALIDAR].

### 6.8 Expiração de sessão offline

| Regra | Valor |
|---|---|
| Login online | Obrigatório na primeira vez e após expirar a permissão offline. |
| Permissão offline (`offline_grant_until`) | 7 dias a partir do último contato bem-sucedido com o servidor [A VALIDAR]. Renovada a cada sincronização. |
| Durante a permissão | App abre sem rede (sem PIN no MVP, D7.1). |
| Após expirar | App continua mostrando e **guardando** dados já registrados (nada se perde), mas não permite iniciar visita nova até reconectar e fazer login. |
| Sessão do servidor (cookie) | 30 dias renováveis no PWA [A VALIDAR]. Se expirar com fila pendente, o app pede login e depois envia a fila; a fila nunca é descartada por expiração. |

### 6.9 Assinatura do cliente no celular do técnico (ARQ-Q2: respondida, A3 a, 21/10/2026)

Problema: o relatório da visita é gerado pela IA **depois** da execução e exige conexão (RF-24). O cliente não pode assinar offline um documento que ainda não existe.

**Decisão A3 a:** o **comprovante de visita**, assinado no local, diferente do relatório, existe (RN-189). **Decisão R2 2.9 a:** o conteúdo gravado é só nome digitado, imagem da assinatura, data/hora e `sha256`; **sem** CPF, cargo nem geolocalização. A tabela abaixo já está ajustada a essas decisões e à AF-10 (27/10/2026).

| Item | Regra |
|---|---|
| Conteúdo | Data, horário de início e fim, técnico, local, lista de equipamentos atendidos com OK/NOK por atividade (dados já registrados), quantidade de fotos. Sem texto da IA. |
| Quem assina | Responsável presente no local. **Não** precisa ser usuário do sistema. |
| Evidências gravadas | **Decididas (R2 2.9 a):** nome digitado, imagem da assinatura desenhada, data/hora e `sha256` do conteúdo exibido. ~~Documento, cargo, ID do aparelho e geolocalização~~ ficam fora (reinclusão exige decisão nova e validação jurídica [A VALIDAR – advogado]). Grava a hora do aparelho (`device_signed_at`) e a de chegada ao servidor (`created_at`) (AF-10). |
| Offline | Funciona sem internet (AF-10): gravado no aparelho (tabela local `receipts`, sem cifra própria; PIN é "Depois") e enviado na sincronização; apagado do aparelho após o envio confirmado (OF-05). O PDF do comprovante é gerado no servidor ao receber, na mesma requisição. |
| Relação com o relatório | O relatório da IA continua indo para assinatura do cliente no portal (RF-26). O comprovante **não** substitui essa assinatura [A VALIDAR]. |
| Modelo de dados | Tabela própria `visit_receipt` (doc 03 §2.11; AF-10), **não** `document_signature` (que exige assinante `CLIENTE`, RN-122); `file_kind` `COMPROVANTE_PDF` e `COMPROVANTE_ASSINATURA_IMG`. |
| Quem vê | ADM em TL-131; cliente na lista de visitas (TL-301), com download do PDF; técnico só até enviar (04 TL-206). |
| Valor jurídico | Assinatura eletrônica simples, com prova mais fraca (assinante sem login) [A VALIDAR – advogado] (§9, ADR-08). |

### 6.10 Limites do iOS e do Android

| Tema | iOS/iPadOS (Safari, WebKit 17+) | Android (Chrome) | Consequência no projeto |
|---|---|---|---|
| Cota de armazenamento por origem | Até 60% do disco para o navegador e para app da tela de início | Até 60% do disco | Cabe com folga (§6.7). |
| Apagamento automático | Possível sob pressão de espaço ou por inatividade (ITP); origens em uso ou "persistentes" geralmente preservadas | Possível em pouco espaço (menos usada primeiro) | Pedir `navigator.storage.persist()`; enviar cedo; nunca deixar dados só no aparelho por dias. |
| Armazenamento persistente | Concedido por heurística (ajuda estar na tela de início) | Concedido por heurística [A VALIDAR] | Exigir instalação na tela de início no iOS. |
| Sincronização em segundo plano | Não | Background Sync existe no Chromium | Projeto não depende dela (§6.4). |
| Push | Só app na tela de início, iOS 16.4+ | Sim | Fase 2. |
| Câmera | `<input type="file" capture>` funciona | Funciona | Usar input nativo, não `getUserMedia`. |
| HEIC | Fotos do iPhone podem vir em HEIC | — | Converter para JPEG no aparelho via canvas [A VALIDAR no S-06]. |

Versões mínimas suportadas: iOS 17+ e Android com Chrome atual [A VALIDAR] (RNF-01).

### 6.11 PWA vs. nativo vs. híbrido

| Critério | PWA (recomendado) | Híbrido (Capacitor) | Nativo/React Native (Expo) |
|---|---|---|---|
| Código | Mesmo do sistema web | Mesmo código web dentro de um app | Segunda base de UI |
| Publicação | Link + "Adicionar à tela de início" | Lojas (Apple e Google) | Lojas |
| Custo extra | Nenhum | Contas de desenvolvedor nas lojas [A VALIDAR: valores] e revisão da Apple | Idem + mais código |
| Envio com app fechado | Não (iOS) | Possível com plugins | Sim |
| Armazenamento | IndexedDB (pode ser apagado pelo sistema) | SQLite nativo | SQLite nativo |
| Cofre seguro do aparelho | Não | Sim | Sim |
| Manutenção por 1 pessoa | Baixa | Média | Alta |

**Conclusão:** o PWA **basta** para o MVP, porque o requisito é registrar offline e enviar depois, com o técnico abrindo o app ao recuperar sinal.

**Gatilhos para migrar para Capacitor (reaproveitando o mesmo código):**
1. Dados perdidos por apagamento do iOS em uso real (mesmo um caso).
2. Exigência de envio com o app fechado.
3. Necessidade de cofre seguro do aparelho ou integração com instrumentos via Bluetooth.

A arquitetura da §6 (Dexie + outbox + API `/sync/v1`) é reaproveitada no Capacitor sem reescrita da sincronização.

---

## 7. Ambientes, CI/CD, migrações e versionamento

### 7.1 Ambientes

| Ambiente | App | Banco e Storage | Dados | Custo |
|---|---|---|---|---|
| Local | `next dev` | Postgres em Docker (ou Supabase CLI local) | Seed com clientes pequeno, médio e grande | 0 |
| Preview (por PR) | Deploy de preview da Vercel | Projeto **staging** no Supabase | Seed | Incluído |
| Staging | Branch `main` no ambiente Preview fixo | Projeto Supabase **Free** (pausa após 1 semana sem uso) | Seed + cópia anonimizada [A VALIDAR] | 0 |
| Produção | Deploy de produção da Vercel | Projeto Supabase **Pro** (São Paulo) | Reais | §8 |

Regra: dados reais **nunca** vão para staging sem anonimizar (LGPD).

### 7.2 CI/CD (GitHub Actions + Vercel)

| Etapa | Gatilho | O que faz |
|---|---|---|
| CI | Cada push e PR | `biome check`, `tsc --noEmit`, Vitest unit + integração (Postgres em container), testes de isolamento, build |
| Preview | Cada PR | Vercel cria deploy; Playwright E2E roda contra ele |
| Migração de produção | Manual (`workflow_dispatch`) com aprovação no ambiente `production` do GitHub | Backup sob demanda → `pnpm db:migrate` → teste de fumaça |
| Deploy de produção | Merge na `main` **depois** da migração | Vercel publica; rollback = "Promote" do deploy anterior na Vercel |
| Noturno | Agendado | PDF de 200 equipamentos, backup externo (J-08) |

Fluxo para uma pessoa: trunk-based (`main` + branches curtas), PR mesmo trabalhando sozinho (para rodar CI e preview), sem staging manual obrigatório para mudanças pequenas.

### 7.3 Migrações de banco

| ID | Regra |
|---|---|
| MG-01 | Toda mudança de esquema é migração versionada no repositório. Nunca alterar produção pelo painel do Supabase. |
| MG-02 | Padrão **expandir → migrar → contrair**: primeiro adiciona (coluna nova, opcional), depois publica código que usa as duas formas, depois remove a antiga em outra migração. Motivo: o PWA offline pode rodar versão antiga por até 7 dias (§6.8). |
| MG-03 | Migração de produção sempre depois de backup sob demanda. |
| MG-04 | Migração que mexe em trigger de auditoria, imutabilidade ou RLS exige teste de integração novo no mesmo PR. |
| MG-05 | Sem `DROP` de coluna ou tabela com dados nos primeiros 30 dias após deixar de usar [A VALIDAR]. |

### 7.4 Versionamento

| Item | Regra |
|---|---|
| Aplicação | SemVer em tags git (`v1.4.0`), CHANGELOG gerado dos commits. |
| API de sincronização | Caminho versionado (`/api/sync/v1`). Mudança incompatível = `/v2`, com `/v1` mantido por pelo menos 30 dias [A VALIDAR]. |
| PWA | Cada build tem `APP_VERSION`. O servidor informa `min_supported_version`; versão abaixo do mínimo envia a fila (se ainda aceita) e atualiza. |
| Snapshots de PDF | `snapshot_schema_version` (DM-20) sobe quando muda o formato do conteúdo congelado. |
| Prompt da IA | Versão gravada por relatório (RN-128). |

### 7.5 Backups

| Camada | O que cobre | Retenção | Custo |
|---|---|---|---|
| Supabase Pro (automático) | Banco, diário | 7 dias | Incluído |
| PITR do Supabase | Banco, restauração a qualquer ponto | 7 dias | US$ 100/mês ≈ R$ 507 → **não cabe no orçamento** |
| **Backup externo (J-08)** | `pg_dump` diário do banco + cópia dos objetos novos do Storage | 30 diários + 12 mensais [A VALIDAR] | Cloudflare R2: 10 GB grátis; depois US$ 0,015/GB-mês |

- Destino externo: **Cloudflare R2** (outro fornecedor, outra conta). Motivo: se a conta Supabase for perdida ou comprometida, os dados continuam salvos.
- Dumps cifrados antes do envio (`age` ou `gpg`) [A VALIDAR].
- **Meta de perda (RPO):** até 24 h para o banco [A VALIDAR]. Registros feitos offline e ainda não enviados não entram no backup até sincronizarem.
- **Meta de volta (RTO):** até 4 h [A VALIDAR].
- **Teste de restauração** trimestral, seguindo `docs/runbooks/restaurar-backup.md` (RNF-13).

### 7.6 Monitoramento e alertas (sem ficar olhando)

**Decisão AF-15 (27/10/2026):** sem alerta ativo no MVP (nem e-mail, nem Slack, nem app no celular; R2 2.11 e resposta b da auditoria). O operador consulta os painéis; o risco está em 06 TD-13.

| O quê | Ferramenta | Plano | Onde ver |
|---|---|---|---|
| Erros da aplicação (servidor e PWA) | Sentry | Gratuito: 5.000 erros/mês, 1 usuário | Painel do Sentry (notificações desligadas) |
| Site fora do ar | Better Stack | Gratuito: 10 monitores/heartbeats | Painel do Better Stack (notificações desligadas) |
| Job diário (J-01) e backup (J-08) não rodaram | Better Stack (heartbeat) | Incluído nos 10 | Painel do Better Stack |
| Gasto da Vercel e do Supabase | Teto de gasto em cada painel [A VALIDAR: nomes e opções atuais] | — | Painel de cada fornecedor |
| Certificado do RT perto de vencer | RN-114 (painel do ADM, TL-100) | — | TL-100 |

Logs da Vercel Pro ficam só 1 dia; o histórico de longo prazo fica no banco (`audit_log`, `security_event`, `job_run`) e no Sentry (06 §1; AF-20).
| Domínio e cartão de crédito | Lembrete no calendário | — | — |

Sentry Team (US$ 29/mês) só se o limite gratuito estourar.

---

## 8. Hospedagem

### 8.1 Premissas do cálculo

- Cotação: US$ 1 = R$ 5,0693 (17/10/2026). Sem IOF e impostos [A VALIDAR].
- IA incluída em todas as opções (Opus 5.5, §3.12): ano 1 US$ 16,80; ano 3 US$ 50,40; pico US$ 75,60 (1,5 × ano 3).
- E-mail (Resend grátis), Sentry grátis, Better Stack grátis e backup externo em R2 (< US$ 1) em todas.
- Domínio não incluído [A VALIDAR].
- "Pico" = mês com 1,5 × a carga do ano 3, com 200 simultâneos.
- Consumo variável (CPU, banda) estimado; **não é medição**.

### 8.2 Comparação

| Opção | Ano 1 (US$ / R$) | Ano 3 (US$ / R$) | Pico (US$ / R$) | Esforço de operação | Dados no Brasil | Riscos | Lock-in |
|---|---|---|---|---|---|---|---|
| **A. Vercel Pro (gru1) + Supabase Pro (sa-east-1)** ✅ | 66,80 / **339** | 110,40 / **560** | 190,60 / **966** | **Baixo** | Banco, arquivos e funções: sim | Preço variável da Vercel; limite de 800 s por função; backup sem arquivos (resolvido por J-08) | Baixo-médio: Next.js roda fora da Vercel; Supabase é Postgres padrão |
| B. Vercel Pro + Neon Launch (sa-east-1) + R2 | 56,80 / 288 | 134,00 / 679 | 216,60 / 1.098 | Baixo | Banco e funções sim; **arquivos não** (R2 sem região Brasil confirmada [A VALIDAR]) | Banco "dorme" sem uso (início lento [A VALIDAR]); custo cresce com uso contínuo | Baixo |
| C. VPS (AWS Lightsail São Paulo) + Docker Compose (app + Postgres + fila) | 45,80 / 232 | 102,40 / 519 | 127,60 / 647 | **Alto**: atualizações do sistema, do Postgres, TLS, backups, disco, segurança | Sim | Você vira o DBA e o SRE; uma falha de disco ou invasão é problema seu; sem escala automática | Baixo |
| D. AWS gerenciado leve (Lightsail instância + banco gerenciado HA) | 101,80 / 516 | 216,40 / 1.097 | 241,60 / 1.225 | Médio | Sim | Mais peças para configurar; preços de São Paulo [A VALIDAR] | Médio |
| E. Render (Pro + web + Postgres) + R2 | 86,80 / 440 | 203,40 / 1.031 | 228,60 / 1.159 | Baixo-médio | Não [A VALIDAR: regiões não listadas na página consultada] | Sem região no Brasil | Baixo |

Composição de cada valor (estimativa):

| Opção | Ano 1 | Ano 3 | Pico |
|---|---|---|---|
| A | Vercel 20 + Supabase 25 + Small 5 + IA 16,80 | Vercel 30 (20 + 10 de uso) + Supabase 30 (Small) + IA 50,40 | Vercel 40 + Supabase 75 (Medium) + IA 75,60 |
| B | Vercel 20 + Neon ≈ 20 (0,5 CU × 360 h + 2 GB) + IA 16,80 | Vercel 30 + Neon ≈ 53 (1 CU × 450 h + 10 GB) + IA 50,40 | Vercel 40 + Neon ≈ 101 (2 CU × 450 h) + IA 75,60 |
| C | Instância 4 GB 24 + snapshots ≈ 5 [A VALIDAR] + IA 16,80 | Instância 8 GB 44 + snapshots ≈ 8 + IA 50,40 | Igual ao ano 3 + IA 75,60 (sem escala automática) |
| D | Instância 4 GB 24 + banco 2 GB HA 60 + objetos ≈ 1 + IA 16,80 | Instância 8 GB 44 + banco 4 GB HA 120 + 2 + IA 50,40 | Igual ao ano 3 + IA 75,60 |
| E | Workspace 25 + web 1 CPU 25 + Postgres 1 GB 19 + cron ≈ 1 + IA 16,80 | Workspace 25 + web 2 CPU 85 + Postgres 2 GB 40 + 3 + IA 50,40 | Igual ao ano 3 + IA 75,60 |

Opções não detalhadas: AWS com ECS/RDS, Azure e GCP. Preços não consultados nesta rodada [A VALIDAR]; descartadas pelo esforço de operação (rede, IAM, balanceador, observabilidade) para uma pessoa.

### 8.3 O que cabe em R$ 300 a R$ 500 por mês

| Cenário | Opção A | Cabe? |
|---|---|---|
| Ano 1 | ≈ R$ 339 | **Cabe**, com folga de ≈ R$ 160 |
| Ano 3 com Opus 5.5 | ≈ R$ 560 | **Não cabe** (passa ≈ R$ 60) |
| Ano 3 trocando a IA para Sonnet 5.5 | ≈ R$ 432 (US$ 85,20) | **Cabe** |
| Pico | ≈ R$ 966 | **Não cabe**; é um teto de segurança, não o gasto esperado |
| PITR (+ R$ 507) | — | **Não cabe** em nenhum cenário; substituído pelo backup externo diário |
| Sentry Team (+ R$ 147) | — | Só se o gratuito estourar |
| Staging pago no Supabase (+ ≈ R$ 50 a 100 [A VALIDAR]) | — | Evitar; usar projeto Free |

A maior variável do custo é a **IA**, não a infraestrutura. Definir o modelo (ARQ-11) define se o ano 3 cabe no orçamento.

### 8.4 Recomendação

**MVP: opção A** (ADR-02). Motivos: menor esforço de operação entre as opções que cabem no orçamento; banco, arquivos e funções em São Paulo; backups diários automáticos; deploy por `git push`; rollback em um clique.

**Quando migrar (gatilhos):**

| Gatilho | Para onde |
|---|---|
| Fatura da Vercel acima de US$ 60/mês por 3 meses seguidos | Next.js em contêiner (Render, Fly.io ou VPS com Coolify [A VALIDAR]) mantendo o Supabase |
| PDF do cliente grande não cabe em 800 s / 4 GB mesmo em partes (S-01) | Worker de PDF em contêiner com Chromium, mantendo o resto |
| Exigência legal de **todos** os dados no Brasil, inclusive IA | Rever fornecedor de IA (ARQ-12) |
| Banco Supabase precisa de mais de Medium (4 GB) | Avaliar Large (US$ 110) vs. outro Postgres gerenciado |
| Supabase fica caro ou muda de política | Qualquer Postgres gerenciado (dump/restore); o código não usa recursos exclusivos do Supabase, exceto Storage (S3-compatível) |

Para não ficar preso: **não usar** Supabase Auth, Realtime, Edge Functions nem a API REST automática (PostgREST). Usar o Supabase só como Postgres + Storage.

---

## 9. ADRs

### ADR-01 – Monolito modular em Next.js
- **Contexto:** um mantenedor, ≈ 200 usuários simultâneos no ano 3, operações que precisam de transação única (emissão do PMOC + cronograma + visitas), auditoria por trigger.
- **Decisão:** um app Next.js 16.4 (App Router) com módulos por domínio (§2), regras MOD-01 a MOD-07; Server Actions para a web e Route Handlers versionados para o PWA.
- **Consequências:** um deploy e um pipeline; transações simples. Disciplina de módulos depende de regra de lint e revisão. Escalar partes separadamente exigiria extrair o módulo (não previsto).

### ADR-02 – Vercel Pro (gru1) + Supabase Pro (sa-east-1)
- **Contexto:** operação por uma pessoa, orçamento de R$ 300 a 500/mês, preferência por dados no Brasil (ARQ-Q4).
- **Decisão:** funções na Vercel em São Paulo; Postgres e Storage no Supabase em São Paulo; backup externo em Cloudflare R2.
- **Consequências:** ≈ R$ 339/mês no ano 1. Funções com limite de 800 s e corpo de 4,5 MB (PDF síncrono dentro desse limite, conferido no S-01, AF-11; upload direto ao Storage). Backup do Supabase não cobre arquivos (exige J-08). Sem PITR. Hobby da Vercel não pode ser usado (proíbe uso comercial).

### ADR-03 – Drizzle ORM + regras críticas no banco
- **Contexto:** o doc 03 coloca regras em CHECK, EXCLUDE, triggers de transição, auditoria e imutabilidade.
- **Decisão:** Drizzle 0.45 para consultas tipadas; SQL à mão versionado para triggers, funções e RLS; `withTransaction` como única porta de escrita.
- **Consequências:** regras valem mesmo para scripts e jobs. Dois tipos de migração no mesmo fluxo. Atualização futura para Drizzle 1.0.

### ADR-04 – Better Auth, sem cadastro público (MFA TOTP só para o ADM no MVP, R2 1.2 b)
- **Contexto:** contas criadas só pelo ADM; 3 perfis; vínculo usuário-cliente; acesso externo de clientes.
- **Decisão:** Better Auth 1.7 com plugins `admin` e `twoFactor`; `app_user.role` e `app_user.client_id` como fonte de verdade. **MFA (TOTP) obrigatório para ADM entra no MVP (decisão R2 1.2 b, 21/10/2026; B2 b adiava o MFA, e passa a valer só para TECNICO e CLIENTE)**; o plugin `twoFactor` fica ligado no MVP para o ADM. Hash scrypt, senha mínima 8, tabelas do Better Auth ligadas a `app_user` (B6, E5).
- **Consequências:** usuários e sessões no nosso banco (portável). Dependência de uma biblioteca adquirida pela Vercel em 2026 (continua MIT). Configuração de "sem sign-up" a confirmar (S-04).

### ADR-05 – Isolamento: aplicação + RLS para `CLIENTE`, sem `tenant_id`
- **Contexto:** isolamento entre clientes é requisito de segurança crítico; empresa única (DEC-34). DM-08 previa só a aplicação.
- **Decisão:** camada 1 na aplicação para todos os perfis; camada 2 com RLS para o perfil `CLIENTE`, usando `app.client_id` gravado com `set_config` (AF-05); falha fechada sem contexto; testes de isolamento obrigatórios no CI.
- **Consequências:** um bug de filtro não vaza dados entre clientes. Cada tabela nova lida pelo portal exige política e teste. Pequeno custo de desempenho nas políticas com join (avaliar no S-05). Altera DM-08.

### ADR-06 – PWA offline-first com Dexie, Serwist e fila própria
- **Contexto:** técnicos sem internet com frequência; offline é requisito central (nível 1 no MVP, nível 2 na Fase 2: A1 b); uma pessoa para manter.
- **Decisão:** PWA (não nativo); Dexie para dados locais; Serwist para o app; outbox com idempotência e `row_version`; conflitos por regra fixa (CF-01 a CF-07, em `02` §11.2); dados locais **sem** cifra no MVP (PIN, bloqueio e apagamento remoto: Depois, D7.1; risco aceito em R2 1.5 a; vale também para o comprovante, AF-10).
- **Consequências:** um só código. No iOS, nada é enviado com o app fechado e há risco de apagamento automático (mitigado por envio cedo e `persist()`). Gatilhos para Capacitor na §6.11.

### ADR-07 – PDF com @react-pdf/renderer, **síncrono** (A2 a), assinatura do RT A1 no servidor
- **Contexto:** PMOC do cliente grande com 200+ páginas; RNF-07 exige paginação e formatação estritas; RT assina com e-CPF (ARQ-Q3 = A1).
- **Decisão:** gerar PDFs com @react-pdf/renderer **de forma síncrona** (decisão A2 a, 21/10/2026; o texto original dizia job pg-boss); assinar com @signpdf após gerar; nunca sobrescrever (RN-126).
- **Consequências:** emissão síncrona (tela "gerando" até terminar, sem estado "emitindo"). Risco de tempo/memória (meta de 15 min cumprida dentro do limite de 800 s da função, com 200 equipamentos: spike S-01, AF-11) no PMOC grande (S-01, plano B: geração em partes ou Chromium em contêiner). Formato PAdES e validação ICP-Brasil a confirmar (S-02).

### ADR-08 – Assinatura do cliente: eletrônica simples com evidências
- **Contexto:** clientes precisam assinar PMOC e relatórios (DEC-20, DEC-24); orçamento baixo; usuários do cliente não têm certificado ICP-Brasil.
- **Decisão:** assinatura eletrônica simples, feita pelo portal com usuário logado, com evidências (RN-125) e PDF final com página de evidências e `sha256`; comprovante de visita presencial no celular do técnico (§6.9). Cláusula no contrato de serviço em que o cliente aceita a assinatura eletrônica [A VALIDAR – advogado].
- **Consequências:** custo zero por assinatura. Valor de prova depende das evidências e do aceite contratual. Opções avaliadas abaixo.

| Opção | Como funciona | Custo | Valor jurídico (análise preliminar, **[A VALIDAR – advogado]**) |
|---|---|---|---|
| **Simples com evidências (escolhida)** | Login + aceite + registro de IP, data/hora, hash, texto do aceite | 0 | A MP 2.200-2/2001, art. 10, § 2º, admite outros meios de comprovar autoria e integridade, inclusive sem certificado ICP-Brasil, **desde que aceitos pelas partes** ou pela pessoa a quem o documento for oposto. Daí a cláusula contratual. |
| Avançada via serviço de terceiros (ex.: plataformas nacionais de assinatura) | Envio do documento ao serviço; assinante identificado por e-mail, SMS, selfie ou documento | Por envelope ou mensalidade [A VALIDAR: preços não consultados] | Prova mais forte de autoria (trilha do serviço). Mais um fornecedor e dados pessoais com terceiros. |
| Qualificada (ICP-Brasil) pelo cliente | Cliente assina com e-CPF/e-CNPJ | Certificado de cada assinante | Presunção de veracidade (MP 2.200-2, art. 10, § 1º). Inviável operacionalmente: exige certificado de cada usuário do cliente. |

Observação: a Lei 14.063/2020 define assinatura simples, avançada e qualificada, mas o art. 2º, parágrafo único, **exclui** de seu âmbito as relações entre pessoas jurídicas de direito privado. Usar essa classificação para contratos entre empresas é analogia [A VALIDAR – advogado]. Se a fiscalização sanitária exige forma específica de assinatura do proprietário no PMOC: [A VALIDAR – advogado].

---

## 10. Riscos, pontos únicos de falha e itens a validar

### 10.1 Riscos técnicos

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| RSK-01 | PDF do PMOC de 200 equipamentos estoura tempo ou memória da função | Média | Alto | S-01 antes de implementar RF-12; geração em partes; plano B Chromium em contêiner |
| RSK-02 | iOS apaga dados do PWA antes do envio | Baixa | Alto | `persist()`, instalação na tela de início, envio imediato, alerta de pendências, gatilho para Capacitor |
| RSK-03 | Técnico fica dias sem abrir o app com sinal (iOS sem envio em segundo plano) | Média | Médio | Aviso após 24 h; painel do ADM mostra técnicos com envios pendentes [A VALIDAR] |
| RSK-04 | Vazamento entre clientes por filtro esquecido | Baixa | **Crítico** | ADR-05 (RLS) + testes de isolamento automáticos |
| RSK-05 | Mudança incompatível na API quebra PWAs offline com versão antiga | Média | Alto | `/sync/v1` versionado; MG-02; versão mínima suportada |
| RSK-06 | Assinatura PAdES não validada no validador ICP-Brasil | Média | Alto | S-02; fluxo A3/manual de RN-120 como contingência |
| RSK-07 | Custo variável (Vercel, IA) sobe sem aviso | Média | Médio | Alertas de gasto; IA mais barata (Sonnet 5.5); gatilhos da §8.4 |
| RSK-08 | Bibliotecas em evolução rápida (Next 16.x, Drizzle 1.0, TS 7) | Alta | Baixo-médio | Versões fixas; atualização mensal em lote com CI completo |
| RSK-09 | pg-boss sem worker permanente atrasa jobs | Baixa | Baixo | Cron a cada minuto; S-03 |
| RSK-10 | IA inventa dado no relatório | Média | Alto | Saída estruturada, validação contra os dados da visita, revisão obrigatória do técnico (DEC-38), testes CA-24.x |
| RSK-11 | Perda de dados entre backups (sem PITR) | Baixa | Alto | Backup diário externo; aceitar RPO de 24 h [A VALIDAR]; PITR quando o orçamento permitir |

### 10.2 Pontos únicos de falha por operar sozinho

| ID | Ponto | Mitigação |
|---|---|---|
| SPOF-01 | Só você tem acesso às contas (Vercel, Supabase, GitHub, Cloudflare, Anthropic, Resend, domínio) | Contas no e-mail da empresa; gerenciador de senhas com **acesso de emergência** para um sócio ou pessoa de confiança; códigos de recuperação de MFA guardados offline |
| SPOF-02 | Só você sabe operar o sistema | `docs/runbooks/` com passo a passo: deploy, rollback, restaurar backup, trocar certificado do RT, rotacionar chaves, inativar usuário em incidente |
| SPOF-03 | Cartão de crédito vence e os serviços param | Cartão com vencimento distante; alerta de falha de cobrança no e-mail de dois responsáveis [A VALIDAR] |
| SPOF-04 | Certificado A1 do RT vence (validade anual [A VALIDAR]) e a emissão para | RN-114 com 30 dias de antecedência + lembrete no calendário |
| SPOF-05 | Domínio expira | Renovação automática + lembrete |
| SPOF-06 | Você indisponível durante incidente | Status page do Better Stack; mensagem padrão para ADMs; o sistema continua funcionando sem intervenção diária (jobs automáticos) |
| SPOF-07 | Chave `CERT_ENCRYPTION_KEY` perdida | Cópia no gerenciador de senhas; sem ela, o certificado precisa ser reenviado (não há perda de documentos já assinados) |

### 10.3 Itens [A VALIDAR] de arquitetura

| ID | Item | Proposta adotada |
|---|---|---|
| ARQ-01 | Janela de download do técnico | Ontem até +7 dias + `EM_ANDAMENTO` |
| ARQ-02 | Validade da permissão offline | 7 dias |
| ARQ-03 | PIN do app e bloqueio | **Depois (D7.1, 21/10/2026).** Proposta original: 6 dígitos; bloqueio após 15 min; 5 erros |
| ARQ-04 | Compressão de fotos | 1600 px, JPEG 0,7 |
| ARQ-05 | Técnico pode baixar o PMOC para consulta offline | **Não (B1 b, 21/10/2026):** o técnico não vê o PMOC (PRD §3.2, RN-166) |
| ARQ-06 | Duração de sessão | **Decidida (AF-08):** web 12 h sem uso e limite absoluto de 7 dias; PWA 30 dias renováveis |
| ARQ-07 | MFA obrigatório para ADM | **Sim no MVP (R2 1.2 b, 21/10/2026)**; TECNICO e CLIENTE: fase futura (B2 b) |
| ARQ-08 | RPO 24 h / RTO 4 h | Sim |
| ARQ-09 | Retenção do backup externo | 30 diários + 12 mensais |
| ARQ-10 | Conflitos CF-01 a CF-07 | Como na §6.5 |
| ARQ-11 | Modelo da IA | Opus 5.5 no início; comparar com Sonnet 5.5 em 20 visitas |
| ARQ-12 | Transferência internacional na IA (LGPD) | Aceitar com base legal e contrato do fornecedor [A VALIDAR – advogado] |
| ARQ-13 | Coleta de CPF e geolocalização no comprovante de visita | Não coletar até parecer [A VALIDAR – advogado] |
| ARQ-14 | Cláusula de aceite de assinatura eletrônica no contrato de serviço | Incluir [A VALIDAR – advogado] |
| ARQ-15 | E-mail ao operador para alertas técnicos (certificado, falhas) | **Não usado no MVP (AF-15)**: sem alerta ativo; o operador consulta os painéis (§7.6) |
| ARQ-16 | Versões mínimas de iOS/Android | iOS 17+, Chrome atual |
| ARQ-17 | IOF e impostos sobre serviços em dólar | Somar ao orçamento real |

### 10.4 Spikes obrigatórios

| ID | Spike | Critério de sucesso | Antes de |
|---|---|---|---|
| S-01 | PDF do PMOC com **200 equipamentos** × 12 meses (tamanho pessimista, R2 1.4 c) na Vercel, **de forma síncrona**; medir também 500 como margem de folga | Gera em < 800 s (limite da função) e < 3,5 GB; cumprir em < 800 s atende a meta de 15 min (C4; AF-11); texto conforme RNF-07 | RF-12 |
| S-02 | Assinatura PAdES com A1 de teste | Validador oficial reconhece a assinatura (CA-13.1) | RF-13 |
| S-03 | pg-boss acionado por cron, sem worker permanente, com Supabase | Job executa uma vez, com novas tentativas, sem conexões penduradas | §3.9 |
| S-04 | Better Auth sem cadastro público + admin + **TOTP do ADM (MVP)** + sessões revogáveis, com tabelas `auth_*` (AF-04) | Nenhuma rota pública cria usuário; ADM sem segundo fator não acessa nada além da tela de configurá-lo; revogação derruba sessão ativa; nomes de tabela `auth_*` e duração de sessão por perfil (SEG-10) funcionam; gancho que recusa `INATIVO` lê `app_user` com contexto `SISTEMA` | RF-01, RF-02 |
| S-05 | RLS com contexto `set_config(..., true)` no pooler do Supabase (modo transação) e desempenho com o cliente grande e a escala da DEC-34 emendada (AF-12) | Testes de isolamento passam; listas do portal < 2 s (RNF-16) | ADR-05 |
| S-06 | PWA no iPhone: instalar, câmera, HEIC → JPEG, 300 MB de fotos, `persist()`, offline 3 dias | Nada perdido; envio completo ao reconectar | RF-21, RF-22 |

**Resultado do S-04 (Better Auth 1.7.10, teste `tests/spikes/s04.test.ts`, Postgres 16, biblioteca rodando como `app_rw`): APROVADO nos 7 critérios.** O que o spike fixou (confirma os `[A VALIDAR no S-04]` de 03 §2.1, 05 §3.3 e 06 SEG-02, 10, 15, 68):

| Item | Resultado |
|---|---|
| Sem cadastro público | `emailAndPassword.disableSignUp: true`: `POST /sign-up/email` devolve 400 e não cria linha. |
| Criação pelo ADM | `POST /admin/create-user` funciona para `ADM` e é negado (4xx) para `TECNICO`. Com `role` no corpo exige a permissão `set-role`. Como o ADM **não** a tem (B6; DFT-04), criar **sem** `role` (vale `defaultRole`) e gravar o perfil no servidor com `internalAdapter.updateUser`. A fonte de verdade continua `app_user.role`. |
| Troca de perfil | Papéis definidos com `createAccessControl` sem `set-role` para `ADM`; `/admin/set-role` devolve 403. `adminRoles: ["ADM"]`. |
| Nomes `auth_*` | `modelName` em `user`, `session`, `account`, `verification` e `twoFactorTable: "auth_two_factor"`. No adaptador Drizzle, as **chaves** do objeto `schema` devem ser os nomes das tabelas (`auth_user`, ...), senão a biblioteca acusa "Missing tables". `auth_rate_limit` só existe se o rate limit usar o banco (decidir na Etapa 2). |
| Colunas | `auth_user` ganha `image`, `role`, `banned`, `ban_reason`, `ban_expires`, `two_factor_enabled`; `auth_session` (`token`, `expires_at`, `ip_address`, `user_agent`, `user_id`, `impersonated_by`); `auth_account` (`password` guarda o hash scrypt); `auth_verification`; `auth_two_factor` (`secret`, `backup_codes`, `user_id`, `verified`, `failed_verification_count`, `locked_until`). `app_rw` precisa de `GRANT SELECT, INSERT, UPDATE, DELETE` nas novas tabelas. |
| TOTP do ADM | `twoFactor` gera 10 códigos de recuperação; o segredo fica **cifrado** no banco (não precisa de cifra extra, 06 §segredos); login com 2FA devolve `twoFactorRedirect: true` e **nenhuma sessão** até o código; código errado é recusado; código de recuperação funciona. A regra "ADM sem 2FA só acessa TL-004" **não é da biblioteca**: fica no `RequestContext` (ADM com `two_factor_enabled` falso ou sessão sem 2º fator → só TL-004). |
| Sessão por perfil (SEG-10) | A biblioteca tem uma duração global. Por perfil: gancho `databaseHooks.session.create.before` define `expiresAt` (ADM/CLIENTE 12 h, TECNICO 30 dias) e `updateAge` desliza a expiração a cada uso. O **limite absoluto de 7 dias** (web) não existe na biblioteca: checar `created_at` no `RequestContext`. |
| Usuário `INATIVO` | O mesmo gancho lê `app_user` com `withTransaction(SISTEMA)` e recusa a sessão (401, nenhuma linha em `auth_session`). Banir + `revoke-user-sessions` derruba a sessão ativa (`get-session` passa a `null`); login de banido: 403 `BANNED_USER`. |
| IP (SEG-68) | `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]` grava o IP em `auth_session.ip_address`. Na Vercel, conferir qual cabeçalho a plataforma garante antes do go-live. |
| Links de senha (SEG-15) | `resetPasswordTokenExpiresIn` é global (30 min, uso único confirmado). O token **não** é guardado como hash: vai em `auth_verification.identifier` como `reset-password:<token>`. Aceito pelo padrão de SEG-15 (validade curta). O link de **72 h** da senha inicial exige criar o registro de verificação à parte (`internalAdapter.createVerificationValue`) ou outra rota; decidir na Etapa 2. |
| Senha vazada (SEG-02) | Existe o plugin `haveIBeenPwned` (`better-auth/plugins/haveibeenpwned`), que consulta API externa. **Não foi exercitado** (sem rede no teste): validar na Etapa 2; se a consulta externa não for aceita, usar a lista local de SEG-02. |

**Resultado do S-05 – parte local (teste `tests/spikes/s05.test.ts`, Postgres 16 embutido no Windows, 10/11/2026): APROVADO.** Parte no pooler do Supabase (modo transação): **pendente** até existir o projeto.

| Item | Resultado |
|---|---|
| Volume | 202 clientes, 1.993 equipamentos, 71.676 ocorrências, 2.402 visitas; cliente grande com 200 equipamentos × 3 atividades × 12 meses (RNF-02). |
| Listas do cliente grande como `CLIENTE` (p95 de 20 execuções, com a transação e o `set_config`) | Equipamentos (50 por página) 30 ms; visitas 19 ms; ocorrências de uma visita (600) 64 ms; cronograma inteiro do PMOC (7.200) **588 ms**. Todas < 2 s (RNF-16). |
| Isolamento | Outro `CLIENTE` filtrando pelo id do PMOC ou da visita do cliente grande recebe 0 linhas. |
| Contexto no pool | 40 transações alternando dois clientes na **mesma conexão** (`max: 1`): cada uma só vê o próprio cliente; depois delas, transação sem ator não vê nada. |
| Ponto de atenção | A política de `occurrence` sobe `pmoc → contract → site` e cada tabela do caminho reaplica a própria RLS: 7.200 subplanos aninhados (o ADM também paga, 312 ms, porque a política roda para todos os perfis). Está dentro da meta, mas é a consulta que mais cresce com o volume. Se a medida no Supabase passar de 2 s, a opção seria `client_id` desnormalizado também em `occurrence`, o que **muda a lista da AF-06** e exige decisão do usuário. |

---

## 11. Fontes (consultadas em 17/10/2026)

| Tema | Fonte |
|---|---|
| Versões de Next.js (16.4), React, Drizzle, Prisma, Better Auth, Zod, Dexie, Serwist, Playwright, Vitest, Biome, pg-boss etc. | Registro npm (`registry.npmjs.org/<pacote>`, campo `dist-tags.latest` e data de publicação) |
| Linha do tempo do Next.js | [nextjs.org/blog](https://nextjs.org/blog) |
| TypeScript 7 no `next build` (Next.js 16.3+) | [achromatic.dev – Next.js 16.3 + TypeScript 7](https://www.achromatic.dev/blog/nextjs-16-3-typescript-7-upgrade) |
| Versões do PostgreSQL (18.6 atual; 16 suportado até 11/2028) | [postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/) |
| Cotação do dólar (R$ 5,0693) | [renovainvest.com.br/dolar-hoje](https://renovainvest.com.br/dolar-hoje/) |
| Preços Vercel Pro (US$ 20/assento, crédito de US$ 20, 1 TB) e Hobby sem uso comercial | [makerkit.dev – Vercel cost 2026](https://makerkit.dev/blog/saas/vercel-cost) |
| Regiões Vercel (gru1) | [vercel.com/docs/regions](https://vercel.com/docs/regions) |
| Preços Vercel em São Paulo | [vercel.com/docs/pricing/regional-pricing/gru1](https://vercel.com/docs/pricing/regional-pricing/gru1) e [regional-pricing](https://vercel.com/docs/pricing/regional-pricing) |
| Limites de funções Vercel (800 s, 4 GB, 4,5 MB) | [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) |
| Cron Vercel (Pro: por minuto) | [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| Preços Supabase (Pro US$ 25, compute, Storage, PITR US$ 100) | [supabase.com/pricing](https://supabase.com/pricing) e [makerkit.dev – Supabase pricing](https://makerkit.dev/blog/saas/supabase-pricing) |
| Regiões Supabase (sa-east-1) | [supabase.com/docs/guides/platform/regions](https://supabase.com/docs/guides/platform/regions) |
| Backups Supabase (7 dias; sem arquivos do Storage) | [supabase.com/docs/guides/platform/backups](https://supabase.com/docs/guides/platform/backups) |
| Preços Neon | [neon.com/pricing](https://neon.com/pricing) |
| Regiões Neon (aws-sa-east-1) | [neon.com/docs/introduction/regions](https://neon.com/docs/introduction/regions) |
| Cloudflare R2 | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| AWS Lightsail | [aws.amazon.com/lightsail/pricing](https://aws.amazon.com/lightsail/pricing/) |
| Render | [render.com/pricing](https://render.com/pricing) |
| Hetzner (sem região no Brasil) | [hetzner.com/cloud](https://www.hetzner.com/cloud) |
| PowerSync (descartado) | [powersync.com/pricing](https://powersync.com/pricing.md) |
| Resend | [resend.com/pricing](https://resend.com/pricing) |
| Sentry | [sentry.io/pricing](https://sentry.io/pricing/) |
| Better Stack | [betterstack.com/pricing](https://betterstack.com/pricing) |
| Better Auth (admin, 2FA) | [better-auth.com/docs/plugins/admin](https://www.better-auth.com/docs/plugins/admin), [better-auth.com/docs/plugins/2fa](https://www.better-auth.com/docs/plugins/2fa) |
| Auth.js passa para o Better Auth | [better-auth.com/blog/authjs-joins-better-auth](https://www.better-auth.com/blog/authjs-joins-better-auth) |
| Better Auth adquirido pela Vercel (07/2026, segue MIT) | [noqta.tn](https://noqta.tn/en/blog/vercel-acquires-better-auth-what-it-means-2026) |
| Política de armazenamento do Safari/WebKit | [webkit.org/blog/14403](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| Armazenamento no Chrome | [web.dev/articles/storage-for-the-web](https://web.dev/articles/storage-for-the-web) |
| Background Sync (disponibilidade limitada) | [MDN – Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) |
| Push em web apps no iOS 16.4 | [webkit.org/?p=13878](https://webkit.org/?p=13878) |
| Preços e modelos da Anthropic API | Documentação de referência da Claude API (tabela de modelos, cache de 06/10/2026) |
| Lei 14.063/2020 (tipos de assinatura; âmbito) | [planalto.gov.br – Lei 14.063](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm) |
| MP 2.200-2/2001 (art. 10) | [planalto.gov.br – MP 2.200-2](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm) |
