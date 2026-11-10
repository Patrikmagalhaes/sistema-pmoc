# 06 – Segurança e operação do Sistema PMOC

> **Versão:** 1.1 – 27/10/2026 (decisões de 21/10/2026 e da auditoria final AF-01 a AF-20 incorporadas: `docs/auditoria-final.md` §5)
> **Base:** `docs/05-stack-e-arquitetura.md` (ADR-01 a ADR-08, ARQ-xx, S-xx), `docs/00-escopo-prd.md` (RNF-04, RNF-05, RNF-06, RNF-08, RNF-09, RNF-13, RNF-15, RNF-16), `docs/02-regras-de-negocio.md` (RN-120 a RN-135, RN-160 a RN-172), `docs/03-modelo-de-dados.md` (DM-07, DM-08, DM-11, DM-12, §5.3, §5.4, §6), `docs/04-fluxos-e-telas.md` (FL-01, DFT-20, DFT-21) e o pedido do usuário de 17/10/2026.
> **Leitor principal:** IA de código. Cada regra tem ID. Use os IDs em commits, tarefas e testes.
> **Stack e hospedagem:** exatamente as do doc 05 (Next.js 16.4 na Vercel Pro `gru1`, Supabase Pro `sa-east-1`, Better Auth, Drizzle, pg-boss, Sentry, Better Stack, backup externo em Cloudflare R2). Este documento **não troca** nenhuma escolha do doc 05; onde precisa ajustar algo, está na tabela "Mudanças propostas".
> **Preços:** consultados em **17/10/2026** (fontes na §11). Conversão do doc 05: **US$ 1 = R$ 5,0693**. Valores sem impostos, salvo onde indicado.

## Convenções

| Marca | Significado |
|---|---|
| **deve** | Obrigatório para a implementação. |
| **pode** | Permitido, não obrigatório. |
| **MVP** | Implementar antes do go-live. |
| **Depois** | Fica para depois do go-live; o gatilho para fazer está na §9. |
| **[A VALIDAR]** | Não veio dos arquivos nem do usuário. Implementar como descrito, de forma fácil de mudar. |
| **[A VALIDAR – advogado]** | Questão jurídica (LGPD, validade de assinatura, prazos legais). Não decidir sem parecer. |
| **(estimativa)** | Número calculado a partir das premissas do doc 05; não é medição nem preço publicado. |

Prefixos de ID deste documento: `SEG` (segurança de aplicação), `LG` (LGPD), `INT` (integridade de documentos), `DSP` (disponibilidade), `DES` (desempenho), `OBS` (observabilidade), `FIN` (custos), `GL` (go-live), `INC` (incidentes), `TD` (trade-offs), `OP-Q` (perguntas desta rodada).

### Respostas da rodada anterior (doc 05)

Em 21/10/2026 o usuário respondeu ARQ-Q1 a ARQ-Q3; ARQ-Q4 foi respondida em 27/10/2026 (AF-14). A coluna "Opção aplicada" abaixo é o que este documento assumiu na escrita; a coluna "Resposta de 21/10/2026" prevalece:

| ID | Opção aplicada (escrita) | Resposta de 21/10/2026 | Efeito neste documento |
|---|---|---|---|
| ARQ-Q1 | Visita inteira offline no MVP | **Fase 2** (A1 b); o MVP fica no nível 1 | Dados pessoais no celular do técnico (§1.2.4, §2); risco de perda entre backup e aparelho (TD-04). |
| ARQ-Q2 | Comprovante de visita assinado no celular | **Sim** (A3 a) | Dados de quem assina sem ser usuário (§2.2, LG-03). |
| ARQ-Q3 | Certificado A1 | **A1** (A7) | Chave do RT no servidor; segredo mais crítico do sistema (§1.6, §3.1). |
| ARQ-Q4 | Dados preferencialmente no Brasil | **Preferível, não obrigatório** (AF-14) | Banco e arquivos em São Paulo; IA, e-mail e monitoramento fora (§2.8). |

### Perguntas desta rodada

OP-Q1 e OP-Q2 **continuam sem resposta**; o documento aplica a opção marcada como sugerida, que é a mais conservadora, e nenhuma das duas trava o código (`docs/auditoria-final.md` §6). **OP-Q3 foi respondida em R2 2.11** ("não precisa de alertas por e-mail/Slack") e fechada em 27/10/2026 (AF-15): **sem alerta ativo** no MVP; o operador consulta os painéis. Sobre o parecer jurídico: o usuário respondeu em R2 (bloco 4) que **não será necessário advogado**; itens `[A VALIDAR – advogado]` mantêm o padrão conservador deste documento até o usuário assumi-los por escrito.

| ID | Pergunta | Opções | Aplicado neste documento |
|---|---|---|---|
| OP-Q1 | A empresa executora é microempresa ou empresa de pequeno porte (ME/EPP)? Isso dispensa o encarregado de dados e dobra prazos de comunicação na LGPD (§2.9). | **Sim** / **Não** / **Não sei** | **Não sei**: o documento usa os prazos normais, que são os mais curtos (mais seguro). |
| OP-Q2 | Por quanto tempo guardar PMOCs, relatórios, registros e assinaturas depois do fim do contrato? | **5 anos** (sugerido) / **Para sempre** / Outro | **5 anos** após o fim do contrato, marcado [A VALIDAR – advogado] (§2.4). |
| OP-Q3 | Alertas urgentes só por e-mail e notificação do app do Slack no celular, sem ligação telefônica, no MVP? | **Sim** (sugerido, custo zero) / **Não** (plano pago de alertas) | **Respondida em R2 2.11: sem alertas por e-mail/Slack. Fechada em AF-15: sem alerta ativo; só painéis.** Sem plano pago. |

### Mudanças propostas nos documentos anteriores

Situação em 27/10/2026: a tabela é a lista de mudanças propostas na escrita deste documento. Aplicadas em 21/10/2026: senha mínima (decisão B6: **8**, não 12), tabelas novas `security_event` e `job_run` (e `renderer_version`) no doc 03 §2.12 e §2.6, e a retenção como política sem expurgo automático (A8). **Aplicadas em 27/10/2026 (auditoria final):** `set_config` no lugar de `SET LOCAL` (AF-05), sessão do Better Auth explícita (SEG-10, AF-08), e, como propostas por este documento, J-07 que encerra ao esvaziar, logs da Vercel de 1 dia e as metas da §4.1 e da §5.1 para RNF-13 e RNF-16 (AF-20). `audit_seal` continua **Depois** (doc 03 E2). **Continua aberto, sem travar o código:** prazos de retenção (OP-Q2).

| ID afetado | Documento | Mudança proposta | Motivo |
|---|---|---|---|
| §4.2 item 2 (`SET LOCAL app.client_id = '<uuid>'`) e doc 03 §5.3 | 05, 03 | Gravar o contexto com `SELECT set_config('app.client_id', $1, true)` (parâmetro do driver), nunca montando o texto do `SET LOCAL`. | `SET LOCAL` não aceita parâmetro; montar a string abre injeção de SQL (SEG-31). O efeito é o mesmo (`true` = só na transação). |
| §3.9 J-07 | 05 | O processador da fila **encerra assim que a fila estiver vazia**; só continua até 700 s enquanto houver job. | Uma função que fica 700 s ligada a cada minuto vira uma função permanente e é cobrada como tal (FIN-08). |
| DFT-21 (senha mínima de 8) e §3.3 do doc 05 (12) | 04, 05 | ~~Senha mínima de 12 caracteres.~~ **Decidido B6 (21/10/2026): mínimo de 8.** Docs 04 e 05 ajustados; SEG-01 também. | O NIST recomenda mais para senha sem MFA; risco aceito com SEG-02 e SEG-07 (AF-19). |
| §3.3 do doc 05 (sessão web 12 h) | 05 | Configurar a sessão do Better Auth explicitamente (SEG-10). O padrão da biblioteca é 7 dias. | Sem configuração, vale o padrão de 7 dias, não as 12 h decididas. |
| §7.6 do doc 05 | 05 | Registrar que os logs da Vercel Pro ficam só **1 dia**; o histórico de longo prazo fica no banco (`audit_log`, `security_event`, `job_run`) e no Sentry (§6.1). | Limite publicado da Vercel; o doc 05 não tratava a retenção. |
| Doc 03 §2 (novas tabelas) | 03 | Criar `security_event` (§3.3.3), `audit_seal` (§3.3.2) e `job_run` (§6.2). Nova coluna `pmoc_version.renderer_version` e `visit_report_version.renderer_version` (§3.4). | Trilha de acesso, selo da auditoria, histórico de jobs e rastreabilidade do gerador de PDF. |
| RNF-13, RNF-16 | 00 | Metas de disponibilidade e desempenho da §4.1 e da §5.1. | Fecham os [A VALIDAR] desses RNFs com números (ainda a validar pelo usuário). |
| RNF-05.5, HM-10, `audit_log` (retenção) | 00, 03 | Prazos da §2.4. | Fecham o [A VALIDAR] de retenção, dependendo de OP-Q2. |

---

## 1. Segurança de aplicação

### 1.1 O que realmente pode dar errado (ordem de prioridade)

| ID | Ameaça | Impacto | Onde está tratada |
|---|---|---|---|
| AM-01 | Um usuário de cliente vê dados de outro cliente (filtro esquecido, ID trocado na URL, cache compartilhado) | **Crítico** (requisito central do sistema) | ADR-05, §1.3, DES-10 |
| AM-02 | Conta de ADM tomada (senha vazada, phishing) | Crítico: acesso a tudo, inclusive ao uso do certificado do RT | SEG-01 a SEG-15 |
| AM-03 | Segredo vazado (chave do banco, `CERT_ENCRYPTION_KEY`, token de provedor) | Crítico | §1.6 |
| AM-04 | Dependência com falha grave (ex.: falha de execução remota de código nos React Server Components, CVE-2025-55182, dezembro de 2025) | Crítico | §1.7 |
| AM-05 | Celular do técnico perdido ou roubado | Alto (dados de clientes no aparelho) | SD-01 a SD-06 (doc 05 §6.6), SEG-14 |
| AM-06 | Conta de provedor perdida ou invadida (Supabase, Vercel, GitHub) | Crítico | §1.6, DSP-20, INC-07 |
| AM-07 | Abuso automatizado (força bruta no login, robô gerando IA ou PDFs) | Médio: conta tomada ou custo | §1.5 |

Não estão no topo, por este porte: ataques de negação de serviço volumosos (a Vercel absorve a camada de rede), ameaças internas sofisticadas e espionagem dirigida.

### 1.2 Autenticação

#### 1.2.1 Senhas

| ID | Regra | Fase |
|---|---|---|
| SEG-01 | Senha com **mínimo 8** (decisão B6, 21/10/2026; a proposta original era 12) e **máximo 128** caracteres. **Sem** exigência de maiúscula, número ou símbolo. **Sem** troca periódica obrigatória. A tela sugere frase-senha. | MVP |
| SEG-02 | Recusar senha presente em lista de senhas vazadas e senhas óbvias (nome do sistema, e-mail do usuário). Usar o recurso de checagem de senha vazada do Better Auth, se existir na 1.7 [A VALIDAR no S-04]; senão, lista local das 100.000 senhas mais comuns. | MVP |
| SEG-03 | Hash com **scrypt** (padrão do Better Auth). Atende RNF-04 ("hash forte"). Não trocar o algoritmo. | MVP |
| SEG-04 | Troca de senha exige a senha atual; ao trocar ou redefinir, **revogar todas as outras sessões** do usuário. | MVP |

Referência: o NIST SP 800-63B-4 recomenda pelo menos 15 caracteres quando a senha é o único fator e 8 quando faz parte de MFA, aceitar pelo menos 64, não exigir composição nem troca periódica e checar contra lista de senhas vazadas. Os 8 caracteres para quem não usa MFA (técnico e cliente; decisão B6) ficam abaixo dos 15 do NIST para não pesar no uso pelo celular; risco aceito (AF-19). A compensação é a recusa de senha vazada ou óbvia (SEG-02) e o bloqueio por tentativas (SEG-07).

#### 1.2.2 MFA

| ID | Regra | Fase |
|---|---|---|
| SEG-05 | MFA por **TOTP** (aplicativo autenticador) obrigatório para **ADM**: o ADM não acessa nenhuma tela além da de configurar MFA enquanto não ativar (ARQ-07; RN-194). | **MVP (decisão R2 1.2 b, 21/10/2026)** |
| SEG-06 | MFA opcional para TECNICO e CLIENTE. Ao ativar, gerar **10 códigos de recuperação** de uso único, mostrados uma vez. | **MFA opcional para TECNICO e CLIENTE: fase futura (B2 b).** Os 10 códigos de recuperação valem já no MVP para o ADM (R2 1.2 b) |
| SEG-06a | Não usar SMS nem WhatsApp como segundo fator (DEC-40 proíbe esses canais). Código por e-mail **não** é aceito como MFA de ADM [A VALIDAR]. | MVP para o ADM (R2 1.2 b) |

#### 1.2.3 Login e bloqueio

| ID | Regra | Fase |
|---|---|---|
| SEG-07 | **5 tentativas erradas** seguidas na mesma conta → bloqueio da conta por **15 minutos** (DFT-20). Além disso, limite por IP (§1.5). O bloqueio é por conta **e** por IP, para que um atacante não bloqueie contas em massa só pelo IP. | MVP |
| SEG-08 | Mensagem única "E-mail ou senha incorretos." (E-01.1). A tela de recuperação responde sempre "Se o e-mail estiver cadastrado, enviaremos um link" (não revela se o e-mail existe). | MVP |
| SEG-09 | Todo login (sucesso ou falha), bloqueio, troca de senha, ativação ou remoção de MFA e revogação de sessão grava uma linha em `security_event` (§3.3.3). | MVP |

#### 1.2.4 Sessão

| ID | Regra | Fase |
|---|---|---|
| SEG-10 | **Decidido (AF-08).** Configurar no Better Auth (não usar o padrão de 7 dias): **web ADM e CLIENTE**: expira após **12 h sem uso**, limite absoluto de **7 dias**; **PWA do técnico**: **30 dias** renováveis a cada uso (ARQ-06). Se a biblioteca não aceitar duração por perfil, implementar a checagem por perfil no `RequestContext` (S-04). | MVP |
| SEG-11 | Cookie de sessão `HttpOnly`, `Secure`, `SameSite=Lax`, prefixo `__Secure-`, sem domínio amplo (só o host do sistema). | MVP |
| SEG-12 | (Decisão D7.3 e R2 2.10 a: **Sim, simplificado**: só com **senha**; o TOTP do ADM é exigido no login, RN-194) **Reautenticação** (senha nos últimos 5 minutos) antes de: enviar ou trocar o certificado do RT, criar ou promover ADM, trocar e-mail de usuário, desativar MFA, exportar dados de titular. | MVP, versão simplificada |
| SEG-13 | (Decisão D7.3 e R2 2.10 a: **Sim, simplificado**: sessões ativas **só do próprio usuário**; a versão por usuário para o ADM não entra) Tela "Sessões ativas": ver e revogar (plugin `admin`). Inativar usuário revoga todas as sessões (RN-141). | MVP, versão simplificada |
| SEG-14 | Celular perdido: o ADM revoga as sessões do técnico; no próximo contato o PWA apaga os dados locais (SD-04). | **Depois (decisão D7.1)**; a revogação de sessões pelo ADM (SEG-13) continua; o apagamento remoto não. Risco aceito por escrito (R2 1.5 a); dados locais apagados após envio confirmado (OF-05) |

#### 1.2.5 Senha inicial e recuperação de conta

| ID | Regra | Fase |
|---|---|---|
| SEG-15 | Link de senha inicial (DFT-01) vale **72 h**; link de recuperação vale **30 min**; ambos de uso único, guardados em `auth_verification` (AF-04). Guardar só o hash do token se a versão 1.7 do Better Auth permitir (conferir no S-04); se não permitir, vale o padrão da biblioteca com essas validades curtas. | MVP |
| SEG-16 | As páginas `/senha/definir?token=` e `/senha/esqueci` (decisão C7) usam `Referrer-Policy: no-referrer` e trocam o token por um estado no servidor no primeiro acesso, retirando o token da URL (redirecionamento). Motivo: token em URL vaza pelo cabeçalho Referer e pelo histórico. | MVP |
| SEG-17 | Usuário que perdeu o aplicativo autenticador: usa um código de recuperação; sem código, **outro ADM** redefine o MFA, com motivo gravado no `audit_log`. Por isso o sistema **deve** ter no mínimo **2 ADMs** ativos com MFA. | MVP (decisões D7.2 e R2 1.2 b): códigos de recuperação, redefinição por outro ADM e mínimo de 2 ADMs. O usuário informou ~3 ADMs (R2, bloco 3) |
| SEG-18 | Único ADM sem acesso (caso extremo): procedimento de emergência no runbook `docs/runbooks/acesso-emergencia.md`, executado pelo operador direto no banco com o usuário dono, gravando motivo no `audit_log`. Nunca existe "senha mestra" no código. | MVP |
| SEG-19 | E-mail automático ao usuário quando a senha ou o MFA dele mudar. É e-mail de segurança da conta, do mesmo tipo dos de senha já permitidos no doc 05 §3.10 Decidido B4 a (21/10/2026): e-mails de segurança e ao operador são exceção a RN-100; DEC-40 trata de alertas de agenda. | MVP |

### 1.3 Autorização por perfil e por cliente

O desenho está no doc 05 (§3.3, ADR-05). Regras de implementação que faltavam:

| ID | Regra | Fase |
|---|---|---|
| SEG-20 | **Negar por padrão.** Toda função de serviço começa com `can(ctx, acao, recurso)`. Ação sem entrada na matriz = negada. | MVP |
| SEG-21 | O `proxy.ts` (antigo `middleware.ts`) do Next.js **só** redireciona usuário sem sessão para o login. **Nunca** é a única checagem de permissão. Motivo: em março de 2025 uma falha (CVE-2025-29927) permitiu pular o middleware com um cabeçalho forjado; quem só checava ali ficou exposto. | MVP |
| SEG-22 | O servidor **nunca** aceita `client_id`, `technician_user_id`, `role` ou dono de registro vindo do navegador. Recebe só o ID do recurso e a mudança; o dono é lido do banco e comparado com o `ctx`. | MVP |
| SEG-23 | Recurso fora do escopo → **404** (RN-162), inclusive em `/api/arquivos/:id` e nas rotas `/api/sync/v1/*`. | MVP |
| SEG-24 | Retorno de Server Action e de Route Handler é um **DTO** (objeto montado para a tela), nunca a linha do banco. Dados das tabelas `auth_*` (senha, tokens, segredo TOTP), campos `encrypted_*`, IP e e-mail de outros usuários nunca saem. Usar o pacote `server-only` em todo arquivo de `src/server/` e `repo.ts`. | MVP |
| SEG-25 | Teste automático de isolamento para toda rota acessível a `CLIENTE` e a `TECNICO` (doc 05 §3.11): A pede recurso de B → 404. Rota nova sem teste quebra o CI. | MVP |
| SEG-26 | Ações destrutivas ou sensíveis do ADM (cancelar visita, inativar equipamento com uso, retirar relatório, emitir PMOC) exigem confirmação na tela e gravam motivo (`app.reason`). | MVP |
| SEG-27 | RLS para o perfil `TECNICO` | Depois (TD-03) |

### 1.4 OWASP Top 10 (edição 2025) aplicado a este sistema

| Categoria OWASP 2025 | Como aparece aqui | Controle | IDs | Fase |
|---|---|---|---|---|
| A01 Broken Access Control | Cliente vendo outro cliente; técnico vendo visita de outro; download de arquivo por ID | Autorização no serviço, RLS para `CLIENTE`, 404, URL assinada de 5 min, testes de isolamento | SEG-20 a SEG-25, ADR-05 | MVP |
| A02 Security Misconfiguration | Bucket público, variável de produção em preview, cabeçalhos ausentes, painel do Supabase com API REST automática aberta | Bucket privado; API REST/PostgREST do Supabase desligada ou sem permissão para `anon` (doc 05 §8.4); cabeçalhos da §1.4.2; checklist GL | SEG-40 a SEG-49, GL-xx | MVP |
| A03 Software Supply Chain Failures | Pacote npm malicioso ou com falha grave | Versões fixas, lockfile, atraso mínimo para versões novas, scripts de instalação bloqueados, auditoria no CI | §1.7 | MVP |
| A04 Cryptographic Failures | Certificado do RT, backups, dados no celular | AES-256-GCM no certificado, backup cifrado, TLS obrigatório, PIN no PWA | §1.6, §2.6 | MVP |
| A05 Injection | SQL montado à mão, `SET LOCAL` com texto, nome de arquivo no caminho | Drizzle com parâmetros, `set_config($1)`, chave de Storage gerada pelo servidor | SEG-30 a SEG-33 | MVP |
| A06 Insecure Design | Conflitos offline, assinatura sem evidência, IA inventando dado | Já tratados por desenho: CF-01 a CF-07, RN-125, RN-128 | Docs 02 e 05 | MVP |
| A07 Authentication Failures | Força bruta, sessão eterna, recuperação fraca | §1.2 inteira | SEG-01 a SEG-19 | MVP |
| A08 Software or Data Integrity Failures | PDF alterado depois de assinado, auditoria apagada, migração sem revisão | Hash SHA-256, `stored_file` imutável, selo diário da auditoria, migração com aprovação manual | §3, MG-01 a MG-05 | MVP |
| A09 Logging & Alerting Failures | Ninguém percebe invasão ou falha de job | `security_event`, Sentry, Better Stack, alertas da §6.4 | §6 | MVP |
| A10 Mishandling of Exceptional Conditions | Erro que vaza detalhe, falha que deixa dado pela metade, "falha aberta" | Transação única por operação; erro genérico ao usuário e detalhe só no log; RLS falha fechada sem contexto; `app.actor_role` vazio = nada visível | SEG-34, doc 05 §4.2 | MVP |

#### 1.4.1 O que se aplica especificamente ao Next.js

| ID | Tema | Regra | Fase |
|---|---|---|---|
| SEG-28 | **XSS** | React escapa texto por padrão. **Proibido** `dangerouslySetInnerHTML` (regra de lint). O texto da IA e as observações do técnico são exibidos como **texto**, nunca como HTML ou Markdown renderizado com HTML. Links montados com dado do usuário só aceitam `https:` (nunca `javascript:`). | MVP |
| SEG-29 | **CSRF em Server Actions** | O Next.js compara o `Origin` com o `Host` e rejeita diferença. **Não** configurar `serverActions.allowedOrigins` (não há proxy na frente). Manter o Next.js atualizado: a falha CVE-2026-27978 (março de 2026, corrigida na 16.1.7) deixava passar origem `null`; a 16.4.2 do doc 05 já tem a correção. Toda Server Action também checa sessão e permissão por dentro (SEG-20). | MVP |
| SEG-29a | **CSRF em Route Handlers** (`/api/sync/v1/*`, `/api/arquivos/*`) | Não têm a proteção automática das Server Actions. Exigir: método `POST` para mudanças; `Content-Type: application/json`; cabeçalho `X-App-Version` presente; checagem do `Origin` igual ao host do sistema. O cookie `SameSite=Lax` já impede o envio em POST vindo de outro site. | MVP |
| SEG-29b | Rotas de cron e jobs | `/api/cron/*` exige `Authorization: Bearer ${CRON_SECRET}` comparado em tempo constante; sem sessão de usuário. | MVP |
| SEG-30 | **Injeção de SQL** | Só consultas do Drizzle ou `sql` com parâmetros. **Proibido** `sql.raw()` com qualquer valor vindo de fora (lint + revisão). Ordenação e filtros dinâmicos usam lista fechada de colunas permitidas. | MVP |
| SEG-31 | Contexto da transação | `SELECT set_config('app.actor_user_id', $1, true), set_config('app.actor_role', $2, true), set_config('app.client_id', $3, true), ...` com parâmetros (ver tabela de mudanças). | MVP |
| SEG-32 | **SSRF** | O servidor só chama hosts fixos (Supabase, Anthropic, Resend, Sentry, Better Stack). **Nenhuma** funcionalidade busca URL informada pelo usuário (ex.: logo "por link"). `images.remotePatterns` do Next.js vazio; fotos não passam pelo otimizador de imagens (FIN-09). Se um dia precisar buscar URL externa: lista de hosts permitidos e bloqueio de IPs internos. | MVP |
| SEG-33 | **Upload de arquivos** | Ver §1.4.3. | MVP |
| SEG-34 | Mensagens de erro | Ao usuário: texto genérico + código curto (`ERR-xxxx`) + `requestId`. Pilha de erro, SQL e nomes de tabela só no log e no Sentry. `NODE_ENV=production` sempre em produção e preview. | MVP |
| SEG-35 | Cache e dados por usuário | Ver DES-10: nada que dependa de `ctx` entra em cache compartilhado. | MVP |
| SEG-36 | Chave das Server Actions | Na Vercel, a chave de cifra das Server Actions é gerenciada pela plataforma. Se um dia sair da Vercel (doc 05 §8.4), definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` fixa e igual em todas as instâncias. | Depois |

#### 1.4.2 Cabeçalhos de segurança

Definidos em `next.config.ts` (`headers()`) e no `proxy.ts` (CSP com nonce). Valores:

| ID | Cabeçalho | Valor | Observação |
|---|---|---|---|
| SEG-40 | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Acrescentar `preload` só depois de 1 mês estável [A VALIDAR]. |
| SEG-41 | `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://{projeto}.supabase.co; connect-src 'self' https://{projeto}.supabase.co https://*.ingest.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'` | Começar como `Content-Security-Policy-Report-Only` no preview por 2 semanas, depois ativar [A VALIDAR]. Hosts exatos do Sentry e do Supabase conforme o projeto. `connect-src` precisa do Storage porque o upload de fotos vai direto do aparelho (doc 05 §3.7). |
| SEG-42 | `X-Content-Type-Options` | `nosniff` | — |
| SEG-43 | `X-Frame-Options` | `DENY` | Redundante com `frame-ancestors`, mantido para navegadores antigos. |
| SEG-44 | `Referrer-Policy` | `strict-origin-when-cross-origin`; `no-referrer` nas páginas de senha (SEG-16) | — |
| SEG-45 | `Permissions-Policy` | `camera=(self), geolocation=(), microphone=(), payment=(), usb=()` | Geolocalização desligada até parecer (ARQ-13). |
| SEG-46 | `Cross-Origin-Opener-Policy` | `same-origin` | — |
| SEG-47 | `Cache-Control` em respostas com dados pessoais | `private, no-store` | Vale para páginas autenticadas, `/api/sync/*` e `/api/arquivos/*`. |
| SEG-48 | Download de arquivo | `Content-Disposition: attachment` para tudo que não for PDF ou imagem exibida pelo próprio sistema; `Content-Type` sempre o gravado em `stored_file.mime_type`, nunca o informado no upload. | — |
| SEG-49 | Verificação | Teste E2E que confere os cabeçalhos em `/login`, numa página ADM e numa rota de API. | — |

#### 1.4.3 Upload de arquivos

| ID | Regra |
|---|---|
| SEG-50 | Upload vai direto ao Storage por URL assinada de uso único (doc 05 §3.7). A **chave** do objeto é decidida pelo servidor (`{kind}/{yyyy}/{mm}/{uuid}.{ext}`); o nome original só vai para `original_filename`, nunca para o caminho. |
| SEG-51 | Tipos aceitos por finalidade: foto = `image/jpeg` (o PWA converte PNG, WebP e HEIC para JPEG antes, AF-17; 02 RN-185); imagem da assinatura do comprovante = `image/png`, até 200 KB (AF-10); logo = `image/png` ou `image/jpeg`; PDF manual (RN-120, A3) = `application/pdf`; certificado = `.pfx`/`.p12`. **SVG proibido** (pode conter script). |
| SEG-52 | Tamanho máximo: foto **10 MB**, logo **2 MB**, PDF manual **50 MB**, certificado **50 KB** [A VALIDAR]. Limite aplicado na URL assinada (quando o Storage permitir) **e** na confirmação. |
| SEG-53 | Na confirmação (`photos/confirm` e equivalentes) o servidor confere tamanho e `sha256` declarados contra o objeto gravado; para logo e PDF manual, lê os primeiros bytes e confere a assinatura do formato (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF-`). Arquivo divergente: objeto marcado como rejeitado e não referenciado. |
| SEG-54 | O certificado **não** vai para o Storage: é lido em memória na própria requisição, aberto com a senha, cifrado e gravado no banco (DM-11, §1.6). Senha e arquivo nunca em log (RN-121). |
| SEG-55 | A recompressão por canvas no PWA remove os metadados EXIF (inclusive GPS) das fotos. A data/hora de captura é guardada à parte (RNF-11). Isso também atende à minimização (LG-02). |
| SEG-56 | Antivírus em upload: **não** no MVP. Motivo: os únicos arquivos enviados por terceiros são fotos recomprimidas pelo próprio app e PDFs enviados pelo ADM. Rever se o cliente passar a enviar arquivos (TD-11). |

### 1.5 Limite de requisições (rate limiting)

Duas camadas, sem Redis:
1. **Vercel WAF** (Firewall da Vercel): no Pro, até 40 regras por projeto, janela fixa de 10 s a 10 min, contagem por IP ou JA4, cobrança por uso. Barra o volume antes de chegar à função.
2. **Aplicação**: limite embutido do Better Auth nas rotas de autenticação, mais contadores por usuário numa tabela do Postgres para as rotas caras.

| ID | Rota ou ação | Limite | Camada | Ao estourar |
|---|---|---|---|---|
| SEG-60 | `POST` de login | 5 falhas por conta → bloqueio de 15 min (SEG-07); 20 por minuto por IP | Better Auth + WAF | 429 com "Muitas tentativas. Tente novamente em alguns minutos." |
| SEG-61 | Pedir link de recuperação | 3 por hora por e-mail; 10 por hora por IP | Aplicação + WAF | Mesma resposta genérica (SEG-08), sem enviar e-mail |
| SEG-62 | Validar TOTP | 5 falhas → bloqueio de 15 min | Better Auth | 429 |
| SEG-63 | `/api/sync/v1/push` | 60 por minuto por usuário | Aplicação | 429 com `Retry-After`; o PWA espera e reenvia (doc 05 §6.4) |
| SEG-64 | `/api/sync/v1/photos/upload-url` | 120 por minuto por usuário | Aplicação | 429 com `Retry-After` |
| SEG-65 | Gerar texto por IA | 3 gerações por versão de relatório e 30 por dia por usuário [A VALIDAR] | Aplicação | Mensagem "Limite de gerações atingido; escreva o texto manualmente" (RNF-10.4) |
| SEG-66 | Gerar PDF (emitir, ficha atualizada, exportação) | Uma geração por documento ao mesmo tempo (trava na aplicação; PDF é síncrono, A2 a); 20 fichas atualizadas por hora por usuário [A VALIDAR] | Aplicação | "Já existe uma geração em andamento" |
| SEG-67 | Qualquer rota | 600 requisições por minuto por IP | WAF | 429. Começar a regra em modo **Log** por 1 semana para medir antes de bloquear. |

Regras:
- SEG-68: o Better Auth lê o IP do `X-Forwarded-For` por padrão. Na Vercel, configurar `advanced.ipAddress.ipAddressHeaders` com o cabeçalho que a plataforma garante e o usuário não consegue forjar (`x-vercel-forwarded-for` ou `x-real-ip`) [A VALIDAR no S-04].
- SEG-69: os técnicos de uma mesma empresa podem sair pelo mesmo IP (rede móvel com NAT). Por isso os limites de rotas do PWA são **por usuário**, não por IP.

### 1.6 Gestão de segredos

| Segredo | Onde fica | Quem acessa | Rotação |
|---|---|---|---|
| `DATABASE_URL` (`app_rw`) | Variável de ambiente da Vercel, **só** produção | Aplicação | Anual e em incidente |
| `DATABASE_URL` do staging | Variável de ambiente da Vercel, **só** preview | Aplicação de preview | Quando quiser |
| URL do banco com usuário dono (migrações) | Segredo do GitHub no ambiente `production` (aprovação manual, doc 05 §7.2) | Workflow de migração | Anual e em incidente |
| Usuário `backup_ro` (leitura de tudo para `pg_dump`) | Segredo do GitHub (workflow de backup) | Workflow J-08 | Anual |
| Chaves do Storage (servidor) | Variável de ambiente da Vercel, só servidor | Aplicação | Anual |
| `AUTH_SECRET` (Better Auth) | Variável de ambiente da Vercel | Aplicação | Em incidente (derruba todas as sessões) |
| `CRON_SECRET` | Variável de ambiente da Vercel | Vercel Cron | Anual |
| `CERT_ENCRYPTION_KEY` | Variável de ambiente da Vercel, **só** produção + cópia no gerenciador de senhas (SPOF-07) | Job de assinatura | Na troca do certificado do RT, com script de recriptografia |
| Chave pública `age` do backup | Segredo do GitHub | Workflow J-08 | — |
| Chave **privada** `age` do backup | **Só** no gerenciador de senhas + cópia impressa guardada fora do escritório [A VALIDAR] | Você, na restauração | Nunca na nuvem dos backups |
| Chaves de Anthropic, Resend, Sentry, Better Stack | Variável de ambiente da Vercel | Aplicação | Anual e em incidente |

| ID | Regra | Fase |
|---|---|---|
| SEG-70 | Nenhum segredo no repositório. `.env*` no `.gitignore`, exceto `.env.example` sem valores. Ativar **secret scanning** e **push protection** do GitHub no repositório. | MVP |
| SEG-71 | Só variáveis com prefixo `NEXT_PUBLIC_` chegam ao navegador; elas **só** podem conter valores públicos (DSN do Sentry, URL do projeto Supabase). Teste no CI que falha se uma variável sem esse prefixo aparecer no bundle do cliente [A VALIDAR: ferramenta]. | MVP |
| SEG-72 | Preview **nunca** recebe credenciais de produção. Variáveis separadas por ambiente na Vercel. | MVP |
| SEG-73 | **MFA ligado em todas as contas** de provedor: GitHub, Vercel, Supabase, Cloudflare, Anthropic, Resend, Sentry, Better Stack, registro do domínio, gerenciador de senhas e e-mail da empresa. | MVP |
| SEG-74 | O usuário dono do banco e a senha do usuário `postgres` do Supabase não são usados no dia a dia; ficam no gerenciador de senhas. | MVP |
| SEG-75 | Ao suspeitar de vazamento: seguir INC-05 (rotação em ordem). | MVP |
| SEG-76 | Cofre de segredos dedicado (Doppler, Infisical, AWS Secrets Manager) | Depois: só se houver mais de uma pessoa operando ou mais de um ambiente pago. |

### 1.7 Dependências e atualizações

| ID | Regra | Fase |
|---|---|---|
| SEG-80 | Versões exatas no `package.json` e `pnpm-lock.yaml` versionado (doc 05 §3). `pnpm install --frozen-lockfile` no CI. | MVP |
| SEG-81 | Scripts de instalação de pacotes bloqueados por padrão (comportamento do pnpm 10); liberar só os necessários em `onlyBuiltDependencies` [A VALIDAR: versão do pnpm]. | MVP |
| SEG-82 | Não instalar versão publicada há menos de **7 dias** (opção `minimumReleaseAge` do pnpm) [A VALIDAR: nome e versão da opção]. Exceção: correção de segurança, instalada manualmente. Motivo: pacotes maliciosos costumam ser descobertos e retirados em poucos dias (A03). | MVP |
| SEG-83 | Renovate (ou Dependabot) agrupa atualizações **mensais**; atualizações de **segurança** abrem PR na hora. | MVP |
| SEG-84 | `pnpm audit --prod --audit-level=high` no CI: vulnerabilidade alta ou crítica em dependência de produção quebra o build. | MVP |
| SEG-85 | Prazo para aplicar correção de segurança: **crítica** em até 24 h, **alta** em até 7 dias, demais no lote mensal [A VALIDAR]. Exemplo do motivo: a falha CVE-2025-55182 (React2Shell, dezembro de 2025) permitia executar código no servidor de apps Next.js com Server Components. | MVP |
| SEG-86 | Acompanhar avisos de segurança de Next.js, React, Better Auth e Drizzle (opção "Watch → Security alerts" no GitHub de cada projeto) e o alerta do Dependabot do repositório. | MVP |
| SEG-87 | Teste de intrusão externo (pentest) | Depois: antes de abrir o portal para mais de 300 clientes ou se um cliente exigir em contrato [A VALIDAR]. |

---

## 2. Proteção de dados e LGPD

Todo o conteúdo jurídico desta seção é proposta técnica. **[A VALIDAR – advogado]** vale para a seção inteira, mesmo onde não estiver repetido.

### 2.1 Papéis (controlador e operador)

| Quem | Papel proposto | Motivo |
|---|---|---|
| Empresa executora (dona do sistema) | **Controladora** dos dados dos seus usuários (ADM, técnicos), dos usuários dos clientes, do RT e das evidências de assinatura | Decide para que e como esses dados são tratados (acesso, execução do serviço, prova de assinatura). |
| Empresa executora em relação aos dados do PMOC do cliente | Controladora **ou** operadora do cliente [A VALIDAR – advogado] | O PMOC é obrigação do proprietário (Lei 13.589/2018, citada só como referência normativa e não como origem de regra do sistema, decisão C12), mas quem o elabora e guarda é a executora. Define o texto do contrato de serviço e a política de privacidade. |
| Cliente (empresa contratante) | Controlador dos dados que ele mesmo indica (quem assina, quem acessa) [A VALIDAR – advogado] | — |
| Vercel, Supabase, Anthropic, Resend, Sentry, Better Stack, Cloudflare, GitHub | **Operadores** (suboperadores, se a executora for operadora) | Tratam dados por conta da executora, nos termos dos contratos de cada serviço. |
| Você (quem desenvolve e opera) | Parte da controladora, se for da empresa; **operador**, se for prestador externo [A VALIDAR] | Muda o contrato entre você e a empresa. |

### 2.2 Inventário de dados pessoais

Base legal = inciso do art. 7º da Lei 13.709/2018 (LGPD) proposto; **todas** [A VALIDAR – advogado].

| Titular | Dados | Onde | Finalidade | Base legal proposta | Vai para a IA? |
|---|---|---|---|---|---|
| ADM e técnico (empregados) | Nome, e-mail, telefone (opcional), hash de senha, segredo do TOTP, sessões (IP, user-agent, data) | `app_user`, tabelas do Better Auth, `security_event` | Acesso e segurança do sistema; autoria dos registros | Execução de contrato (V) e legítimo interesse (IX) | Não (RN-172) |
| Técnico | Autoria de registros, horários de início e fim da visita, data/hora do aparelho | `visit`, `occurrence_record`, `audit_log` | Registro do serviço executado (PMOC) | Obrigação legal (II) + execução de contrato (V) | Nome do técnico pode ir no relatório [A VALIDAR]; e-mail e telefone não |
| Usuário do cliente | Nome, e-mail, telefone (opcional), sessões | `app_user`, `security_event` | Acesso ao portal e assinatura | Execução de contrato (V) | Não |
| Quem assina pelo cliente (usuário) | Nome, e-mail, data/hora, fuso, IP, user-agent, hash do documento, texto do aceite | `document_signature` (RN-125) | Prova da assinatura | Exercício regular de direitos (VI) | Não |
| Quem assina o comprovante de visita (não usuário) | Nome digitado, imagem da assinatura, cargo [A VALIDAR]; **sem** CPF e **sem** geolocalização (ARQ-13) | `document_signature` (canal presencial) | Prova da visita | Exercício regular de direitos (VI) | Não |
| RT | Nome, título, registro profissional, telefone, e-mail, certificado e-CPF (contém CPF) | `technical_responsible`, `rt_certificate` | Exigência legal do PMOC; assinatura digital | Obrigação legal (II) | Não |
| Pessoas que aparecem em fotos | Imagem | Storage (`photo`) | Registro técnico do equipamento | Legítimo interesse (IX); ver LG-04 | Não (doc 05 §3.12) |
| Qualquer usuário | IP e ações | `audit_log`, `security_event`, logs | Segurança, auditoria, prova | Legítimo interesse (IX) e exercício regular de direitos (VI) | Não |

Dados sensíveis (art. 5º, II): **não** são coletados. O risco existe em clínicas (cliente real nos PDFs de referência) se uma foto captar paciente ou prontuário (LG-04).

### 2.3 Minimização

| ID | Regra | Fase |
|---|---|---|
| LG-01 | Coletar só os campos dos docs 00 a 04. Campo novo com dado pessoal exige motivo escrito no PR e linha nova na tabela da §2.2. | MVP |
| LG-02 | Fotos sem EXIF (SEG-55). | MVP |
| LG-03 | Comprovante de visita: não coletar CPF nem localização até parecer (ARQ-13). | MVP |
| LG-04 | O app mostra ao técnico, na primeira foto do dia: "Fotografe só o equipamento. Evite pessoas, telas e documentos." Em clientes de saúde, o aviso aparece em toda visita [A VALIDAR]. | MVP |
| LG-05 | Para a IA vão só dados da visita e do local (RN-172); o prompt usa o nome do técnico apenas se o relatório precisar mostrá-lo [A VALIDAR]. | MVP |
| LG-06 | Staging e testes usam dados fictícios; cópia de produção só anonimizada (doc 05 §7.1). | MVP |
| LG-07 | Sentry sem dados pessoais: `sendDefaultPii: false`, usuário identificado só pelo `id` (uuid), gravação de sessão (Session Replay) **desligada**. | MVP |

### 2.4 Retenção e descarte

Princípio: a LGPD manda eliminar o dado quando acaba a finalidade, mas permite guardar para cumprir obrigação legal e para exercício regular de direitos (art. 16). O registro do PMOC deve ficar disponível (RN-093). Prazos abaixo dependem de OP-Q2 e são **[A VALIDAR – advogado]**.

| ID | Dado | Prazo proposto | Depois do prazo | Fase |
|---|---|---|---|---|
| LG-10 | PMOC, versões, relatórios, registros de execução, fotos, assinaturas e comprovantes | **5 anos após o fim do contrato** do local (OP-Q2) | Arquivar ou eliminar por decisão do ADM, nunca automático [A VALIDAR] | Depois (a função de expurgo só é necessária no ano 6; a regra é registrada já) |
| LG-11 | Conta de usuário inativa | Dados de contato (e-mail, telefone) mantidos **5 anos** após inativação; o **nome** é mantido enquanto houver documento assinado por ele | Anonimizar e-mail e telefone (`anonimizado+{uuid}@invalid`) | Depois |
| LG-12 | `audit_log` | **5 anos** | Exportado para o armazenamento travado (INT-17) e removido do banco por função do dono | Depois |
| LG-13 | `security_event` (logins, falhas, downloads) | **Mínimo 6 meses**, proposta 2 anos | Eliminação física | **Suspenso até aprovação** (decisão A8: sem expurgo automático antes de categorias e prazos aprovados). Antes era "MVP (job mensal simples)" |
| LG-14 | Logs da aplicação | Vercel: 1 dia (limite do plano); Sentry: o do plano gratuito [A VALIDAR] | Eliminação automática pelo provedor | MVP |
| LG-15 | `idempotency_key` | 30 dias após expirar (J-06) | Eliminação física | **Suspenso até aprovação** (decisão A8; prazos em aberto, `docs/auditoria-final.md` §6). Antes era "MVP". `password_reset_token` não existe mais: tokens em `auth_verification`, limpos pela biblioteca (AF-04) |
| LG-16 | `notification` | 12 meses [A VALIDAR] | Eliminação física | Depois |
| LG-17 | Backups | 30 diários + 12 mensais (ARQ-09) | Expiram sozinhos. Dado eliminado no sistema **continua** nos backups até expirarem; a política de privacidade deve dizer isso. | MVP |
| LG-18 | Dados no celular do técnico | Até a visita sair da janela e tudo estar enviado (doc 05 §6.2) | Apagados pelo app | MVP |

Sobre o prazo de 6 meses dos registros de acesso (LG-13): o Marco Civil da Internet (Lei 12.965/2014, art. 15) obriga provedores de aplicação com fins econômicos a guardar registros de acesso por 6 meses. Se um sistema interno com portal para clientes se enquadra é [A VALIDAR – advogado]; guardar custa quase nada.

Como eliminar sem quebrar as regras do doc 03 (EL-1 proíbe `DELETE` pela aplicação):
- LG-19: eliminação e anonimização só por **funções `SECURITY DEFINER`** do usuário dono (`purge_*`, `anonymize_user`), chamadas por script manual com aprovação, gravando no `audit_log` o que foi feito (sem o valor apagado).

### 2.5 Direitos do titular (art. 18 da LGPD)

| ID | Direito | Como atender | Quem | Prazo |
|---|---|---|---|---|
| LG-20 | Confirmação e acesso | Exportar os dados do titular (JSON + PDF simples) por função `export_titular(user_id)` | ADM, após SEG-12 | **15 dias** para a declaração completa (art. 19, II) [A VALIDAR – advogado]; em dobro se OP-Q1 = Sim |
| LG-21 | Correção | Tela de edição de usuário (ADM) ou "Meu perfil" (nome, telefone). Assinaturas antigas **não** mudam (são cópia do momento). | ADM / próprio usuário | Mesmo prazo |
| LG-22 | Anonimização, bloqueio ou eliminação | `anonymize_user` (LG-11). Dado necessário para prova ou obrigação legal fica (art. 16), com resposta explicando o motivo. | ADM + operador | Mesmo prazo |
| LG-23 | Informação sobre compartilhamento | Lista de operadores da §2.8 na política de privacidade | — | — |
| LG-24 | Portabilidade | Mesmo arquivo do LG-20 | ADM | [A VALIDAR – advogado] |
| LG-25 | Canal | E-mail próprio (ex.: `privacidade@{dominio}`) publicado na política de privacidade e no rodapé do portal [A VALIDAR: endereço]. Obrigatório mesmo para agente de pequeno porte. | Empresa | — |

Cada pedido gera registro (data, titular, pedido, resposta, data da resposta) numa planilha ou tabela simples [A VALIDAR: onde]. No MVP, uma planilha basta.

### 2.6 Criptografia

| Camada | Em trânsito | Em repouso |
|---|---|---|
| Navegador e PWA ↔ Vercel | HTTPS obrigatório (certificado automático da Vercel) + HSTS (SEG-40) | — |
| Vercel ↔ Supabase (Postgres) | TLS com `sslmode=verify-full` e o certificado da CA do Supabase [A VALIDAR: modo suportado pelo pooler] | AES-256 (publicado pelo Supabase para todos os dados) |
| Storage (fotos, PDFs) | HTTPS (URLs assinadas) | AES-256 (Supabase) |
| Certificado do RT | — | AES-256-GCM pela aplicação, chave em variável de ambiente (doc 05 §3.13) |
| Segredo do TOTP | — | Como a biblioteca grava [A VALIDAR no S-04]; se em texto claro, cifrar com a mesma rotina do certificado |
| Senhas e tokens | — | scrypt (senhas); SHA-256 (tokens) |
| Backup externo (R2) | HTTPS | Cifrado com `age` **antes** de sair do GitHub Actions; a chave privada nunca está na nuvem (§1.6) |
| Celular do técnico | — | AES-GCM com chave derivada do PIN (SD-02) |

### 2.7 Logs sem dados sensíveis

| ID | Regra |
|---|---|
| LG-30 | Logger único (`src/server/log.ts`, pino ou equivalente) com lista de campos mascarados: `password`, `newPassword`, `token`, `code`, `totp`, `authorization`, `cookie`, `set-cookie`, `pkcs12`, `certificate`, `encrypted_*`, `email`, `phone`, `cpf`. |
| LG-31 | Nunca registrar corpo de requisição das rotas de autenticação, de `/api/sync/v1/push` e de upload de certificado. Registrar só tamanho, operação e resultado. |
| LG-32 | Usuário aparece no log só pelo `userId` (uuid) e `role`. E-mail nunca. IP só em `security_event` e `audit_log` (tabelas com acesso restrito ao ADM), não no log da aplicação. |
| LG-33 | Prompt e resposta da IA não vão para o log (já ficam no banco, RN-128). |
| LG-34 | Teste automático: um teste de integração faz login, troca senha e envia um push; depois procura no log capturado os valores usados (senha, token, e-mail) e falha se encontrar. |
| LG-35 | `beforeSend` do Sentry remove cabeçalhos `cookie` e `authorization`, `query string` das URLs de senha e corpo de requisições. |

### 2.8 Fornecedores e transferência internacional

| Fornecedor | Dados pessoais que recebe | Onde processa | Transferência internacional? |
|---|---|---|---|
| Supabase | Todos (banco e arquivos) | São Paulo (`sa-east-1`) | Não para os dados; suporte e metadados da conta podem sair [A VALIDAR] |
| Vercel | Requisições, logs (1 dia), IP | Funções em São Paulo (`gru1`); empresa e painel nos EUA | Possível (logs, metadados) [A VALIDAR] |
| Anthropic (IA) | Dados da visita (sem e-mail, telefone, IP) | Fora do Brasil (doc 05 §3.12) | **Sim** |
| Resend | E-mail e nome do destinatário, conteúdo do e-mail de senha | EUA [A VALIDAR] | **Sim** |
| Sentry | Erros com `userId`, rota, navegador | EUA ou UE, conforme a região escolhida ao criar a conta [A VALIDAR] | Sim |
| Better Stack | URL monitorada, heartbeats; sem dados pessoais | [A VALIDAR] | Irrelevante se sem dados pessoais |
| Cloudflare R2 | Backup cifrado (não legível sem a chave) | Região escolhida no bucket; há opção de jurisdição UE [A VALIDAR] | Sim, mas cifrado |
| GitHub | Código; **nunca** dados de produção | EUA | Não (sem dados pessoais) |

Regras:
- LG-40: para destinos sem decisão de adequação (EUA, por exemplo), a Resolução CD/ANPD nº 19/2024 exige mecanismo válido, como as **cláusulas-padrão contratuais** da ANPD; o prazo para incluí-las em contratos existentes terminou em 23/08/2025. Conferir se o contrato de dados (DPA) de cada fornecedor da tabela traz as cláusulas da ANPD ou outro mecanismo aceito [A VALIDAR – advogado].
- LG-41: a Resolução CD/ANPD nº 32/2026 (26/01/2026) reconheceu a adequação recíproca entre Brasil e União Europeia/Espaço Econômico Europeu, segundo fonte secundária consultada [A VALIDAR – advogado: conferir no texto oficial]. Consequência prática: **escolher região UE** no Sentry e jurisdição UE no R2, quando disponível, simplifica a transferência.
- LG-42: a política de privacidade lista os fornecedores e os países (art. 9º da LGPD: informação sobre uso compartilhado) [A VALIDAR – advogado].

### 2.9 Documentos e obrigações mínimas de LGPD

| ID | Item | Fase | Observação |
|---|---|---|---|
| LG-50 | Política de privacidade e termo de uso acessíveis no login e no portal (RNF-05.4) | MVP (bloqueante, GL-30) | Texto [A VALIDAR – advogado] |
| LG-51 | Canal do titular (LG-25) | MVP | Obrigatório também para pequeno porte |
| LG-52 | Registro das operações de tratamento (art. 37) | MVP | A tabela da §2.2 é a base; formato simplificado se OP-Q1 = Sim |
| LG-53 | Encarregado (art. 41) | MVP se OP-Q1 = Não; dispensado se Sim (Resolução CD/ANPD nº 2/2022), salvo tratamento de alto risco | [A VALIDAR – advogado] |
| LG-54 | Cláusula de proteção de dados no contrato de serviço com o cliente, junto da cláusula de aceite da assinatura eletrônica (ARQ-14) | MVP | [A VALIDAR – advogado] |
| LG-55 | Plano de resposta a incidentes (§8.2) com a regra da ANPD: comunicar à ANPD e aos titulares em até **3 dias úteis** quando houver risco ou dano relevante; prazo em dobro para agente de pequeno porte; guardar registro de **todo** incidente por no mínimo **5 anos** (Resolução CD/ANPD nº 15/2024) | MVP | [A VALIDAR – advogado] |
| LG-56 | Relatório de impacto (RIPD) | Depois: só se a ANPD pedir ou se passar a tratar dado sensível [A VALIDAR – advogado] | — |

---

## 3. Integridade e validade dos documentos

### 3.1 Assinatura digital

| ID | Documento | Como é assinado | Validade (análise preliminar) | Fase |
|---|---|---|---|---|
| INT-01 | PMOC (cada versão) | e-CPF A1 do RT, no servidor, formato PAdES (ADR-07) | Assinatura qualificada ICP-Brasil, com presunção de veracidade (MP 2.200-2/2001, art. 10, § 1º) [A VALIDAR – advogado] | MVP |
| INT-02 | PMOC e relatório (aceite do cliente) | Assinatura eletrônica simples com evidências (RN-125, ADR-08) | Depende do aceite entre as partes (MP 2.200-2/2001, art. 10, § 2º) e da cláusula contratual (ARQ-14) [A VALIDAR – advogado] | MVP |
| INT-03 | Comprovante de visita | Assinatura desenhada no celular + evidências (doc 05 §6.9) | Prova mais fraca (assinante sem login) [A VALIDAR – advogado] | MVP |

Regras técnicas da assinatura do RT:

| ID | Regra | Fase |
|---|---|---|
| INT-04 | Perfil da assinatura: PAdES básico, equivalente ao perfil **AD-RB** (referência básica) da ICP-Brasil [A VALIDAR no S-02: nome do perfil e política aceita pelo validador oficial]. | MVP |
| INT-05 | Validar cada PDF assinado do spike S-02 no verificador de conformidade do ITI antes do go-live (CA-13.1) [A VALIDAR: endereço atual do serviço]. | MVP |
| INT-06 | A hora da assinatura vem do relógio do servidor, não de uma Autoridade de Carimbo do Tempo. Consequência: não há prova independente da data, e depois que o certificado vencer o validador pode não conseguir confirmar que a assinatura foi feita durante a validade. | MVP (risco aceito, TD-06) |
| INT-07 | Acrescentar **carimbo do tempo** ICP-Brasil (perfil com referência de tempo, AD-RT) | Depois: gatilho e custo em TD-06 [A VALIDAR: fornecedor e preço por carimbo, não consultados] |
| INT-08 | O certificado é decifrado só em memória, dentro da requisição síncrona de emissão (A2 a), e a variável é zerada ao fim (RN-121). A função de assinatura é o **único** código que lê `CERT_ENCRYPTION_KEY`. | MVP |
| INT-09 | Certificado vencido ou revogado: emissão bloqueada com mensagem (RN-114, J-03). Revogação conhecida (roubo da chave): ADM marca o certificado como não atual; PMOCs já assinados continuam válidos até a data da revogação [A VALIDAR – advogado]. | MVP |
| INT-10 | Lacrar o PDF final do cliente (com página de evidências) com e-CNPJ da empresa, para provar que ninguém alterou a página de evidências | Depois [A VALIDAR – advogado: valor jurídico e custo do e-CNPJ] |

### 3.2 Hash dos PDFs e arquivos

| ID | Regra | Fase |
|---|---|---|
| INT-11 | Todo arquivo gravado tem `stored_file.sha256` calculado **pelo servidor** a partir dos bytes gravados (PDF gerado) ou conferido na confirmação (upload, SEG-53). Nunca aceitar o hash informado pelo cliente sem conferir. | MVP |
| INT-12 | Dois hashes por documento assinado pelo cliente: (a) `pdf_sha256` = hash do PDF **exibido e aceito** (sem a página de evidências); (b) `client_signed_pdf_sha256` = hash do PDF final **com** a página de evidências. A página de evidências imprime o hash (a), com a frase "Este é o resumo SHA-256 do documento aceito". O hash (b) não cabe dentro do próprio arquivo; fica no banco e na tela de verificação (INT-14). | MVP |
| INT-13 | Verificação periódica: job semanal recalcula o `sha256` de **todos os arquivos novos da semana** e de **1%** dos antigos (sorteio) e compara com o banco. Divergência = alerta PRI-1 (§6.4) [A VALIDAR: percentual]. | MVP |
| INT-14 | Tela pública "Verificar documento": recebe o código de verificação impresso no rodapé do PDF (aleatório, 128 bits) ou o upload do PDF, e mostra só tipo de documento, data de emissão/assinatura, hash e situação (vigente, substituído, assinado). Sem nome de pessoa nem dado do cliente. Rate limit de 30 por hora por IP (`rate_limit_counter`). | **MVP (decisões B7 a e R2 2.8 b):** o código de verificação (impresso no PDF, RN-187) **e** a tela pública mínima "Verificar documento" (04 TL-007). No MVP a consulta é **só pelo código**; o upload do PDF fica para depois. Limite de 30 por hora por IP adotado (AF-09) |

### 3.3 Trilha de auditoria imutável

#### 3.3.1 O que já existe (doc 03 §5.3)

- Trigger em todas as tabelas de negócio grava quem, quando, canal, tabela, registro, campos, valores antes e depois (DM-07).
- `audit_log` só aceita `INSERT`: trigger bloqueia `UPDATE`/`DELETE` e a aplicação não tem permissão (`REVOKE`).
- Colunas sensíveis mascaradas.

**Limite:** quem tem o usuário dono do banco (você, pelo painel do Supabase) consegue desligar o trigger e alterar o log. Para um sistema deste porte, a resposta proporcional é **detectar** alteração, não impedir.

#### 3.3.2 Selo diário (proposto)

| ID | Regra | Fase |
|---|---|---|
| INT-15 | Nova tabela `audit_seal` (`seal_date date PK`, `first_id`, `last_id`, `row_count`, `rows_sha256 char(64)`, `prev_seal_sha256 char(64)`, `seal_sha256 char(64)`, `created_at`). Também só de inclusão. | Depois (doc 03 E2) |
| INT-16 | Job diário (junto do J-01, 00:05 `America/Sao_Paulo`): pega as linhas de `audit_log` do dia anterior em ordem de `id`, calcula `rows_sha256` sobre a serialização canônica (JSON com chaves ordenadas), encadeia com o selo anterior (`seal_sha256 = sha256(prev_seal_sha256 ‖ rows_sha256 ‖ seal_date)`) e grava. | Depois (doc 03 E2) |
| INT-17 | O backup J-08 envia, além do dump, um arquivo `audit/{yyyy-mm-dd}.jsonl.age` com as linhas do dia e o selo, para um **prefixo travado** do R2 (bucket lock: impede apagar e sobrescrever pelo prazo definido). Retenção do travamento: **5 anos** (LG-12) [A VALIDAR]. | Depois (doc 03 E2) |
| INT-18 | Script `pnpm audit:verify --from --to` refaz os hashes a partir do banco e compara com `audit_seal` e com os arquivos do R2. Roda no teste de restauração trimestral (DSP-14). | Depois (doc 03 E2) |
| INT-19 | Encadeamento por linha (hash da linha anterior gravado em cada linha) | Não adotado: exige trava global em toda escrita. O selo diário dá a mesma detecção, sem custo nas transações. |

#### 3.3.3 Eventos de acesso (`security_event`)

O `audit_log` registra **mudança de dado**. "Quem viu o quê" e eventos de segurança ficam em tabela própria, só de inclusão, fora do trigger genérico.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `bigint` identity | PK |
| `occurred_at` | `timestamptz` | `DEFAULT now()` |
| `event_type` | `text` enum | `LOGIN_OK`, `LOGIN_FALHA`, `CONTA_BLOQUEADA`, `SENHA_ALTERADA`, `SENHA_REDEFINIDA`, `MFA_ATIVADO`, `MFA_REMOVIDO`, `SESSAO_REVOGADA`, `DOWNLOAD_ARQUIVO`, `ACESSO_NEGADO`, `EXPORT_TITULAR`, `CERTIFICADO_USADO`, `CERTIFICADO_ENVIADO` |
| `user_id` | `uuid` | Sem FK (como no `audit_log`). Nulo em falha de login de e-mail inexistente. |
| `email_hash` | `char(64)` | SHA-256 do e-mail tentado, para contar tentativas sem guardar o e-mail em claro |
| `ip_address` | `inet` | — |
| `user_agent` | `text` | — |
| `entity_type`, `entity_id` | `text`, `uuid` | Ex.: `stored_file` baixado |
| `request_id` | `uuid` | Liga ao log e ao `audit_log` |

Regras: `ACESSO_NEGADO` (404 por escopo, RN-162) gera evento; **3 ou mais** `ACESSO_NEGADO` do mesmo usuário `CLIENTE` em 10 minutos = alerta PRI-1 (possível tentativa de ver outro cliente, §6.4). Retenção LG-13.

#### 3.3.4 Hora oficial

- INT-20: toda data/hora de auditoria e assinatura vem de `now()` do banco (UTC). A hora do aparelho do técnico é guardada em coluna separada (`occurrence_record.device_updated_at`, `visit_equipment_note.device_updated_at`, `visit.device_started_at`, `photo.captured_at`, `visit_receipt.device_signed_at`; doc 03, AF-03) e nunca substitui a do servidor.

### 3.4 Versionamento do PMOC

As regras de versão estão no doc 03 §6.2 (VP-1 a VP-9) e no doc 02 (RN-126, RN-130, RN-131). O que este documento acrescenta:

| ID | Regra | Fase |
|---|---|---|
| INT-21 | Nova coluna `renderer_version` (`text`) em `pmoc_version`, `visit_report_version` e `pmoc_ficha_export`: guarda o `APP_VERSION` que gerou o PDF. Permite saber qual código produziu cada arquivo. | MVP |
| INT-22 | Regerar um PDF a partir do `snapshot` (por exemplo, para corrigir o layout) **cria arquivo novo** e nunca troca `pdf_file_id` de versão já assinada. Se a versão já foi assinada, o PDF assinado continua sendo o oficial. | MVP |
| INT-23 | Teste de reprodutibilidade (RNF-07): gerar duas vezes o PDF do mesmo `snapshot` com o mesmo `renderer_version` e comparar o **texto extraído**. O binário pode mudar (datas internas do PDF); o texto não. | MVP |
| INT-24 | Mudança no formato do `snapshot` sobe `snapshot_schema_version` (DM-20); o gerador de PDF mantém leitura das versões anteriores enquanto houver documento nelas. | MVP |
| INT-25 | Cada documento mostra no rodapé: versão (`v{n}`), data de geração, código `{TH}-{revisão}` quando houver (RNF-07) e o código de verificação (INT-14). | MVP, incluindo o código (decisões B7 e D6; RN-132, RN-187) |

---

## 4. Disponibilidade e continuidade

### 4.1 Metas (SLO) para este porte

Nem a Vercel Pro nem o Supabase Pro dão SLA de disponibilidade contratual (no Supabase, SLA só aparece no Enterprise; na Vercel, [A VALIDAR]). As metas abaixo são **objetivos internos**, não promessa ao cliente.

| ID | Meta | Valor | Como medir | Observação |
|---|---|---|---|---|
| DSP-01 | Disponibilidade mensal da web (login, painel ADM, portal) | **99,5%** (até ≈ 3 h 36 min fora do ar por mês) [A VALIDAR] | Better Stack em `/api/health/ready` (§6.5) | 99,9% exigiria redundância que não cabe no orçamento (TD-02). |
| DSP-02 | Disponibilidade da API de sincronização | **99,5%** | Mesmo monitor | Na prática o técnico não sente: o PWA trabalha offline e envia depois. |
| DSP-03 | RPO do banco (perda máxima de dados) | **24 h** (ARQ-08) | Idade do último backup bom | Sem PITR (TD-01). |
| DSP-04 | RPO dos arquivos (fotos, PDFs) | **24 h** para perda da conta; perto de zero para falha comum (o Storage não perde objeto por falha de disco) | Idade da última cópia no R2 | — |
| DSP-05 | RTO (tempo para voltar) | **4 h** (ARQ-08) para os cenários DR-1 a DR-4 da §4.3; **24 h** para perda total de conta (DR-5) [A VALIDAR] | Cronometrado no teste trimestral | — |
| DSP-06 | Job diário J-01 | Concluído até **06:00** `America/Sao_Paulo` | Heartbeat no Better Stack | Pendências e notificações do dia dependem dele. |
| DSP-07 | Geração de PDF | 95% dos relatórios em até **2 min** após o pedido; PMOC de 200 equipamentos em até **15 min** (decisão C4; na prática, dentro do limite de 800 s da função, medido no S-01: AF-11) | Duração da requisição (§6.2) | — |

### 4.2 Backups do PostgreSQL e dos arquivos

| Camada | Frequência | Retenção | Onde | Teste |
|---|---|---|---|---|
| 1. Backup automático do Supabase Pro | Diário | 7 dias | Supabase | Restaurar no teste semestral (DSP-15) |
| 2. `pg_dump` externo (J-08) | Diário, **02:00** `America/Sao_Paulo` (05:00 UTC) [A VALIDAR] | 30 diários + 12 mensais (ARQ-09) | Cloudflare R2, outra conta, cifrado com `age` | Restaurar no teste trimestral (DSP-14) |
| 3. Cópia dos objetos do Storage (J-08) | Diário, só objetos novos (os arquivos nunca mudam, RN-126) | Igual ao banco, com travamento (INT-17) | Cloudflare R2 | Conferir hashes de amostra (INT-13) |
| 4. Backup sob demanda antes de migração (MG-03) | A cada migração de produção | 30 dias | R2 | — |

Regras:

| ID | Regra |
|---|---|
| DSP-10 | `pg_dump --format=custom` pela **conexão direta** (não pelo pooler), com o usuário `backup_ro` (só leitura, `BYPASSRLS`, sem escrita). O dump inclui esquema, dados, funções, triggers e políticas RLS. |
| DSP-11 | Antes do envio: cifrar com `age` (chave pública), gravar `sha256` do arquivo cifrado num manifesto (`manifest/{data}.json`) junto. |
| DSP-12 | Bucket do R2 com **bucket lock**: prefixo `daily/` travado por 35 dias, `monthly/` por 400 dias, `audit/` por 5 anos (INT-17), `files/` por 400 dias [A VALIDAR]. Regra de ciclo de vida apaga depois do prazo. Motivo: mesmo com a conta Cloudflare invadida, o backup não pode ser apagado antes do prazo. |
| DSP-13 | O workflow do backup envia heartbeat ao Better Stack **só se** o upload e a conferência do manifesto deram certo. Sem heartbeat por 26 h = alerta PRI-1 (§6.4). |
| DSP-14 | **Teste de restauração trimestral** (RNF-13), seguindo `docs/runbooks/restaurar-backup.md`: baixar o dump mais recente do R2, decifrar, restaurar num Postgres local em Docker (mesma versão maior da produção), rodar as consultas de conferência (contagem por tabela, último `audit_log`, `pnpm audit:verify`), abrir 10 arquivos de amostra pelo hash e anotar o tempo total. Resultado registrado em `docs/runbooks/historico-testes.md`. |
| DSP-15 | Teste semestral da restauração **pelo painel do Supabase** num projeto novo temporário (custo de algumas horas de computação) [A VALIDAR: custo]. |
| DSP-16 | Tamanho estimado: banco < 2 GB no ano 3 (estimativa); arquivos ≈ 12 GB acumulados no ano 1 e ≈ 70 GB no fim do ano 3 (doc 05 §1.2, estimativa). Cabe nos 100 GB do Supabase Pro e custa poucos dólares no R2 (§7). |

### 4.3 Plano de recuperação de desastre

| ID | Cenário | Como percebe | O que fazer | RTO alvo | Perda |
|---|---|---|---|---|---|
| DR-1 | Deploy com erro | Sentry, Better Stack, reclamação | **Instant Rollback** da Vercel: no Pro, volta para qualquer deploy que já esteve em produção. Depois, "Undo Rollback" com a correção. | 15 min | Nenhuma |
| DR-2 | Migração estragou dados | Teste de fumaça falha, Sentry | Parar escrita (modo manutenção, DSP-21); corrigir com nova migração se possível; senão restaurar o backup sob demanda feito antes da migração (MG-03). | 4 h | Escritas entre o backup e a restauração |
| DR-3 | Dado apagado ou alterado por erro de uso ou bug | ADM avisa | Corrigir pelo `audit_log` (tem os valores anteriores). Restaurar backup **só** se o `audit_log` não bastar. | 4 h | Nenhuma, em geral |
| DR-4 | Supabase fora do ar (região) | Better Stack | Aguardar; o PWA continua offline; avisar os ADMs (modelo INC). Se passar de 4 h e não houver previsão: restaurar o dump do R2 num Postgres gerenciado em outra região (Supabase em outra região ou Neon) e apontar `DATABASE_URL` [A VALIDAR: ensaio]. | 4 h (decisão) / 24 h (migração) | Até 24 h |
| DR-5 | Conta Supabase ou Vercel perdida ou invadida | Login negado, cobrança, e-mail estranho | INC-07: recuperar a conta pelo suporte; em paralelo, subir novo projeto com o dump e os arquivos do R2. | 24 h | Até 24 h |
| DR-6 | Vercel fora do ar | Better Stack | Aguardar. Plano B documentado (não ensaiado): `next build` + contêiner num serviço como Render ou Fly.io (doc 05 §8.4). | Dependente do provedor | Nenhuma |
| DR-7 | Arquivo corrompido ou sumido no Storage | INT-13 ou erro ao baixar | Copiar do R2 pelo `storage_key` e conferir o `sha256`. | 1 h | Nenhuma |
| DR-8 | Chave privada do backup perdida | Teste trimestral | Gerar novo par de chaves e fazer backup completo na hora. Backups antigos ficam ilegíveis. | — | Histórico de backups |
| DR-9 | Certificado do RT comprometido | Aviso da AC, uso estranho em `security_event` | INC-06. | 1 dia útil | Nenhuma |

Limite que precisa ficar claro: registros que o técnico **já enviou e o servidor confirmou** saem do aparelho (OF-05). Se o banco for restaurado de um backup de até 24 h atrás, esses registros podem ser perdidos e a visita precisa ser relançada pelo ADM a partir do relatório em PDF, se houver (TD-04).

### 4.4 Janelas de manutenção

| ID | Regra |
|---|---|
| DSP-20 | Janela padrão: **domingo, 20:00 às 23:00** `America/Sao_Paulo` [A VALIDAR]. Usar para: migração com risco de trava, troca de tamanho de computação do Supabase (reinicia o banco), atualização de versão maior do Postgres. |
| DSP-21 | **Depois (decisão D7.7).** Modo manutenção: variável `MAINTENANCE_MODE=1` faz web e API de escrita responderem 503 com mensagem; o PWA guarda tudo na fila e tenta depois. Leitura continua quando possível. |
| DSP-22 | **Depois (decisão D7.7).** Aviso aos ADMs com 48 h de antecedência por notificação no app (RF-19). |
| DSP-23 | Deploys comuns (código sem migração de risco) **não** precisam de janela (§4.5). |

### 4.5 Deploy sem downtime

| ID | Regra |
|---|---|
| DSP-30 | Deploy na Vercel é atômico: a versão nova só recebe tráfego quando está pronta. |
| DSP-31 | **Skew Protection** ligada (Pro): o navegador que abriu a versão antiga continua falando com ela, inclusive nas Server Actions. Idade máxima: **7 dias** [A VALIDAR], dentro da retenção de deploys do projeto. O PWA não depende disso: usa `/api/sync/v1` versionado (doc 05 §7.4). |
| DSP-32 | Erro "Failed to find Server Action" (deploy novo trocou o ID da action) aparece como "O sistema foi atualizado. Recarregue a página." com botão de recarregar, nunca como erro genérico. |
| DSP-33 | Migrações no padrão expandir → migrar → contrair (MG-02). Ordem fixa: (1) backup sob demanda; (2) migração de **expansão**; (3) deploy do código que funciona com as duas formas; (4) migração de **contração** em outro dia, depois de no mínimo 7 dias (prazo do PWA offline, ARQ-02). Assim o rollback do código (DR-1) sempre funciona com o banco atual. |
| DSP-34 | Migração com `SET lock_timeout = '5s'` e `statement_timeout` alto só para ela; índice em tabela grande com `CREATE INDEX CONCURRENTLY` (migração separada, sem transação). |
| DSP-35 | Após cada deploy de produção, o CI roda teste de fumaça: `/api/health/ready` = 200, página de login carrega, login de um usuário de teste somente leitura [A VALIDAR: usuário de teste em produção]. Falha = alerta e rollback manual. |
| DSP-36 | Rolling Releases (liberar a versão nova aos poucos): **Depois**; não compensa com ≈ 200 usuários. |

---

## 5. Desempenho

### 5.1 Metas

| ID | O que | Meta | Medida |
|---|---|---|---|
| DES-01 | Telas comuns (ADM e portal) | Resposta do servidor p95 < **2 s** (decisão C5; a proposta original era 1 s); LCP p75 < **2,5 s** (limite "bom" do Core Web Vitals); INP p75 < **200 ms** | Speed Insights ou `web-vitals` (DES-40) |
| DES-02 | Listas do cliente grande (200 equipamentos) | Primeira página p95 < **2 s** (RNF-16, S-05) | `EXPLAIN ANALYZE` + E2E |
| DES-03 | PWA: ação do técnico (marcar OK/NOK, salvar medição) | < **100 ms** na tela (grava no IndexedDB, não espera rede) | Teste E2E com cronômetro |
| DES-04 | PWA: abrir o app sem rede | < **3 s** até a agenda aparecer | E2E com `setOffline(true)` |
| DES-05 | Sincronizar uma visita de 30 equipamentos sem fotos | < **30 s** em rede 3G simulada [A VALIDAR] | E2E com rede limitada |
| DES-06 | PDF do relatório | < **30 s** do clique até "pronto" | Duração da requisição (log/Sentry; PDF é síncrono, A2 a) |
| DES-07 | PDF do PMOC com 30 equipamentos | < **30 s** (RNF-16) | Duração da requisição |
| DES-08 | PDF do PMOC com 200 equipamentos | < **15 min**, na prática < 800 s (decisão C4; S-01; AF-11) | Duração da requisição |
| DES-09 | Texto da IA | Típico < **60 s**; máximo **300 s** (doc 05 §3.12) | Sentry (trace) |

### 5.2 Cache

| ID | Regra |
|---|---|
| DES-10 | **Regra de segurança antes de desempenho:** nenhum dado que dependa do usuário, do perfil ou do cliente entra em cache compartilhado do Next.js (`"use cache"`, cache de dados, ISR). Um cache compartilhado com dado de cliente é vazamento entre clientes (AM-01). No Next.js 16 o cache é opcional (as páginas são dinâmicas por padrão) [A VALIDAR: nomes exatos da API na 16.4]; manter assim. |
| DES-11 | Pode ir para cache compartilhado, com tag e invalidação na alteração (`updateTag`): biblioteca de tipos e atividades, dados da empresa executora e do RT (sem certificado), textos de aceite. |
| DES-12 | Dentro de uma requisição, usar `React.cache` para não repetir a leitura do usuário, do `ctx` e de permissões. |
| DES-13 | Arquivos estáticos (JS, CSS, fontes, ícones) ficam na CDN da Vercel com nomes versionados; o service worker do PWA guarda o app (doc 05 §6.2). |
| DES-14 | Banco: sem Redis. O próprio Postgres guarda em memória o que é usado com frequência; neste volume, isso basta. |
| DES-15 | Conexões: funções da Vercel usam o **pooler do Supabase em modo transação** (`prepare: false`, doc 05 §3.0); pg-boss, migrações e backup usam conexão direta. |

### 5.3 Índices

| ID | Regra |
|---|---|
| DES-20 | Os índices do doc 03 §5.2 são o ponto de partida. Toda chave estrangeira tem índice. |
| DES-21 | Toda coluna usada em política RLS tem índice (`client_id` desnormalizado, doc 05 §4.2 item 5). |
| DES-22 | Listas com paginação por cursor têm índice composto na ordem exata do `ORDER BY` + `id`, parcial `WHERE deleted_at IS NULL` quando a tabela tem exclusão lógica. |
| DES-23 | Extensão `pg_stat_statements` ligada (o Supabase oferece); revisar as 10 consultas mais lentas uma vez por mês (FIN-30). |
| DES-24 | Índice novo só com evidência (`EXPLAIN (ANALYZE, BUFFERS)` com o cliente grande do fixture, doc 05 §5). |

### 5.4 Paginação e consultas

| ID | Regra |
|---|---|
| DES-30 | Paginação no servidor, 25 itens (decisão C2), cursor nas listas grandes (doc 05 §3.8). |
| DES-31 | Não usar `COUNT(*)` em listas grandes; mostrar "mais de 1.000" quando passar disso [A VALIDAR]. |
| DES-32 | Selecionar só as colunas que a tela usa; nada de `SELECT *` em telas e APIs. |
| DES-33 | Sem N+1: carregar listas com junções ou consultas relacionais do Drizzle, nunca uma consulta por item num laço. Teste de integração conta as consultas de 3 telas críticas (lista de equipamentos, painel do ADM, agenda do técnico). |
| DES-34 | Limites no banco por usuário: `app_rw` com `statement_timeout = 10s` e `idle_in_transaction_session_timeout = 30s`; usuário dos jobs com `statement_timeout = 600s` [A VALIDAR]. |
| DES-35 | `pull` da sincronização devolve no máximo 500 linhas por chamada, com cursor. |

### 5.5 PDF sem travar a aplicação

| ID | Regra |
|---|---|
| DES-36 | PDF **síncrono** (decisão A2 a; doc 05 §3.6). A tela mostra "Gerando PDF…" até terminar. O texto original ("sempre em job", consulta a cada 5 s, notificação) não vale. |
| DES-37 | No máximo **2 PDFs** gerados ao mesmo tempo; relatórios têm prioridade sobre PMOC grande [A VALIDAR]. Motivo: cada geração de PMOC grande usa até 4 GB e lê muito do banco. |
| DES-38 | O gerador lê só o `snapshot` congelado (VP-3), nunca as tabelas vivas em laço. |
| DES-39 | PMOC grande gerado em partes (fichas em lotes de 100) e juntado antes de assinar, se o S-01 mostrar necessidade (doc 05 §3.6). |

### 5.6 Como medir

| ID | Ferramenta | O que mede | Fase |
|---|---|---|---|
| DES-40 | `web-vitals` enviando para o Sentry, ou Vercel Speed Insights [A VALIDAR: preço no Pro] | LCP, INP, CLS reais por página | MVP (o mais barato dos dois) |
| DES-41 | Sentry com amostragem de rastreamento de **10%** [A VALIDAR: cota do plano gratuito] | Tempo de rota, consultas lentas | MVP |
| DES-42 | Tabela `job_run` (§6.2) | Duração e falha de cada job | MVP |
| DES-43 | `pg_stat_statements` + painel do Supabase | Consultas lentas, CPU, memória, conexões | MVP |
| DES-44 | Teste de carga (k6) com 200 usuários simultâneos (doc 05 §3.11) contra staging | Capacidade | Antes do go-live (GL-27) |

---

## 6. Observabilidade

### 6.1 Logs estruturados

| ID | Regra |
|---|---|
| OBS-01 | Um logger JSON (LG-30) escrevendo na saída padrão; a Vercel coleta. Campos fixos: `ts`, `level`, `msg`, `requestId`, `userId`, `role`, `route`, `method`, `status`, `durationMs`, `appVersion`, `deploymentId`. Em jobs: `jobId`, `jobName`, `attempt`. |
| OBS-02 | `requestId` gerado no início da requisição (ou recebido do PWA), devolvido no cabeçalho `X-Request-Id`, gravado em `audit_log.request_id` e `security_event.request_id`. Liga log, erro no Sentry e auditoria. |
| OBS-03 | Níveis: `error` (precisa de ação), `warn` (anormal, sem ação imediata), `info` (eventos de negócio: PMOC emitido, visita finalizada, job concluído). Sem `debug` em produção. |
| OBS-04 | **Retenção:** a Vercel Pro guarda logs por **1 dia** (30 dias só com Observability Plus, pago). Por isso o histórico que importa fica fora do log: `audit_log`, `security_event`, `job_run` (banco) e erros no Sentry. Log da Vercel serve para investigar o que aconteceu hoje. |
| OBS-05 | Envio de logs para fora (Better Stack: grátis até 3 GB/mês com 3 dias de retenção; pacote pago a partir de US$ 25/mês no anual com 30 dias): **Depois** (gatilho em TD-05). |

### 6.2 Métricas

Sem ferramenta de métricas dedicada no MVP. As métricas vêm do banco e dos painéis dos provedores.

| ID | Métrica | Fonte |
|---|---|---|
| OBS-10 | Nova tabela `job_run` (`id`, `job_name`, `started_at`, `finished_at`, `status`, `attempt`, `error_code`, `duration_ms`, `items_processed`) gravada por todo job (J-01 a J-08 e PDFs). | Banco |
| OBS-11 | **Depois (decisão D7.6).** Tela **"Saúde do sistema"** só para ADM: último J-01 e J-08 (hora e situação), jobs na fila e com falha, PDFs aguardando, técnicos com envios pendentes há mais de 24 h (último contato de sincronização), `ACESSO_NEGADO` nas últimas 24 h, tamanho do banco e do Storage, data de validade do certificado do RT. | Banco |
| OBS-12 | Requisições, erros, duração e memória das funções | Painel Observability da Vercel |
| OBS-13 | CPU, memória, disco, conexões do banco | Painel do Supabase |

### 6.3 Rastreamento de erros (Sentry)

| ID | Regra |
|---|---|
| OBS-20 | `@sentry/nextjs` no servidor, no navegador e no PWA. `environment` (production, preview), `release = APP_VERSION`, mapas de código enviados no build e **não** publicados. |
| OBS-21 | 100% dos erros; 10% de rastreamento (DES-41); **sem** Session Replay (LG-07). |
| OBS-22 | Ignorar ruído que gasta cota: erros de rede do PWA offline (`TypeError: Failed to fetch` quando `navigator.onLine` é falso), extensões de navegador, `AbortError`. |
| OBS-23 | Erros de sincronização do PWA vão com código próprio (`SYNC-422`, `SYNC-409`, `SYNC-NET`) e `visitId`, sem conteúdo do registro. |
| OBS-24 | Erros de job vão com `jobName` e `jobId`; falha final (3ª tentativa) é `error`, tentativas intermediárias são `warn` sem envio ao Sentry. |

### 6.4 Alertas

Canais: **nenhum** (AF-15, 27/10/2026; OP-Q3 respondida em R2 2.11). **Não configurar** e-mail, Slack nem app de alerta; a coluna "Fonte" diz em que painel cada condição aparece, e a severidade só ordena o que o operador olha primeiro (doc 05 §7.6). Os jobs que detectam uma condição gravam `error` no Sentry e o resultado em `job_run`. Meta: menos de 1 alerta por semana em operação normal; alerta que dispara à toa é corrigido ou removido.

| ID | Severidade | Condição | Fonte | Ação |
|---|---|---|---|---|
| OBS-30 | **PRI-1** | Site fora do ar: `/api/health/ready` falhou 2 checagens seguidas | Better Stack | INC (§8.2); DR-1, DR-4, DR-6 |
| OBS-31 | **PRI-1** | Backup sem heartbeat por 26 h | Better Stack | Rodar o workflow J-08 à mão; ver log do GitHub Actions |
| OBS-32 | **PRI-1** | 3 ou mais `ACESSO_NEGADO` do mesmo `CLIENTE` em 10 min | Job a cada 10 min (dentro do J-07) → `error` no Sentry | INC-01 |
| OBS-33 | **PRI-1** | Divergência de hash (INT-13) ou de selo de auditoria (INT-18) | Job semanal → `error` no Sentry | INC-01/INC-07 |
| OBS-34 | **PRI-1** | Disco do banco acima de 85% | Supabase [A VALIDAR: alerta disponível no Pro] ou job diário lendo `pg_database_size` | Aumentar disco |
| OBS-35 | **PRI-2** | J-01 sem heartbeat até 06:00 | Better Stack | Rodar à mão; ver `job_run` |
| OBS-36 | **PRI-2** | Job com falha final (assinatura e jobs agendados; PDF é síncrono, A2 a) | Sentry + notificação ao ADM (doc 05 §3.9) | Ver erro, reprocessar |
| OBS-37 | **PRI-2** | Erro novo no Sentry ou mais de 20 ocorrências por hora do mesmo erro | Sentry | Corrigir ou silenciar com motivo |
| OBS-38 | **PRI-2** | Gasto: 75% e 100% do limite (§7.3) | Vercel, Supabase, Anthropic | FIN-20 |
| OBS-39 | **PRI-2** | Certificado do RT a vencer em 30 dias (RN-114) | Painel do ADM (RN-114, TL-100); sem e-mail (AF-15) | Renovar certificado |
| OBS-40 | **PRI-3** | Técnico com envio pendente há mais de 24 h (decisão C3; a tela "Saúde do sistema" é Depois, D7.6; o alerta aparece no painel do ADM, RF-28 item 8) | Painel do ADM (RF-28 item 8) | Ligar para o técnico |
| OBS-41 | **PRI-3** | Domínio ou cartão a vencer em 30 dias | Calendário (SPOF-03, SPOF-05) | Renovar |

### 6.5 Health checks

| ID | Endpoint | O que faz | Resposta |
|---|---|---|---|
| OBS-50 | `GET /api/health` | Só confirma que a função responde (não toca no banco) | `200 {"status":"ok","version":"x.y.z"}` |
| OBS-51 | `GET /api/health/ready` | `SELECT 1` com tempo máximo de 2 s + leitura de `job_run` para saber se o J-01 de hoje rodou | `200` se o banco responde; `503` se não. O detalhe do J-01 **não** aparece na resposta pública (só "degraded": true/false). |
| OBS-52 | Regras | Sem autenticação, sem dado pessoal, sem versão de dependências; rate limit pelo WAF (SEG-67); `Cache-Control: no-store`. | — |

Monitores no Better Stack (plano gratuito: 10 monitores e heartbeats, alerta por e-mail e Slack):

| # | Monitor | Tipo |
|---|---|---|
| 1 | `/login` contém o texto do título da página | Página |
| 2 | `/api/health/ready` | API |
| 3 | J-01 (diário) | Heartbeat |
| 4 | J-07 (processador da fila; envia a cada execução que termina sem erro) | Heartbeat [A VALIDAR: intervalo mínimo aceito] |
| 5 | J-08 (backup) | Heartbeat |
| 6 | Job semanal de integridade (INT-13) | Heartbeat |
| 7 | Validade do certificado TLS e do domínio | Página/SSL [A VALIDAR: disponível no gratuito] |
| 8 a 10 | Livres | — |

### 6.6 O que monitorar primeiro (ordem de implementação)

1. Sentry no servidor e no PWA (OBS-20).
2. Monitores 1 e 2 do Better Stack (site fora do ar).
3. Heartbeat do backup (monitor 5) e do J-01 (monitor 3).
4. `security_event` + alerta de `ACESSO_NEGADO` (OBS-32).
5. Limites e alertas de gasto (§7.3).
6. Tela "Saúde do sistema" (OBS-11).
7. Web Vitals (DES-40) e `pg_stat_statements` (DES-23).

---

## 7. Custos (FinOps)

### 7.1 Estimativa mensal por fase

Fases = cenários do doc 05 §8: **MVP** = ano 1; **Crescimento** = ano 3; **Escala** = pico (1,5 × ano 3). Valores em US$ (estimativa) e R$ (US$ 1 = R$ 5,0693).

| Item | MVP (US$) | Crescimento (US$) | Escala (US$) | Fonte do número |
|---|---|---|---|---|
| Vercel Pro (1 assento + uso) | 20,00 | 30,00 | 40,00 | Doc 05 §8.2 |
| Supabase Pro + computação | 30,00 (Pro 25 + Small 5) | 30,00 (Small) | 75,00 (Medium) | Doc 05 §8.2 |
| IA (Opus 5.5) | 16,80 | 50,40 | 75,60 | Doc 05 §3.12 |
| Cloudflare R2 (backup) | < 1,00 | ≈ 1,00 | ≈ 2,00 | 10 GB grátis; US$ 0,015/GB-mês depois (estimativa de volume na DSP-16) |
| Resend, Sentry, Better Stack, Slack | 0 | 0 | 0 | Planos gratuitos |
| **Total sem impostos** | **66,80 ≈ R$ 339** | **110,40 ≈ R$ 560** | **190,60 ≈ R$ 966** | Doc 05 §8.3 |
| Total com IA Sonnet 5.5 | 58,40 ≈ R$ 296 | 85,20 ≈ R$ 432 | 152,80 ≈ R$ 775 | Doc 05 §3.12 (metade do custo da IA) |
| Total com IOF de 3,5% [A VALIDAR: alíquota atual e forma de pagamento] | ≈ R$ 351 | ≈ R$ 580 | ≈ R$ 1.000 | ARQ-17 |
| Domínio | [A VALIDAR] | [A VALIDAR] | [A VALIDAR] | Não consultado |

Leitura: o **MVP cabe** no orçamento de R$ 300 a R$ 500. O **crescimento** só cabe com a IA Sonnet (≈ R$ 432, ou ≈ R$ 447 com IOF). A **escala** é teto de segurança, não gasto esperado.

### 7.2 Itens opcionais de robustez (não incluídos acima)

| Item | Custo mensal | O que compra | Vale quando |
|---|---|---|---|
| PITR do Supabase (7 dias) | US$ 100 ≈ R$ 507 | RPO de minutos em vez de 24 h | TD-01 |
| Better Stack (pacote de logs e alertas pago) | A partir de US$ 25 no anual (US$ 30 mensal) ≈ R$ 127 a 152 | Logs por 30 dias; ligação ou SMS [A VALIDAR: se inclui] | TD-05 |
| Sentry Team | US$ 29 ≈ R$ 147 | Mais cota de erros, mais usuários | Cota gratuita estourar 2 meses seguidos |
| Vercel Observability Plus | [A VALIDAR: preço] | Logs da Vercel por 30 dias | Alternativa ao Better Stack em TD-05 |
| Supabase Medium em vez de Small | ≈ US$ 45 a mais ≈ R$ 228 | Mais CPU e memória do banco | CPU do banco > 70% em horário comercial por 2 semanas |
| Staging pago no Supabase | ≈ R$ 50 a 100 [A VALIDAR] | Staging que não pausa | Mais de uma pessoa desenvolvendo |
| Carimbo do tempo ICP-Brasil | [A VALIDAR: por carimbo] | Data comprovada da assinatura do RT | TD-06 |
| e-CNPJ para lacre | [A VALIDAR: anual] | INT-10 | TD-07 |
| Supabase Team | US$ 599 ≈ R$ 3.037 | Relatório SOC 2 e recursos de equipe | **Não** se justifica neste porte |

### 7.3 Principais vilões de custo

| ID | Vilão | Por que pode estourar | Controle |
|---|---|---|---|
| FIN-01 | **IA** | É o maior custo variável (doc 05 §8.3); regeração repetida, prompt grande, modelo caro | SEG-65 (limite de gerações); enviar só dados da visita; comparar Opus e Sonnet (ARQ-11); limite de gasto na Anthropic (FIN-12) |
| FIN-02 | Funções longas na Vercel | PDF grande com 4 GB por até 800 s | Só 2 PDFs simultâneos (DES-37); geração em partes; S-01 mede o custo real |
| FIN-03 | Processador da fila (J-07) | Se ficar esperando até 700 s a cada minuto, vira função ligada 24 h | FIN-08 |
| FIN-04 | Crescimento do Storage | Fotos (≈ 1 a 3 GB/mês) e PDFs grandes com várias versões | Compressão no aparelho (doc 05 §6.7); 100 GB incluídos; alerta em 80 GB (FIN-14) |
| FIN-05 | Tráfego de saída (egress) | Download de fotos e PDFs grandes, PMOC baixado offline pelo técnico | URLs assinadas curtas; PMOC offline só sob demanda (ARQ-05); cota do Supabase [A VALIDAR: GB incluídos no Pro] |
| FIN-06 | Otimização de imagem da Vercel | Cobrança por imagem transformada | FIN-09 |
| FIN-07 | Cota do Sentry | Pico de erros de rede do PWA | OBS-22 e proteção contra picos do próprio Sentry |

Regras:
- FIN-08: J-07 busca jobs; **se a fila estiver vazia, termina na hora**; com jobs, processa até 700 s e termina (ver "Mudanças propostas").
- FIN-09: fotos e PDFs **não** usam `next/image` nem o otimizador da Vercel; a miniatura é gerada no aparelho (doc 05 §6.7).

### 7.4 Limites e alertas de gasto

| ID | Onde | Configuração | Motivo |
|---|---|---|---|
| FIN-10 | **Vercel** – Spend Management | Orçamento sob demanda de **US$ 20** além do crédito mensal do Pro; notificações em 50%, 75% e 100% (e-mail, e SMS em 100%). **"Pausar deploys de produção" desligado** no MVP. | Pausar tira o sistema do ar para todos (erro 503). Prefiro receber o aviso e decidir. A checagem da Vercel tem atraso de alguns minutos. |
| FIN-11 | **Supabase** – limite de gasto (spend cap) | Manter **ligado** (padrão do Pro) no MVP. Desligar quando o uso passar de 80% de alguma cota incluída, para não bloquear o serviço [A VALIDAR: o que exatamente é bloqueado com o limite ligado e se a computação Small entra no limite]. | Evita surpresa na fatura enquanto o volume é pequeno. |
| FIN-12 | **Anthropic** – limite mensal do espaço de trabalho | Limite de **US$ 40** no ano 1 e **US$ 80** no ano 3 [A VALIDAR: recurso no Console], com alerta em 75%. Ao estourar, a IA falha e o técnico escreve o texto à mão (RNF-10.4). | Protege contra laço de regeração ou abuso. |
| FIN-13 | Resend | Alerta ao chegar a 80 e-mails num dia (limite gratuito: 100/dia) | Evita perder e-mail de senha |
| FIN-14 | Storage | Job diário lê o tamanho do bucket; e-mail ao passar de 80 GB | 100 GB incluídos no Pro |
| FIN-15 | Cartão | Cartão (de preferência virtual) só para estes serviços, com limite mensal de R$ 800 [A VALIDAR] | Teto final de proteção; alerta de cobrança recusada no e-mail de dois responsáveis (SPOF-03) |

### 7.5 Revisão mensal (15 minutos)

| ID | Item |
|---|---|
| FIN-20 | Faturas do mês de cada serviço numa planilha (US$, R$, IOF). |
| FIN-21 | Comparar com a tabela da §7.1; diferença acima de 20% = descobrir o motivo. |
| FIN-22 | Custo de IA por relatório (gasto ÷ relatórios do mês). Acima de US$ 0,06 [A VALIDAR] = revisar prompt ou modelo. |
| FIN-23 | Tamanho do Storage e do banco; crescimento mensal. |
| FIN-30 | 10 consultas mais lentas (DES-23). |

### 7.6 Quando vale pagar por mais robustez

| Gatilho | O que contratar |
|---|---|
| Uma perda real de dados ou um cliente exigir RPO menor que 24 h em contrato | PITR (TD-01) |
| Precisou investigar um incidente e o log de 1 dia não bastou (uma vez já conta) | Logs externos (TD-05) |
| Receita com o sistema permite e a orçamento passa de R$ 700/mês | PITR primeiro, depois logs |
| Fiscalização ou cliente contestar data de assinatura do RT | Carimbo do tempo (TD-06) |
| Segunda pessoa passa a operar | Staging pago, cofre de segredos (SEG-76), plano de alertas com escala |

---

## 8. Go-live e incidentes

### 8.1 Checklist de go-live

**B** = bloqueante (não entra em produção sem isso). **D** = desejável (pode entrar nas 4 semanas seguintes).

| ID | Item | Tipo | Como verificar |
|---|---|---|---|
| GL-01 | Testes de isolamento entre clientes passando para todas as rotas (SEG-25, ADR-05) | **B** | CI verde; lista de rotas sem exceção |
| GL-02 | RLS ligado e testado nas tabelas do portal; `app_rw` sem `BYPASSRLS` e sem ser dono | **B** | Teste de integração + `\dp` no banco |
| GL-03 | API REST automática do Supabase desligada ou sem acesso para `anon`/`authenticated`; bucket privado | **B** | Chamar a API com a chave pública e receber erro |
| GL-04 | No mínimo 2 ADMs ativos (SEG-17) **e** MFA ativo em todos os ADMs (R2 1.2 b) | **B** | Tela de usuários |
| GL-05 | MFA em todas as contas de provedor (SEG-73) | **B** | Lista conferida |
| GL-06 | Bloqueio por tentativas e rate limit de login e recuperação (SEG-07, SEG-60, SEG-61) | **B** | Teste E2E |
| GL-07 | Sessão configurada (SEG-10) e revogação funcionando (S-04) | **B** | Teste E2E |
| GL-08 | Cabeçalhos de segurança, CSP ativa (não só report-only) (SEG-40 a SEG-49) | **B** | Teste E2E de cabeçalhos |
| GL-09 | Nenhum segredo no repositório; secret scanning e push protection ligados (SEG-70) | **B** | Painel do GitHub |
| GL-10 | Variáveis de produção separadas do preview (SEG-72) | **B** | Painel da Vercel |
| GL-11 | `pnpm audit` sem alta/crítica em produção (SEG-84) | **B** | CI |
| GL-12 | Backup externo diário rodando há pelo menos 7 dias, com heartbeat (DSP-10 a DSP-13) | **B** | R2 + Better Stack |
| GL-13 | Um teste de restauração completo feito e cronometrado (DSP-14) | **B** | `historico-testes.md` |
| GL-14 | Chave privada do backup e `CERT_ENCRYPTION_KEY` guardadas no gerenciador de senhas com acesso de emergência (SPOF-01, SPOF-07) | **B** | Conferência manual |
| GL-15 | Sentry recebendo erros do servidor e do PWA, sem dados pessoais (OBS-20, LG-07) | **B** | Erro de teste |
| GL-16 | Monitores 1, 2, 3 e 5 do Better Stack ativos (§6.5) | **B** | Painel |
| GL-17 | Limites de gasto configurados (FIN-10 a FIN-12) | **B** | Painéis |
| GL-18 | Assinatura do RT validada no verificador oficial (S-02, INT-05) | **B** | Relatório do validador |
| GL-19 | `audit_log` imutável testado (UPDATE/DELETE falham) e `security_event` gravando (SEG-09) | **B** | Teste de integração |
| GL-20 | Logs sem senha, token ou e-mail (LG-34) | **B** | Teste automático |
| GL-21 | PWA: perda de rede durante visita sem perda de dado (S-06), ~~apagamento remoto ao revogar sessão (SD-04)~~ (Depois, D7.1) | **B** | E2E + teste manual num iPhone e num Android |
| GL-22 | Runbooks escritos: rollback, restaurar backup, acesso de emergência, trocar certificado, rotacionar segredos, incidente (doc 05 SPOF-02) | **B** | Arquivos em `docs/runbooks/` |
| GL-23 | PDF de PMOC de 200 equipamentos gerado dentro da meta (S-01, DES-08) | **B** | Duração da requisição |
| GL-30 | Política de privacidade e termo de uso publicados; canal do titular (LG-50, LG-51) | **B** | Link no login [texto: A VALIDAR – advogado] |
| GL-31 | Cláusula de aceite de assinatura eletrônica e de proteção de dados no contrato com os clientes (ARQ-14, LG-54) | **B** | Contrato modelo [A VALIDAR – advogado] |
| GL-24 | Selo diário de auditoria e cópia travada no R2 (INT-15 a INT-17) | D | Arquivo do dia no R2 |
| GL-25 | Tela "Saúde do sistema" (OBS-11) | D | Tela |
| GL-26 | Web Vitals medidos (DES-40) | D | Painel |
| GL-27 | Teste de carga com 200 usuários (DES-44) | D | Relatório k6. Bloqueante só se o ano 1 começar com mais de 60 simultâneos. |
| GL-28 | Verificação semanal de hash (INT-13) | D | Heartbeat |
| GL-29 | Registro das operações de tratamento (LG-52) e definição do encarregado (LG-53) | D | Documento [A VALIDAR – advogado] |
| GL-32 | Ensaio do cenário DR-4 (restaurar em outra região) | D | Registro do ensaio |

### 8.2 Plano de resposta a incidentes (1 página)

**Papéis:** você = responsável pelo incidente (decide e executa). ADM de contato na empresa = avisa os técnicos e clientes. Advogado ou encarregado = decide comunicação à ANPD.

**Severidade**

| Nível | Exemplos | Começar em |
|---|---|---|
| PRI-1 | Sistema fora do ar; suspeita de vazamento entre clientes; conta de provedor ou de ADM invadida; segredo vazado; backup parado há 2 dias | Imediato |
| PRI-2 | Job crítico falhando; PDFs não saem; erro afetando um perfil inteiro | Mesmo dia |
| PRI-3 | Erro isolado; lentidão | Próximo dia útil |

**Passos (todo incidente)**

| # | Passo | O que fazer |
|---|---|---|
| 1 | Registrar | Abrir `docs/incidentes/{aaaa-mm-dd}-{titulo}.md` com hora de início, sintoma, quem avisou. Anotar tudo com horário. |
| 2 | Conter | Parar o dano primeiro: rollback (DR-1), modo manutenção (DSP-21), revogar sessões, inativar usuário, rotacionar segredo. |
| 3 | Comunicar | PRI-1: avisar o ADM de contato em até 1 h com o modelo abaixo. Atualizar a cada 2 h até resolver. |
| 4 | Avaliar dados pessoais | Houve acesso, perda ou alteração de dado pessoal? Se sim, acionar o advogado/encarregado **no mesmo dia**. Prazo da ANPD: **3 dias úteis** a partir de saber do incidente, quando houver risco ou dano relevante (6 dias úteis se OP-Q1 = Sim) [A VALIDAR – advogado]. |
| 5 | Corrigir | Causa raiz, correção, teste que reproduz o problema. |
| 6 | Encerrar | Registro final em até 5 dias úteis: linha do tempo, causa, impacto (quais clientes, quais dados), o que muda. Guardar por **5 anos** (Resolução CD/ANPD nº 15/2024). |

**Modelo de aviso ao ADM:** "Detectamos {sintoma} às {hora}. Impacto: {quem é afetado}. Os técnicos podem continuar trabalhando offline; nada registrado no celular se perde. Próxima atualização às {hora}."

**Roteiros por tipo**

| ID | Incidente | Conter | Depois |
|---|---|---|---|
| INC-01 | Suspeita de vazamento entre clientes (OBS-32, relato de cliente) | Inativar o usuário envolvido; se for bug, modo manutenção do portal (`PORTAL_DISABLED=1`) | Consultar `security_event` e `audit_log` pelo `request_id`; listar o que foi visto; passo 4 |
| INC-02 | Conta de ADM comprometida | Inativar o usuário (revoga sessões); outro ADM redefine senha e MFA | Revisar `audit_log` do usuário desde o último acesso legítimo; reverter alterações; se o certificado foi usado, ver INC-06 |
| INC-03 | Celular de técnico perdido ou roubado | Revogar sessões do técnico (SEG-14) | Ver o que estava pendente de envio; passo 4 se havia dado de cliente sem envio |
| INC-04 | Sistema fora do ar | Ver Better Stack, status da Vercel e do Supabase; rollback se começou após deploy | DR-1, DR-4, DR-6 |
| INC-05 | Segredo vazado | Rotacionar nesta ordem: o que vazou → `AUTH_SECRET` (se suspeita ampla) → banco → Storage → demais; redeploy | Varredura do repositório e dos logs; remover do histórico do git |
| INC-06 | Certificado do RT comprometido | Pedir revogação à AC; desativar o certificado no sistema (bloqueia emissão); rotacionar `CERT_ENCRYPTION_KEY` | Novo certificado; reemitir PMOCs assinados depois da data do comprometimento [A VALIDAR – advogado] |
| INC-07 | Conta de provedor invadida ou perdida | Trocar senha e MFA, revogar tokens e chaves de API daquela conta; contatar o suporte | DR-5; conferir backups travados no R2 |
| INC-08 | Backup parado | Rodar J-08 à mão; ver erro no GitHub Actions | Se passou de 24 h, fazer backup sob demanda pelo painel do Supabase também |

---

## 9. Trade-offs: riscos aceitos no MVP

| ID | O que estou aceitando | Por que é aceitável agora | Controle que compensa | Quando pagar a dívida | Custo de pagar |
|---|---|---|---|---|---|
| TD-01 | **Sem PITR**: até 24 h de dados perdidos num desastre do banco | Volume pequeno; o técnico guarda o registro no aparelho até o envio; PITR custa mais que o orçamento | Backup diário duplo (Supabase + R2), backup antes de migração | Perda real, exigência contratual ou orçamento > R$ 700/mês | US$ 100/mês ≈ R$ 507 |
| TD-02 | **Disponibilidade 99,5%**, sem SLA contratual de nenhum provedor | Uso em horário comercial; o PWA continua offline | Monitoramento, rollback em minutos, plano DR-4 | Cliente exigir SLA em contrato | Plano superior de provedor ou segunda região: alto [A VALIDAR] |
| TD-03 | **RLS só para `CLIENTE`**, não para `TECNICO` | O técnico é empregado da empresa; regras dele são difíceis de expressar em SQL | Autorização no serviço + testes de isolamento do técnico | Técnico terceirizado ou incidente de acesso indevido | Semanas de trabalho (doc 05 §4.1, opção C) |
| TD-04 | Registro já confirmado sai do aparelho; restauração de backup pode perdê-lo | Cenário raro (DR-2, DR-4, DR-5) | Relatório em PDF gerado logo após o envio; ADM relança | Se acontecer uma vez | Manter cópia local dos registros confirmados por 7 dias: pouco código, mais espaço no aparelho |
| TD-05 | **Logs só por 1 dia** (Vercel Pro) | O que importa a longo prazo está no banco e no Sentry | `audit_log`, `security_event`, `job_run`, Sentry | Primeira investigação que precisou de log mais antigo | ≈ US$ 25 a 30/mês (Better Stack) |
| TD-06 | **Assinatura do RT sem carimbo do tempo** | A assinatura é válida; o risco é provar a data depois que o certificado vencer | Data no `audit_log` selado (INT-15) e na cópia travada | Contestação de data ou exigência de fiscalização | Custo por carimbo [A VALIDAR] |
| TD-07 | **Assinatura do cliente eletrônica simples** | Custo zero; aceite contratual (ARQ-14) | Evidências RN-125, hash, auditoria selada | Contestação de assinatura ou exigência de cliente | Serviço de assinatura avançada por envelope [A VALIDAR] |
| TD-08 | **Uma pessoa opera tudo** | Não há equipe | Runbooks, acesso de emergência, alertas automáticos (doc 05 §10.2) | Mais de 300 clientes ou receita que pague uma segunda pessoa | Contrato de suporte com terceiro [A VALIDAR] |
| TD-09 | **PWA sem cofre seguro** do aparelho; iOS não envia com o app fechado | Requisito é registrar offline e enviar depois | PIN, cifra local, apagamento remoto, aviso de pendência (doc 05 §6.6) | Gatilhos do doc 05 §6.11 | Migrar para Capacitor |
| TD-10 | **IA processa fora do Brasil** | Sem opção no Brasil; dados enviados sem identificação de pessoas | RN-172, cláusulas-padrão (LG-40) | Exigência legal de dados no Brasil (ARQ-12) | Trocar fornecedor de IA |
| TD-11 | **Sem antivírus em upload** e **sem pentest externo** | Arquivos vêm do próprio app ou do ADM; superfície pequena | SEG-50 a SEG-56, OWASP no CI | Cliente enviar arquivo; mais de 300 clientes; exigência contratual | Pentest: [A VALIDAR]; antivírus: serviço por arquivo |
| TD-12 | **Staging no plano gratuito** (pausa sem uso) | Uma pessoa desenvolvendo | Preview por PR + testes com Postgres em contêiner | Segunda pessoa | ≈ R$ 50 a 100/mês [A VALIDAR] |
| TD-13 | **Sem ligação e sem alerta por e-mail/Slack** (OP-Q3 respondida em R2 2.11; sem alerta ativo, só painéis: AF-15) | Sistema não é de missão crítica fora do horário comercial | Monitores e heartbeats | Um PRI-1 que ficou mais de 4 h sem ser visto | Plano pago de alertas [A VALIDAR] |
| TD-14 | **Sem encarregado formal** se OP-Q1 = Sim | Dispensa da Resolução CD/ANPD nº 2/2022 | Canal do titular (LG-25) | Deixar de ser pequeno porte ou tratar dado de alto risco | Encarregado terceirizado [A VALIDAR] |
| TD-15 | **Fornecedores sem relatório SOC 2 disponível** no plano contratado (Supabase só fornece no Team) | O custo do Team (US$ 599) é desproporcional | Segurança publicada pelo fornecedor (AES-256, SOC 2 Type 2 da empresa) | Cliente exigir evidência formal de fornecedor | Upgrade de plano |

---

## 10. Itens [A VALIDAR] deste documento

| ID | Item | Proposta adotada | Quem valida |
|---|---|---|---|
| OP-Q1 | Empresa é ME/EPP | Não sei (prazos normais) | Usuário |
| OP-Q2 | Retenção de documentos | 5 anos após o fim do contrato | Usuário + advogado |
| OP-Q3 | Alertas sem ligação nem e-mail/Slack | Respondida (R2 2.11); sem alerta ativo, só painéis (AF-15) | Usuário (respondida) |
| SEG-01 | Senha mínima | **8** (decisão B6; abaixo do NIST para quem não usa MFA, risco aceito com SEG-02 e SEG-07: AF-19) | Usuário (respondida) |
| SEG-10 | Sessão web 12 h sem uso, 7 dias no máximo | Sim | Usuário (respondida, AF-08) |
| SEG-15 | Validade dos links (72 h e 30 min) | Sim | Usuário |
| SEG-52 | Tamanhos máximos de upload | 10 MB, 2 MB, 50 MB, 50 KB | Usuário |
| SEG-65 | Limites de geração de IA | 3 por versão, 30 por dia | Usuário |
| SEG-85 | Prazos de correção de segurança | 24 h, 7 dias, mensal | Usuário |
| §2 inteira | Papéis, bases legais, prazos, transferência internacional, textos | Como na §2 | **Advogado** |
| DSP-01 | Disponibilidade 99,5% | Sim | Usuário |
| DSP-05 | RTO de 24 h para perda total de conta | Sim | Usuário |
| DSP-20 | Janela de manutenção domingo 20h–23h | Sim | Usuário |
| DSP-31 | Idade máxima da Skew Protection | 7 dias | Implementação |
| INT-04/05 | Perfil PAdES e validador oficial | AD-RB, verificador do ITI | Spike S-02 |
| INT-14 | Tela pública de verificação | MVP (R2 2.8 b); só pelo código; limite de 30/h por IP adotado (AF-09) | Usuário (respondida) |
| FIN-10 a FIN-12 | Valores dos limites de gasto | US$ 20 / spend cap ligado / US$ 40 | Usuário |
| FIN-11 | Comportamento do spend cap do Supabase | Ligado no MVP | Implementação (ler documentação) |
| §7.1 | IOF de 3,5% | Somado à parte | Contador |

---

## 11. Fontes (consultadas em 17/10/2026)

| Tema | Fonte |
|---|---|
| OWASP Top 10 2025 (A01 a A10) | [orca.security – OWASP Top 10 2025 key changes](https://orca.security/resources/blog/owasp-top-10-2025-key-changes/) (20/11/2025) e [GitLab – 2025 OWASP Top 10](https://about.gitlab.com/blog/2025-owasp-top-10-whats-changed-and-why-it-matters/) |
| Segurança das Server Actions (checagem de Origin, limite de 1 MB, IDs cifrados, autorização dentro da action) | [nextjs.org/docs/app/guides/server-actions](https://nextjs.org/docs/app/guides/server-actions) (atualizada em 15/10/2026) |
| CVE-2026-27978 (origem `null` em Server Actions, corrigida na 16.1.7) | [cvelogic.com – CVE-2026-27978](https://www.cvelogic.com/cve/CVE-2026-27978) |
| CVE-2025-55182 (React2Shell) | [Bitsight – React2Shell](https://www.bitsight.com/blog/security-alert-cve-2025-66478-cve-2025-55182-react2shell-nextjs-react-server-components-remote) e [Kudelski Security](https://kudelskisecurity.com/research/critical-security-vulnerability-in-react-server-components) |
| CVE-2025-29927 (desvio do middleware do Next.js, março de 2025) | Conhecimento técnico; conferir no aviso oficial do Next.js [A VALIDAR: fonte não consultada nesta rodada] |
| Better Auth: scrypt, rate limit, CSRF, cookie, IP | [better-auth.com/docs/reference/security](https://better-auth.com/docs/reference/security.md) |
| NIST SP 800-63B-4 (senhas) | [sakimura.org – resumo do SP 800-63B-4](https://www.sakimura.org/en/2025/10/7710/); texto oficial em pages.nist.gov/800-63-4 [A VALIDAR: conferir no original] |
| Vercel WAF Rate Limiting (40 regras no Pro, janela 10 s–10 min, IP/JA4) | [vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) |
| Vercel Spend Management (50/75/100%, pausa opcional, atraso de minutos) | [vercel.com/docs/spend-management](https://vercel.com/docs/spend-management) |
| Retenção de logs da Vercel (Pro: 1 dia; Observability Plus: 30 dias) | [vercel.com/docs/logs/runtime](https://vercel.com/docs/observability/runtime-logs) |
| Instant Rollback (Pro: qualquer deploy que esteve em produção) | [vercel.com/docs/instant-rollback](https://vercel.com/docs/instant-rollback) |
| Skew Protection (Pro e Enterprise; padrão 1 dia) | [vercel.com/docs/skew-protection](https://vercel.com/docs/skew-protection) |
| Supabase: AES-256 em repouso, TLS, SOC 2 Type 2, backups diários | [supabase.com/security](https://supabase.com/security) |
| Supabase Pro: spend cap padrão, backups 7 dias, PITR US$ 100, logs 7 dias, SLA só no Enterprise, Team US$ 599 | [supabase.com/pricing](https://supabase.com/pricing) |
| Cloudflare R2 bucket locks | [developers.cloudflare.com/r2/buckets/bucket-locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/) |
| Better Stack (gratuito: 10 monitores, 3 GB de logs por 3 dias; pacote Nano) | [betterstack.com/pricing](https://betterstack.com/pricing) |
| Resolução CD/ANPD nº 15/2024 (incidentes: 3 dias úteis, registro por 5 anos, prazo em dobro para pequeno porte) | [Cescon Barrieu](https://cesconbarrieu.com.br/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca/) |
| Resolução CD/ANPD nº 2/2022 (agentes de pequeno porte) | [Felsberg Advogados](https://www.felsberg.com.br/no-dia-internacional-da-protecao-de-dados-anpd-publica-nova-resolucao-que-regulamenta-a-aplicacao-da-lgpd-para-agentes-de-tratamento-de-pequeno-porte/) |
| Resoluções CD/ANPD nº 19/2024 e nº 32/2026 (transferência internacional, adequação com a UE) | [Confidata – atualização ANPD 2026](https://confidata.com.br/blog/transferencia-internacional-dados-atualizacao-anpd-2026) (fonte secundária) e [Lefosse – prazo das cláusulas-padrão](https://lefosse.com/noticias/transferencia-internacional-de-dados-prazo-para-adocao-das-clausulas-padrao-da-anpd-se-encerra-em-23-de-agosto/) |
| LGPD (arts. 7º, 9º, 16, 18, 19, 37, 41) e Marco Civil (art. 15) | Lei 13.709/2018 e Lei 12.965/2014, conhecimento técnico [A VALIDAR – advogado: conferir texto vigente no planalto.gov.br] |
| MP 2.200-2/2001 (art. 10) | Já citada no doc 05 §11 |
| Preços de Vercel, Supabase, IA, R2, Sentry, Resend e cotação do dólar | Doc 05 §11 |
