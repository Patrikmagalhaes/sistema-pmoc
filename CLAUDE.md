# CLAUDE.md – Sistema PMOC

## Resumo
- Sistema próprio, de empresa única, que substitui o Frigus e cobre o ciclo inteiro do PMOC (DEC-41).
- ADM cadastra empresa, RT, clientes, locais, contratos, tipos/atividades e equipamentos; emite o PMOC em PDF assinado pelo RT (e-CPF) e pelo cliente.
- O sistema gera o cronograma de ocorrências (equipamento × atividade × mês) e o ADM agenda visitas (OS = visita).
- Técnico registra a manutenção no celular (PWA offline-first) e gera o relatório da visita com IA; cliente acompanha e assina no portal.
- Monolito modular Next.js + PostgreSQL; perfis `ADM`, `TECNICO`, `CLIENTE`; isolamento entre clientes é requisito crítico.

## Stack (fonte: docs/05 §3.0 — versões exatas, sem `^`)
Next.js 16.4.2 (App Router) · React 19.3.1 · TypeScript 7.0.2 · PostgreSQL (Supabase, mín. 16 [A VALIDAR]) · Drizzle ORM 0.45.4 / drizzle-kit 0.31.11 + driver `postgres` 3.4.9 · Better Auth 1.7.10 (`admin` e `twoFactor` só para o ADM no MVP, R2 1.2 b; MFA de TECNICO e CLIENTE é fase futura) · Zod 4.6.7 · next-safe-action 8.7.3 · @react-pdf/renderer 4.9.0 + @signpdf/signpdf 3.3.0 · Supabase Storage · pg-boss 12.38.0 + Vercel Cron · Dexie 4.4.6 + Serwist 9.5.13 · TanStack Query 5.104.4 · Resend 6.34.1 · @anthropic-ai/sdk 0.135.0 · Vitest 5.0.5 + Testcontainers 12.2.1 · Playwright 1.64.1 · Biome 2.5.15 · Sentry 11.8.0 · pnpm.

## Mapa dos documentos (consulte ANTES de codar a parte afetada)
| Arquivo | Conteúdo | Consultar quando |
|---|---|---|
| `01-analise-pmocs-existentes.md` | Engenharia reversa dos 4 PDFs, DEC-01 a 32, regras §9 | Layout do PDF do PMOC, origem de uma DEC |
| `docs/00-escopo-prd.md` | Perfis, matriz de permissões, RF/CA, RNF, fora de escopo, DEC-33 a 42 | Implementar ou aceitar qualquer RF; dúvida de escopo |
| `docs/02-regras-de-negocio.md` | RN-xxx (vigência, periodicidade, OS, alertas, estados, assinatura, permissões), D-xx | Qualquer lógica de domínio, estado ou permissão |
| `docs/03-modelo-de-dados.md` | Tabelas, enums, triggers, índices, auditoria, exclusão lógica, ER, DM-xx | Schema, migração, consulta, trigger |
| `docs/04-fluxos-e-telas.md` | FL-xx, TL-xxx, padrões UF/UL/PW, erros E-xx.y | Tela, fluxo, mensagem de erro, PWA |
| `docs/05-stack-e-arquitetura.md` | ADR, MOD-xx, módulos, pastas, offline, CI/CD, MG-xx, spikes S-xx | Escolher lib, criar módulo, sync offline, job, migração |
| `docs/06-seguranca-e-operacao.md` | Auth, OWASP, segredos, LGPD, logs, integridade, backups, SEG/LG/INT | Auth, upload, logs, dados pessoais, dependências, deploy |
| `docs/glossario.md` | Termos, prefixos de ID e vocabulário canônico | Nome de entidade/termo ou ID desconhecido |
| `docs/07-plano-de-implementacao.md` | Etapas de construção do MVP (Etapa 1 fundação, Etapa 2 autenticação e permissões...), entregas, spikes antes de cada etapa e critério de pronto | Antes de começar qualquer trabalho: confirme em que etapa ele está |
| `docs/auditoria-final.md` | Auditoria de 27/10/2026: decisões AF-01 a AF-20 (§5) e o que continua aberto sem travar o código (§6) | Dúvida sobre uma decisão `AF-xx` ou sobre um item ainda aberto |

Prioridade em conflito: `DEC-xx` > demais regras (doc 02). As respostas do usuário de 21/10/2026 (rodadas 1 e 2) e as decisões da auditoria final de 27/10/2026 (`AF-xx`) já estão aplicadas nos docs 00–06. **Não existe mais** `docs/pendencias.md` nem IDs `PEND-xx` (AF-01); o que continua aberto está em `docs/auditoria-final.md` §6, cada item com o padrão a seguir. Se ainda assim achar uma divergência entre docs que afete o código, pare e pergunte.

Vocabulário de fases: **"Etapa n"** = etapa de construção do MVP (doc 07). **"Fase 2"** nos docs 00–06 = depois do MVP; nada marcado "Fase 2" é implementado agora.

## Estrutura de pastas planejada (docs/05 §5)
```
db/migrations/  db/sql/ (triggers, RLS, GRANT)  db/seed/
src/app/(auth) (adm)/adm (cliente)/cliente (tecnico)/tecnico  src/app/api/{auth,sync/v1,arquivos/[id],cron}
src/modules/<modulo>/{index.ts,domain/,service.ts,repo.ts,schemas.ts,actions.ts,*.test.ts}
src/server/{db,auth,jobs,pdf,ai,storage,crypto}/ context.ts env.ts
src/pwa/{db.ts,sync/,photos.ts}  src/components/  src/lib/
tests/{integration,isolation,e2e,fixtures}/   docs/runbooks/
```
Módulos: `acesso autorizacao empresa clientes biblioteca equipamentos pmoc cronograma visitas execucao relatorios assinaturas notificacoes auditoria arquivos jobs`.

## Comandos (o repositório ainda não tem scaffolding)
| Ação | Comando | Status |
|---|---|---|
| Instalar | `pnpm install --frozen-lockfile` | docs/06 SEG-80 |
| Rodar local | `pnpm dev` (`next dev`) + Postgres em Docker ou Supabase CLI | nome do script [A VALIDAR] |
| Testar | `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright) | nomes [A VALIDAR] |
| Lint/formatar | `biome check` · tipos: `tsc --noEmit` | docs/05 §7.2 |
| Migrar | `pnpm db:migrate` (drizzle-kit + SQL à mão, em ordem) | docs/05 §3.2 |
| Gerar migração | `drizzle-kit generate` | docs/05 §3.2 |
| Auditoria de deps | `pnpm audit --prod --audit-level=high` | docs/06 SEG-84 |
| Primeiro ADM | `pnpm adm:primeiro --nome "..." --email ...` (só com banco sem ADM) | docs/runbooks/primeiro-adm.md |

## Convenções de código e nomes
- Banco: tabelas e colunas em inglês `snake_case` (`app_user`, `visit_report`); PK `id uuid`; FK `{entidade}_id`; enum = `text` + `CHECK`; valores de enum em português maiúsculo (`PREVISTA`, `EM_ANDAMENTO`).
- Datas de negócio `date` no fuso `America/Sao_Paulo`; data/hora `timestamptz` em UTC. Documentos e telefones só com dígitos; máscara só na exibição/PDF.
- Módulos e rotas em português, como em docs/05 §2.3 e §5. Server Action = verbo + entidade (`emitirPmoc`, `assinarDocumento`).
- Commits: Conventional Commits com ID do requisito (`feat(execucao): RF-21 ...`). Testes citam o ID (`RN-023`, `CA-11.1`).

## Sempre
- Sempre consultar `docs/02-regras-de-negocio.md` antes de alterar periodicidade, cronograma, vencimento, estados ou permissões.
- Sempre que mudar uma regra, atualizar o doc de origem (02, 03, 04…) no mesmo PR, com o ID da regra.
- Sempre passar `ctx` (`RequestContext`) às funções de serviço e checar permissão antes de ler ou escrever (MOD-04).
- Sempre ler e escrever dentro de `withTransaction(ctx, fn)` (auditoria + RLS) (MOD-05). O contexto `app.*` é gravado com `SELECT set_config('app.x', $1, true)` e parâmetros, nunca com texto de `SET LOCAL` (AF-05). Única exceção: as tabelas `auth_*`, acessadas só pelo Better Auth (AF-04).
- Sempre filtrar exclusão lógica (`*_live` ou `live(table)`); `UPDATE` com `WHERE row_version = :esperado`.
- Sempre devolver 404 para recurso de outro cliente (RN-162) e criar teste de isolamento para toda rota/action acessível ao `CLIENTE` e ao `TECNICO` (decisão B13).
- Sempre implementar `[A VALIDAR]` como descrito, isolado em configuração ou função única, fácil de mudar.
- Sempre `runtime = "nodejs"`; o PDF de PMOC e de relatório é gerado de forma **síncrona** (decisão A2 a); processamento diário e limpezas rodam como job (MOD-07).

## Nunca
- Nunca inventar regra normativa, artigo, periodicidade ou requisito. Sem fonte nos docs: marcar `[A VALIDAR]` e perguntar.
- Nunca citar Lei 13.589/2018, RE 09/2003 ou NBR 13971 como origem de regra: o conteúdo delas não está nos docs. A Lei 13.589/2018 pode aparecer só como referência normativa (decisão C12).
- Nunca implementar expurgo ou eliminação automática de dados antes de categorias e prazos aprovados (decisão A8; prazos ainda abertos, `docs/auditoria-final.md` §6).
- Nunca alterar uma `DEC-xx` sem nova decisão do usuário. Nunca decidir item `[A VALIDAR – advogado]`. Na rodada 2 o usuário disse que não será necessário advogado (R2, bloco 4); isso **não** autoriza a IA a decidir: mantenha o padrão conservador do doc e aponte o item de `docs/auditoria-final.md` §6 até o usuário assumir cada um por escrito.
- Nunca inventar coluna, tabela, valor de enum ou tela que não esteja nos docs 03 e 04. Os nomes que eram "propostos" foram confirmados (AF-02) e as telas da 04 §4.5 foram desenhadas (AF-09); se faltar algo, pergunte.
- Nunca implementar algo marcado "Fase 2", "Depois" ou "Futuro" (ex.: offline nível 2, PIN do app, `audit_seal`, push do PWA).
- Nunca importar arquivo interno de outro módulo; só `index.ts` (MOD-02). Só `repo.ts` acessa o banco (MOD-03).
- Nunca usar Server Action na sincronização do PWA; usar `/api/sync/v1/*` com `Idempotency-Key`.
- Nunca alterar produção pelo painel do Supabase; toda mudança de esquema é migração (MG-01), no padrão expandir → migrar → contrair (MG-02).
- Nunca fazer exclusão física em tabela de negócio; nunca editar tabela `[I]` nem `audit_log`.
- Nunca registrar em log senha, token, e-mail, certificado, corpo de auth/sync, prompt ou resposta da IA (LG-30 a LG-33).
- Nunca usar `^` em versões nem dados reais em staging sem anonimizar.

## Fluxo de trabalho
1. Ler os docs da parte afetada e listar os IDs (RF, RN, DM, FL/TL, ADR) envolvidos.
2. Planejar antes de codar: arquivos, migrações, testes e dúvidas. Se faltar regra, perguntar antes.
3. Rodar o spike `S-xx` exigido antes da parte afetada (docs/05 §10.4; a ordem está no doc 07).
4. Testes primeiro para regra de negócio: unitário em `domain/` (casos de RN-025 para periodicidade); integração para trigger, RLS e migração (MG-04). Meta: 90% em `domain/` e `autorizacao`.
5. Implementar; rodar `biome check`, `tsc --noEmit` e testes; atualizar o doc se a regra mudou.
6. PR em branch curta (trunk-based), mesmo trabalhando sozinho, para rodar CI e preview.
