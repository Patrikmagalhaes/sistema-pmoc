# 08 – Front-end: UX/UI e Design System

> **Versão:** 1.0 – 12/11/2026 · Documento único (seções 1 a 10).
> **Base:** `docs/00-escopo-prd.md`, `docs/02-regras-de-negocio.md`, `docs/03-modelo-de-dados.md`, `docs/04-fluxos-e-telas.md`, `docs/05-stack-e-arquitetura.md`, `docs/glossario.md`.
> **Leitor principal:** IA de código. Texto em tabelas e listas; cada decisão vira código sem pergunta extra.
> **Prioridade em conflito:** docs 00, 02 e 03 > doc 04 > este documento. Este documento **não cria** regra de negócio, entidade, perfil, tela ou estado. Se precisar de algo que não está nos docs 00–07, pare e pergunte.

## Convenções

| Item | Significado |
|---|---|
| **[A VALIDAR]** | Não veio dos docs nem do Patrik. Implementar como descrito, isolado em token/configuração, fácil de trocar. |
| **(decisão 12/11/2026)** | Resposta do Patrik nesta rodada: biblioteca de UI proposta aceita (Tailwind CSS 4 + shadcn/ui + lucide-react); paleta azul neutra aceita; fonte Inter (sem fonte obrigatória); **sem modo escuro**; técnico usa **só celular**, mas as telas devem ser responsivas. |
| Nomes de domínio | Os do glossário. Um termo = um nome em toda a interface (ver §6). |
| IDs | `TL-xxx` tela, `FL-xx` fluxo, `UF/UL/PW-xx` padrões do doc 04 §1, `RN/RF/CA/RNF` do PRD e doc 02. Este documento usa `FE-xx` para suas próprias regras. |
| Código | Tokens em CSS (`@theme` do Tailwind 4) e componentes React 19 + TypeScript. Nomes de arquivo e variável em inglês `kebab-case`/`camelCase`; **texto exibido em português** (§10). |

### Ajustes de vocabulário em relação ao pedido original

| No pedido | Neste sistema | Fonte |
|---|---|---|
| "Ordem de serviço (OS)" | **Visita** (OS = visita). Não existe tela nem componente "OS". | D-01, doc 04 |
| "Gestor no desktop" | **`ADM`**. Não existe perfil "gestor". | PRD §3.1 |
| "Em dia / a vencer / vencido" para PMOC ou equipamento | **Não existe** esse estado. Estados reais: §2.3. "A vencer/Vencido" existe só para **certificado do RT** (`A_VENCER`, `VENCIDO`) e "contratos a vencer em até 30 dias" (RN-113). | doc 04 §1.5, RN-113, RN-114 |
| "Em execução / concluído / cancelado" | `EM_ANDAMENTO` "Em andamento" · `REGISTRADA` "Registrada" · `CANCELADA` "Cancelada". | doc 04 §1.5 |
| "Laudo" | **Relatório da visita** (`visit_report`). Não use "laudo". | glossário |

---

## 1. Visão geral e princípios de design

### 1.1 Natureza do produto

Ferramenta de trabalho de uma única empresa executora (DEC-34). Cobre o ciclo do PMOC: cadastros → contrato → plano e cronograma → emissão do PMOC (PDF assinado) → visitas → execução no celular → relatório com IA → assinatura do cliente. Sem marketing, sem animação decorativa, sem telas "de vitrine".

### 1.2 Princípios (FE-P1 a FE-P7)

Em dúvida de design, aplique na ordem. O primeiro princípio que decide, vence.

| ID | Princípio | Regra concreta neste sistema |
|---|---|---|
| FE-P1 | **Um problema, uma solução visual.** | Mesmo estado → mesmo `StatusBadge` (§2.3). Mesma ação → mesmo botão, mesmo verbo, mesma posição. Proibido criar variação nova (§10). |
| FE-P2 | **O estado atual é sempre visível.** | Toda visita, PMOC, relatório, contrato e certificado mostra seu estado com texto + ícone + cor, no topo da tela e em toda linha de lista. Sincronização do PWA sempre visível (PW-03). |
| FE-P3 | **Mostrar o que fazer agora.** | Cada tela tem **uma** ação primária visível. O `ADM` abre no Painel de pendências (TL-100); o técnico abre em Minhas visitas (TL-200); o cliente abre em Início (TL-300). |
| FE-P4 | **Celular primeiro no campo; desktop primeiro na administração.** | Telas `TL-2xx`: desenhar a 360 px de largura e depois ampliar. Telas `TL-1xx`: desenhar a 1280 px e garantir que funcionem a 360 px. Telas `TL-3xx`: responsivas, sem prioridade de um lado. |
| FE-P5 | **Nunca perder trabalho.** | No PWA, tudo é salvo no aparelho a cada alteração (PW-01). Na web, aviso ao sair com alteração não salva (UF-08). Erro nunca apaga o que o usuário digitou. |
| FE-P6 | **Confirmar só o que não se desfaz.** | Diálogo de confirmação apenas para as ações de UF-09. As demais salvam direto e permitem corrigir. |
| FE-P7 | **Linguagem do trabalho, não da TI.** | "Salvar", "Agendar", "Finalizar visita". Sem "payload", "sync", "token", "erro 500" na tela. |

### 1.3 Perfis e contexto de uso

Fonte dos perfis: PRD §3.1 e doc 04 §1.1. O RT **não é usuário** (DEC-07) e não tem interface.

| Perfil | Quem é | Dispositivo | Ambiente | Frequência (estimada) | Volume (DEC-34) | Implicações de UI |
|---|---|---|---|---|---|---|
| `ADM` | Equipe administrativa da empresa executora | Desktop/notebook; navegador atual. Viewport de referência **1280×800**; mínimo suportado **1024×768** com layout completo; abaixo disso, layout empilhado (funciona, sem otimização) | Escritório, tela grande, teclado e mouse | Diária, várias horas [A VALIDAR] | 3 usuários | Densidade média; tabelas com muitas colunas; atalhos de teclado nos filtros; navegação por teclado completa |
| `TECNICO` | Técnico de campo | **Só celular** (decisão 12/11/2026), PWA instalado; viewport de referência **360×640** | Sol, casa de máquinas, forro, luvas, uma mão, rede instável (RNF-14, PW-06) | Uso por visita; poucas por dia [A VALIDAR] | ~20 usuários | Alvos de toque ≥ 48 px; botões OK/NOK ≥ 64 px de altura; texto base 16 px; contraste alto; sem hover; sem tabelas largas; barra inferior fixa; indicador de sincronização |
| `CLIENTE` | Usuário de empresa contratante (um único cliente, DEC-39) | Desktop **e** navegador do celular | Escritório do cliente; uso ocasional; pouco técnico | Esporádica (consultar, baixar, assinar) [A VALIDAR] | ~200 usuários | Linguagem simples; poucos itens de menu; assinatura em fluxo guiado (TL-307); leitura de PDF; **sem** exibir termos internos |

---

## 2. Identidade visual e Design Tokens

### 2.0 Regras gerais de token (FE-T)

| ID | Regra |
|---|---|
| FE-T1 | **Nenhum valor solto.** Cor, tamanho de fonte, espaçamento, raio, sombra, z-index e duração vêm de token. Proibido hex, `px` arbitrário (`w-[37px]`), `rgb()` ou `z-[999]` em componente. |
| FE-T2 | Tokens vivem em **um único arquivo**: `src/app/globals.css`, bloco `@theme` (Tailwind CSS 4). Nenhum `tailwind.config.js` com valores duplicados. |
| FE-T3 | Dois níveis: **primitivos** (`--color-blue-700`) e **semânticos** (`--color-action`, `--color-status-warning-bg`). Componentes usam **só semânticos**. |
| FE-T4 | Mudar a marca (cor/logo, ainda [A VALIDAR]) = alterar somente os tokens da família `--color-brand-*` e o arquivo do logo. |
| FE-T5 | Todo par texto/fundo listado aqui tem contraste **calculado** (fórmula WCAG 2.1). Par novo exige cálculo antes de entrar. |
| FE-T6 | **Sem modo escuro no MVP** (decisão 12/11/2026). Declarar `color-scheme: light` no `:root`. Como os componentes só usam tokens semânticos, o modo escuro futuro será uma segunda camada de valores, sem mexer em componente. |

### 2.1 Paleta (valores exatos)

Paleta **[A VALIDAR]**: nenhuma cor de marca nem logo foi fornecida (decisão 12/11/2026: paleta azul neutra aceita). Trocar apenas a escala `brand`.

#### 2.1.1 Marca (primária)

| Token primitivo | Hex | Uso |
|---|---|---|
| `--color-brand-50` | `#EFF6FF` | Fundo de item selecionado, destaque suave |
| `--color-brand-100` | `#DBEAFE` | Fundo de badge "informativo forte", hover de linha selecionada |
| `--color-brand-200` | `#BFDBFE` | Borda de destaque |
| `--color-brand-500` | `#3B82F6` | **Somente** anel de foco decorativo e gráficos; nunca texto |
| `--color-brand-700` | `#1D4ED8` | **Cor primária**: botão primário, links, item de menu ativo, ícone de ação |
| `--color-brand-800` | `#1E40AF` | Hover do botão primário |
| `--color-brand-900` | `#1E3A8A` | Active (pressionado) do botão primário |

#### 2.1.2 Secundária

A cor secundária **é o neutro** (não há segundo matiz de marca). Botão secundário = fundo branco, borda `--color-neutral-500`, texto `--color-neutral-800`. Não introduzir segunda cor de destaque.

#### 2.1.3 Neutros (escala completa)

| Token primitivo | Hex | Uso principal |
|---|---|---|
| `--color-neutral-0` | `#FFFFFF` | Superfície (cards, tabelas, inputs) |
| `--color-neutral-50` | `#F8FAFC` | Fundo da página |
| `--color-neutral-100` | `#F1F5F9` | Fundo de cabeçalho de tabela, hover de linha, skeleton |
| `--color-neutral-200` | `#E2E8F0` | Divisores e bordas decorativas |
| `--color-neutral-300` | `#CBD5E1` | Borda de card; fundo de campo desabilitado |
| `--color-neutral-400` | `#94A3B8` | **Só** ícone decorativo e skeleton; **nunca texto** (contraste 2,56:1 sobre branco) |
| `--color-neutral-500` | `#64748B` | Borda de campo de formulário; texto auxiliar (ver nota) |
| `--color-neutral-600` | `#475569` | Texto secundário, ícones |
| `--color-neutral-700` | `#334155` | Texto de rótulo, cabeçalho de tabela |
| `--color-neutral-800` | `#1E293B` | Texto forte |
| `--color-neutral-900` | `#0F172A` | Texto principal |

Nota: `neutral-500` sobre branco = 4,76:1 (passa 4,5:1); sobre `neutral-50` = 4,55:1 (passa por pouco); **sobre `neutral-100` ou mais escuro de fundo, usar `neutral-600`**.

#### 2.1.4 Semânticas

| Papel | `solid` (fundo de botão/ícone, texto branco) | `bg` | `border` | `text` (sobre `bg`) |
|---|---|---|---|---|
| Sucesso | `#15803D` | `#F0FDF4` | `#86EFAC` | `#166534` |
| Alerta | `#B45309` | `#FFFBEB` | `#FCD34D` | `#92400E` |
| Erro | `#B91C1C` | `#FEF2F2` | `#FCA5A5` | `#991B1B` |
| Informação | `#0369A1` | `#F0F9FF` | `#7DD3FC` | `#075985` |

#### 2.1.5 Contraste validado (WCAG 2.1, razões calculadas)

| Par | Razão | Exigido |
|---|---|---|
| Branco / `brand-700` (botão primário, link) | 6,70:1 | 4,5:1 ✅ |
| `brand-700` / `brand-50` (menu ativo) · `brand-800` / `brand-100` (badge) | 6,16:1 · 7,15:1 | 4,5:1 ✅ |
| `neutral-900` / branco (texto) · `neutral-700` (rótulo) · `neutral-600` (secundário) | 17,85 · 10,35 · 7,58 | 4,5:1 ✅ |
| `neutral-500` / branco (hint, placeholder, **borda de campo**) | 4,76:1 | 4,5:1 (texto) e 3:1 (borda) ✅ |
| `neutral-700` / `neutral-100` (badge neutro) | 9,45:1 | 4,5:1 ✅ |
| Branco / `solid` sucesso · alerta · erro · info | 5,02 · 5,02 · 6,47 · 5,93 | 4,5:1 ✅ |
| `text` / `bg` sucesso · alerta · erro · info | 6,81 · 6,84 · 7,60 · 7,09 | 4,5:1 ✅ |
| `neutral-400` / branco | 2,56:1 | ❌ proibido para texto e borda de campo |

Anel de foco `brand-700` sobre branco = 6,70:1 (≥ 3:1). Sobre fundo `brand-700` o anel usa offset de 2 px branco.

### 2.2 Tokens semânticos de cor (os únicos usados em componentes)

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* ===== Primitivos ===== */
  --color-brand-50:#EFF6FF; --color-brand-100:#DBEAFE; --color-brand-200:#BFDBFE;
  --color-brand-500:#3B82F6; --color-brand-700:#1D4ED8; --color-brand-800:#1E40AF; --color-brand-900:#1E3A8A;

  --color-neutral-0:#FFFFFF;   --color-neutral-50:#F8FAFC;  --color-neutral-100:#F1F5F9;
  --color-neutral-200:#E2E8F0; --color-neutral-300:#CBD5E1; --color-neutral-400:#94A3B8;
  --color-neutral-500:#64748B; --color-neutral-600:#475569; --color-neutral-700:#334155;
  --color-neutral-800:#1E293B; --color-neutral-900:#0F172A;

  --color-success-solid:#15803D; --color-success-bg:#F0FDF4; --color-success-border:#86EFAC; --color-success-text:#166534;
  --color-warning-solid:#B45309; --color-warning-bg:#FFFBEB; --color-warning-border:#FCD34D; --color-warning-text:#92400E;
  --color-danger-solid:#B91C1C;  --color-danger-bg:#FEF2F2;  --color-danger-border:#FCA5A5;  --color-danger-text:#991B1B;
  --color-info-solid:#0369A1;    --color-info-bg:#F0F9FF;    --color-info-border:#7DD3FC;    --color-info-text:#075985;

  /* ===== Semânticos (usar estes nos componentes) ===== */
  --color-page:var(--color-neutral-50);
  --color-surface:var(--color-neutral-0);
  --color-surface-muted:var(--color-neutral-100);
  --color-border:var(--color-neutral-300);        /* card, divisor forte */
  --color-border-subtle:var(--color-neutral-200); /* divisor leve */
  --color-border-input:var(--color-neutral-500);  /* campo: 4,76:1 */
  --color-text:var(--color-neutral-900);
  --color-text-label:var(--color-neutral-700);
  --color-text-muted:var(--color-neutral-600);
  --color-text-hint:var(--color-neutral-500);     /* só sobre surface/page */
  --color-text-disabled:var(--color-neutral-500); /* exceção WCAG: desabilitado */
  --color-text-on-action:var(--color-neutral-0);
  --color-action:var(--color-brand-700);
  --color-action-hover:var(--color-brand-800);
  --color-action-active:var(--color-brand-900);
  --color-action-subtle:var(--color-brand-50);
  --color-link:var(--color-brand-700);
  --color-focus-ring:var(--color-brand-700);
  --color-overlay:rgb(15 23 42 / 0.5);            /* neutral-900 a 50% */
  --color-skeleton:var(--color-neutral-100);
  --color-disabled-bg:var(--color-neutral-100);
  --color-disabled-border:var(--color-neutral-300);

  /* ===== Tipografia ===== */
  --font-sans:"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  /* ===== Espaçamento (base 4 px) ===== */
  --spacing:0.25rem; /* 1 unidade = 4 px: p-1=4, p-2=8, p-3=12, p-4=16, p-6=24, p-8=32 */

  /* ===== Raios ===== */
  --radius-sm:0.25rem; --radius-md:0.5rem; --radius-lg:0.75rem; --radius-full:9999px;

  /* ===== Sombras ===== */
  --shadow-1:0 1px 2px 0 rgb(15 23 42 / 0.08);
  --shadow-2:0 2px 8px -1px rgb(15 23 42 / 0.12);
  --shadow-3:0 8px 24px -4px rgb(15 23 42 / 0.20);

  /* ===== Breakpoints ===== */
  --breakpoint-sm:40rem;  /* 640 */
  --breakpoint-md:48rem;  /* 768 */
  --breakpoint-lg:64rem;  /* 1024 */
  --breakpoint-xl:80rem;  /* 1280 */

  /* ===== Duração ===== */
  --duration-fast:120ms; --duration-base:200ms; --duration-slow:300ms;
  --ease-standard:cubic-bezier(0.2, 0, 0, 1);
}

:root { color-scheme: light; }
```

O Tailwind 4 gera utilitários a partir de `@theme` (`bg-surface`, `text-text-muted`, `bg-action`, `border-border-input`…). Proibido usar as classes de paleta padrão (`bg-blue-*`, `text-gray-*`, `slate-*`). `--color-overlay` é o único valor com transparência.

### 2.3 Cores e rótulos de estado do domínio

Fonte dos estados e rótulos: doc 04 §1.5 (não alterar). Este documento só define **cor e ícone**. Todo estado aparece como `StatusBadge` = **ícone + texto + cor** (nunca só cor, WCAG 1.4.1). Ícones: lucide-react.

Tons: `neutral` = fundo `neutral-100`, texto `neutral-700` (9,45:1 — par acrescentado em §2.1.5 por esta linha), borda `neutral-300`; `info`/`success`/`warning`/`danger` = `bg`/`text`/`border` da §2.1.4; `brand` = fundo `brand-100`, texto `brand-800`, borda `brand-200`.

| Enum / derivado | Valor → rótulo (doc 04 §1.5) | Tom | Ícone lucide |
|---|---|---|---|
| `visit_status` | `A_AGENDAR` → "A agendar" | `neutral` | `CalendarClock` |
| | `AGENDADA` → "Agendada" | `info` | `CalendarCheck` |
| | `EM_ANDAMENTO` → "Em andamento" | `brand` | `Play` |
| | `REGISTRADA` → "Registrada" | `success` | `CheckCircle2` |
| | `CANCELADA` → "Cancelada" | `neutral` (texto riscado não; só tom) | `Ban` |
| Derivado (RN-109) | "Atrasada" (etiqueta **adicional**, não substitui o estado) | `danger` | `AlertTriangle` |
| `occurrence_status` | `NAO_PREVISTA` → "Ø" | `neutral` | `Minus` |
| | `PREVISTA` → "Prevista" | `neutral` | `Circle` |
| | `PENDENTE` → "Pendente" | `warning` | `Clock` |
| | `OK` → "OK" | `success` | `Check` |
| | `NOK` → "NOK" | `danger` | `X` |
| `pmoc_status` | `RASCUNHO` → "Rascunho" | `neutral` | `FilePen` |
| | `EMITIDO` → "Aguardando assinatura do cliente" | `warning` | `FileClock` |
| | `ASSINADO_CLIENTE` → "Assinado" | `success` | `FileCheck` |
| | `HISTORICO` → "Histórico" | `neutral` | `Archive` |
| `report_status` | `RASCUNHO` → "Rascunho" | `neutral` | `FilePen` |
| | `AGUARDANDO_ASSINATURA` → "Aguardando assinatura" | `warning` | `FileClock` |
| | `ASSINADO_CLIENTE` → "Assinado" | `success` | `FileCheck` |
| `contract_status` | `A_INICIAR` → "A iniciar" | `info` | `CalendarClock` |
| | `VIGENTE` → "Vigente" | `success` | `CheckCircle2` |
| | `ENCERRADO` → "Encerrado" | `neutral` | `Archive` |
| | `CANCELADO` → "Cancelado" | `neutral` | `Ban` |
| Certificado (RN-153) | `VALIDO` → "Válido" | `success` | `ShieldCheck` |
| | `A_VENCER` → "Vence em {n} dias" | `warning` | `ShieldAlert` |
| | `VENCIDO` → "Vencido" | `danger` | `ShieldX` |
| Equipamento/usuário/cliente/tipo | `ATIVO` → "Ativo" · `INATIVO` → "Inativo" | `success` / `neutral` | `CheckCircle2` / `Ban` |
| `notification_status` | `NAO_LIDA` → destaque (ponto `brand-700` 8 px + texto `font-semibold`) · `LIDA` → normal | — | — |
| Sincronização do PWA (PW-03) | "Salvo no aparelho" `neutral` `HardDrive` · "Enviando…" `info` `Loader2` (gira) · "Enviado" `success` `CloudCheck` · "Não enviado – nova tentativa automática" `warning` `CloudOff` | ver coluna | ver coluna |

Regras: (1) rótulos de estado **só** vêm da tabela; (2) estado `ATIVO`/`INATIVO` de equipamento, usuário, cliente e tipo: os rótulos "Ativo/Inativo" são **(UI)** [A VALIDAR] — os enums existem no doc 03; (3) um registro mostra **um** badge de estado + opcionalmente "Atrasada"; (4) "Atrasada" nunca aparece em visita `REGISTRADA` ou `CANCELADA` (conforme RN-109) — a regra de quando é atrasada vem do servidor, a UI só exibe.

### 2.4 Tipografia

Família **Inter** (decisão 12/11/2026: sem fonte obrigatória), carregada com `next/font/google` (self-hosted pelo Next, sem requisição ao Google em runtime), pesos **400, 500, 600, 700**, `subsets: ["latin"]`, `display: "swap"`. Fallback: pilha de `--font-sans`. Números tabulares (`font-variant-numeric: tabular-nums`) em tabelas, TAG, datas e valores medidos (classe `tabular-nums`).

| Token | Tamanho (rem / px) | Line-height | Peso | Uso |
|---|---|---|---|---|
| `text-h1` | 1.75rem / 28 | 2.25rem (36) | 600 | Título da página (um por tela) |
| `text-h2` | 1.375rem / 22 | 1.75rem (28) | 600 | Título de seção/card |
| `text-h3` | 1.125rem / 18 | 1.625rem (26) | 600 | Subseção, título de diálogo |
| `text-h4` | 1rem / 16 | 1.5rem (24) | 600 | Título de grupo de campos |
| `text-h5` | 0.875rem / 14 | 1.25rem (20) | 600 | Cabeçalho de coluna de tabela |
| `text-h6` | 0.75rem / 12 | 1rem (16) | 600, caixa-alta com `tracking-wide` | Rótulo de seção do menu lateral |
| `text-body` | 0.875rem / 14 (desktop) · **1rem / 16 (mobile e `TL-2xx`)** | 1.25rem (20) · 1.5rem (24) | 400 | Texto corrido, valores de tabela, campos |
| `text-body-strong` | igual a `text-body` | igual | 500 | Valor em destaque, rótulo de campo |
| `text-small` | 0.8125rem / 13 | 1.125rem (18) | 400 | Texto de ajuda, metadados |
| `text-caption` | 0.75rem / 12 | 1rem (16) | 400 | Rodapé, legenda de foto, carimbo de data/hora |

Regras: (a) campos de formulário têm **16 px no mobile** (evita zoom automático do iOS); (b) texto nunca abaixo de 12 px; (c) uma `<h1>` por tela; níveis de título não pulam; (d) largura máxima de texto corrido: 70 caracteres (`max-w-prose`); (e) proibido `font-light`, `italic` decorativo e `uppercase` fora de `text-h6`; (f) títulos de tela em "Sentence case" (só a primeira letra maiúscula), como nos nomes de TL do doc 04.

Os tokens `text-h1`…`text-caption` são definidos como utilitários no `globals.css` (`@utility`) agrupando tamanho + line-height + peso; componentes usam **só** esses.

### 2.5 Espaçamento

Base 4 px. Escala permitida (nenhum outro valor):

| Token | rem | px | Uso típico |
|---|---|---|---|
| `1` | 0.25 | 4 | Entre ícone e texto em badge |
| `2` | 0.5 | 8 | Entre rótulo e campo; padding de badge |
| `3` | 0.75 | 12 | Padding interno de campo |
| `4` | 1 | 16 | **Padrão** entre campos; padding de card em mobile; gutter de página em mobile |
| `6` | 1.5 | 24 | Padding de card em desktop; entre grupos |
| `8` | 2 | 32 | Entre seções; gutter de página em desktop |
| `12` | 3 | 48 | Entre blocos grandes; altura de alvo no PWA |
| `16` | 4 | 64 | Altura do botão OK/NOK |

Regras de proximidade: rótulo↔campo = `2`; campo↔campo = `4`; grupo↔grupo = `6`; seção↔seção = `8`. Elementos relacionados ficam mais próximos entre si do que de elementos não relacionados.

### 2.6 Raios, bordas, sombras, z-index, duração

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` | 4 px | Checkbox, badge |
| `rounded-md` | 8 px | Botão, campo, select, toast |
| `rounded-lg` | 12 px | Card, diálogo, gaveta |
| `rounded-full` | 9999 px | Avatar, contador do sino, ponto de não lida |
| Borda padrão | 1 px, `--color-border` | Card, tabela |
| Borda de campo | 1 px, `--color-border-input`; 2 px `--color-action` em foco | Inputs |
| `shadow-1` | ver §2.2 | Card |
| `shadow-2` | ver §2.2 | Dropdown, popover, toast |
| `shadow-3` | ver §2.2 | Diálogo, gaveta |
| Duração | `fast` 120 ms (hover, foco) · `base` 200 ms (abrir/fechar) · `slow` 300 ms (gaveta) | Sem animação decorativa. Respeitar `prefers-reduced-motion: reduce` → duração 0 e spinner estático com texto |

Z-index (único lugar onde se declara; nunca usar outro valor):

| Token | Valor | Camada |
|---|---|---|
| `--z-base` | 0 | Conteúdo |
| `--z-sticky` | 10 | Cabeçalho de tabela fixo, barra de ações fixa do PWA |
| `--z-nav` | 20 | Sidebar, topbar, barra inferior |
| `--z-dropdown` | 30 | Select, combobox, popover, tooltip |
| `--z-overlay` | 40 | Fundo escuro de diálogo/gaveta |
| `--z-modal` | 50 | Diálogo, gaveta, diálogo de confirmação |
| `--z-toast` | 60 | Toasts |
| `--z-offline-banner` | 55 | Faixa "Sem conexão" do PWA (abaixo dos toasts, acima dos diálogos) |

### 2.7 Grid, breakpoints, larguras

| Breakpoint | Mín. | Colunas | Gutter | Margem lateral da página |
|---|---|---|---|---|
| (base) mobile | 0 | 4 | 16 px | 16 px |
| `sm` | 640 px | 4 | 16 px | 16 px |
| `md` | 768 px | 8 | 24 px | 24 px |
| `lg` | 1024 px | 12 | 24 px | 32 px |
| `xl` | 1280 px | 12 | 24 px | 32 px |

| Contêiner | Largura máxima | Uso |
|---|---|---|
| `content-wide` | 1280 px | Área de conteúdo do `ADM` (listas, agenda, painel) |
| `content-form` | 768 px | Páginas de formulário e detalhe simples |
| `content-portal` | 1152 px | Portal do cliente |
| `content-pwa` | 640 px | App do técnico (centralizado em telas maiores) |
| `content-auth` | 400 px | Login e telas de senha |

### 2.8 Ícones

- Biblioteca **única**: `lucide-react` (decisão 12/11/2026, proposta aceita). Versão exata fixada no `package.json`, sem `^` (CLAUDE.md). Proibido misturar com outra biblioteca ou emoji como ícone.
- Importar por nome (`import { Check } from "lucide-react"`), nunca o pacote inteiro.
- Tamanhos permitidos: **16 px** (dentro de texto/badge/botão `sm`), **20 px** (botão padrão, campos, menu), **24 px** (barra inferior do PWA, estado vazio pequeno), **48 px** (ilustração de estado vazio). `stroke-width` 2 (padrão do lucide), exceto 1.5 nos de 48 px.
- Ícone **decorativo** ao lado de texto: `aria-hidden="true"`. Ícone **sozinho** (botão só com ícone): obrigatório `aria-label` em português e tooltip.
- Botão só com ícone: alvo mínimo 44×44 px (36×36 só em tabelas desktop com `aria-label`).
- Cor do ícone herda `currentColor`.

### 2.9 Logo, nome e modo escuro

- **Logo e nome do sistema [A VALIDAR]:** não fornecidos. Placeholder: ícone `Snowflake` 20 px + texto "PMOC" (`text-h3`, `brand-700`) em `src/components/brand/logo.tsx`; nome na constante `APP_NAME` (`src/lib/brand.ts`). PWA: `theme_color` `#1D4ED8`, `background_color` `#F8FAFC`; ícones em `public/icons/` [A VALIDAR]. O logo da **empresa executora** é dado de cadastro (TL-102) e vai nos PDFs (RNF-07).
- **Modo escuro: fora do MVP** (decisão 12/11/2026): uso diurno em campo pede alto contraste claro, dobraria a validação de contraste e nenhum RF/RNF pede. Preparado pelos tokens semânticos (FE-T3) e `color-scheme: light`. Proibido `dark:`.

---

## 3. Biblioteca de componentes

### 3.0 Base técnica e regras comuns

| Item | Decisão |
|---|---|
| Base | **shadcn/ui** (decisão 12/11/2026): componentes copiados para `src/components/ui/` (primitivos, sobre Radix UI) e **ajustados aos tokens da §2**. Composições do domínio ficam em `src/components/` (ex.: `status-badge.tsx`). |
| Dependências novas (além da stack do doc 05 §3.0) | `tailwindcss` 4, `radix-ui` (pacotes usados pelos componentes), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner` (toast), `react-day-picker` (calendário), `cmdk` (combobox). Versões exatas, sem `^`. **[A VALIDAR]**: fixar as versões ao instalar. |
| Formulários | Campos controlados por **react-hook-form** + `@hookform/resolvers` com os mesmos schemas Zod 4 do servidor (UF-02) **[A VALIDAR]**: bibliotecas não estão no doc 05. Se não forem adotadas, usar `<form action>` + `useActionState`/`next-safe-action`; as regras visuais abaixo não mudam. |
| Tabelas | Componente `DataTable` próprio sobre `<table>` HTML; ordenação, filtro e paginação **no servidor** (UL-01, doc 05 §3.8). **Não** adicionar `@tanstack/react-table`. |
| Calendário da agenda (TL-130) | CSS grid próprio, sem biblioteca de agenda. |
| Assinatura desenhada (TL-206) | Componente `SignaturePad` em `<canvas>`; biblioteca [A VALIDAR] (spike); se não houver, implementar com Pointer Events. |
| Regra FE-C1 | Todo componente abaixo existe **uma vez**. Antes de criar outro, ver §10. |
| Regra FE-C2 | Todo componente aceita e repassa `className` apenas para **layout** (margem, largura), nunca para cor/tamanho de fonte/raio. |

#### 3.0.1 Estados obrigatórios (vale para todo componente interativo)

| Estado | Regra visual |
|---|---|
| default | Conforme a tabela do componente. |
| hover (só com ponteiro `@media (hover:hover)`) | Fundo um degrau mais escuro/claro conforme componente. No PWA não há hover. |
| focus-visible | Anel `outline: 2px solid var(--color-focus-ring); outline-offset: 2px`. Nunca `outline: none` sem substituto. Visível em **todo** elemento focável, inclusive linhas de tabela clicáveis, abas e itens de menu. |
| active | Um degrau mais escuro que o hover (botões) ou `scale(0.98)` em 120 ms (cartões tocáveis do PWA). |
| disabled | Fundo `--color-disabled-bg`, borda `--color-disabled-border`, texto `--color-text-disabled`, cursor `not-allowed`, `aria-disabled="true"`. **Sempre** acompanhado de motivo quando a causa não é óbvia: tooltip no desktop, texto de ajuda abaixo no mobile (heurística 10). |
| loading | Botão: spinner `Loader2` 16 px à esquerda, texto vira gerúndio ("Salvando…"), `aria-busy="true"`, desabilitado (UF-06). Bloco: `Skeleton`. |
| erro | Borda `--color-danger-solid` 2 px, ícone `AlertCircle` 16 px, mensagem em `text-small` `--color-danger-text` abaixo, ligada por `aria-describedby`; `aria-invalid="true"`. |
| vazio | `EmptyState` (§3.17). |

### 3.1 Botão (`Button`)

- **Finalidade:** disparar uma ação. **Não** usar para navegar (usar `<Link>` com `buttonVariants`).
- **Variantes** (hierarquia; **máximo 1 primário por tela/diálogo**):

| Variante | Fundo / borda / texto | Uso | Exemplo real |
|---|---|---|---|
| `primary` | `action` / — / branco | A ação principal da tela | "Salvar", "Agendar", "Emitir PMOC", "Finalizar visita", "Assinar" |
| `secondary` | `surface` / `border-input` / `neutral-800` | Ação alternativa importante | "Cancelar", "Voltar", "Pré-visualizar PDF" |
| `tertiary` | transparente / — / `link` | Ação leve, em linha ou em tabela | "Limpar filtros", "Ver histórico" |
| `destructive` | `danger-solid` / — / branco | Ação que muda estado de forma irreversível ou perde dados, **sempre dentro de diálogo de confirmação** | "Cancelar contrato", "Cancelar visita", "Inativar" |
| `destructive-outline` | `surface` / `danger-solid` / `danger-text` | Gatilho na tela que abre a confirmação | "Cancelar contrato" (botão que abre TL-112 diálogo) |

- **Tamanhos:** `sm` 36 px de altura (só desktop em tabelas e barras de filtro) · `md` 40 px (padrão desktop) · `lg` 48 px (padrão em `TL-2xx` e em qualquer tela < 768 px) · `xl` 64 px (**só** botões "OK" e "NOK – não efetuado" de TL-203). Padding horizontal `4` (16 px) em `md`/`lg`, `6` em `xl`. Raio `rounded-md`. Texto `text-body-strong`.
- **Anatomia:** [ícone 20 px opcional] [rótulo]. Ícone à esquerda; só ícone = `IconButton` com `aria-label`.
- **Estados:** §3.0.1. Hover: `action-hover`; active: `action-active` (primary); secundária: hover `surface-muted`.
- **Regras de uso:**
  1. Rótulo = verbo no infinitivo + objeto quando necessário (§6). Nunca "OK", "Sim", "Enviar" sozinhos em ação de negócio.
  2. Posição em diálogos e barras de ação: primária **à direita**, secundária à esquerda dela (desktop); no mobile, empilhadas, primária em cima, largura total.
  3. Ação destrutiva nunca é a primeira da fila nem fica ao lado da primária sem espaço `4`.
  4. Não use `destructive` para "Cancelar" de formulário (isso é `secondary`).
  5. Desabilitar durante envio (UF-06).
- **Responsivo:** < 768 px, botões de rodapé de formulário ocupam 100 % da largura (`w-full`), altura `lg`.

### 3.2 Campo de texto (`Input`, `Textarea`) e `FormField`

- **Finalidade:** entrada de texto livre. **Só** use texto livre quando não houver lista, busca ou seleção que sirva (ver heurística 6, §5.1).
- **Anatomia (`FormField`, único jeito de montar campo):** `Label` (acima, `text-body-strong`, cor `text-label`) → [marca "obrigatório"] → `Input` → texto de ajuda (`text-small`, `text-muted`) → mensagem de erro (`text-small`, `danger-text`, com ícone).
- **Obrigatório:** campo obrigatório mostra `*` vermelho **e** a palavra "(obrigatório)" é omitida; campos opcionais mostram "(opcional)" ao lado do rótulo. Regra: **marcar o opcional** quando a maioria for obrigatória; **marcar o obrigatório** quando a maioria for opcional. Padrão do sistema: formulários de cadastro marcam "(opcional)" [A VALIDAR].
- **Tamanhos:** altura 40 px (desktop) / 48 px (mobile e `TL-2xx`). Padding `3`. Borda 1 px `border-input`, raio `rounded-md`, fundo `surface`.
- **Tipos (`type` / `inputMode`):** texto (`text`), e-mail (`email`, `autocomplete="email"`), telefone (`tel`, `inputMode="tel"`), numérico (`inputMode="decimal"` para valores medidos; aceita vírgula), CNPJ/CEP (`inputMode="text"` para CNPJ por aceitar letras, DM-13; `inputMode="numeric"` para CEP). Senha: `type="password"` com botão "Mostrar/Ocultar senha" (`Eye`/`EyeOff`, `aria-label`).
- **Máscaras (UF-03):** CNPJ `00.000.000/0000-00`, CEP `00000-000`, telefone `(00) 0000-0000` / `(00) 00000-0000` (RNF-07). Máscara só na exibição/digitação; valor enviado sem máscara. Implementação: funções puras em `src/lib/format` (já previstas no doc 05 §5); **não** adicionar biblioteca de máscara.
- **Estados:** §3.0.1. Foco: borda 2 px `action` + anel. Somente leitura: fundo `surface-muted`, sem borda de foco forte, texto `text` (distinto de desabilitado).
- **`Textarea`:** mínimo 3 linhas, `resize-y`, contador "{n}/{máx}" quando houver limite (limite só se vier do doc 03).
- **Quando NÃO usar:** para escolher entre opções conhecidas (usar `Select`/`Combobox`/`RadioGroup`); para datas (usar `DatePicker`).
- **Responsivo:** largura total; em desktop, campos curtos (UF, CEP, nº) têm largura fixa pelo conteúdo (`w-24`, `w-40`), formulário em 2 colunas a partir de `lg` apenas para campos curtos relacionados (ex.: cidade + UF).

### 3.3 Seleção: `Select`, `Combobox`, `RadioGroup`, `Checkbox`, `Switch`

| Componente | Quando usar | Quando NÃO usar | Regras |
|---|---|---|---|
| `Select` (nativo estilizado em mobile; Radix Select em desktop) | 2 a 7 opções fixas, sem busca (ex.: UF [27 → usar Combobox], periodicidade, perfil) | > 7 opções ou lista que cresce com o negócio | Mostra "Selecione…" como placeholder; primeira opção real nunca pré-selecionada, salvo padrão do doc. No mobile **usar `<select>` nativo** (teclado/roda do sistema) |
| `Combobox` (Popover + `cmdk`) | Lista longa ou dinâmica: **Cliente**, **Local**, **Técnico**, **Tipo de equipamento**, **UF** (27) | ≤ 7 opções fixas | Campo com ícone `Search`; busca ao digitar (debounce 300 ms, consulta no servidor quando a lista vem do banco, UL-01); mostra até 10 resultados com rolagem; item mostra texto principal + secundário (ex.: razão social + CNPJ mascarado); "Nenhum resultado" + (se o perfil puder) link "Cadastrar {entidade}"; limpar com botão `X`; navegável por teclado (setas, Enter, Esc) |
| `RadioGroup` | 2 a 4 opções mutuamente exclusivas que o usuário precisa **ver** juntas (ex.: visão Lista/Calendário usa `SegmentedControl`, ver abaixo) | Mais de 4 opções | Círculo 20 px, rótulo clicável, alvo 44 px |
| `Checkbox` | Escolha sim/não ou múltipla; "Requer corretiva" (TL-203); "s/n" do endereço (UF-04); seleção de linhas | Ação imediata (usar `Switch`) | Quadrado 20 px (24 px no PWA), raio `rounded-sm`; rótulo à direita e clicável; estado indeterminado em "selecionar todos" |
| `Switch` | Liga/desliga com efeito imediato [A VALIDAR se existe alguma ocorrência no MVP] | Formulário com botão Salvar (usar `Checkbox`) | — |
| `SegmentedControl` | Alternar **visões** da mesma tela (Lista/Calendário em TL-130; "Próximas/Finalizadas" é `Tabs`, §3.9) | Escolha de dado de formulário | 2–3 segmentos, altura 40/48 px |

Todos: `label` obrigatório, associação por `htmlFor`/`aria-labelledby`, estados §3.0.1.

### 3.4 Data e hora (`DatePicker`, `TimeField`, `DateRangePicker`)

- **`DatePicker`:** campo texto com máscara `dd/mm/aaaa` (UF-05) + botão `Calendar` que abre `react-day-picker` em popover. **Digitar é sempre possível** (acessibilidade); o calendário é atalho. Semana começa no domingo [A VALIDAR]; locale `pt-BR`; fuso `America/Sao_Paulo` (RNF-12).
- **Validação:** data inválida → erro "Informe uma data válida (dd/mm/aaaa)". Datas de negócio usam `date`, sem hora (CLAUDE.md).
- **`TimeField`:** `HH:mm` 24 h, máscara, `inputMode="numeric"`. Usado em horário agendado da visita (`scheduled_time`).
- **`DateRangePicker`:** dois `DatePicker` lado a lado (início e fim) com validação "Data final não pode ser anterior à inicial". Usado em filtros de período (TL-100, TL-130, contrato).
- **Mês de referência** (`reference_month`): `MonthPicker` = `Select` de mês + `Select` de ano; exibe "mm/aaaa".
- **Mobile:** o popover vira gaveta inferior (`Sheet side="bottom"`); em `TL-2xx` não há seleção de data.

### 3.5 Tabelas e listagens (`DataTable`)

- **Finalidade:** listas do ADM e do cliente em desktop. **No mobile (< 768 px) cada linha vira um `ListCard`** (§3.6) — nunca tabela com rolagem horizontal obrigatória, **exceto** a ficha do cronograma (TL-120), que rola horizontalmente dentro do próprio componente com a coluna "Equipamento/Atividade" fixa.
- **Anatomia (de cima para baixo):** barra de filtros → barra de ação em lote (aparece só com seleção) → cabeçalho → linhas → rodapé com "Mostrando {a}–{b} de {total}" + paginação.
- **Cabeçalho:** fundo `surface-muted`, `text-h5`, cor `text-label`, fixo (`sticky`, `--z-sticky`) ao rolar. Coluna ordenável: botão com rótulo + ícone `ArrowUpDown` (inativa) / `ArrowUp` / `ArrowDown`; `aria-sort`. Ordenação padrão é por coluna definida em cada tela (§7).
- **Linhas:** altura 48 px (padrão) · 40 px (compacta, só se a tela justificar); borda inferior `border-subtle`; hover `surface-muted`; linha clicável inteira leva ao detalhe, **e** o texto principal é um `<a>` (acessível por teclado). Linha selecionada: fundo `action-subtle`.
- **Células:** texto à esquerda; números/datas `tabular-nums`; datas `dd/mm/aaaa`; estado sempre `StatusBadge`; texto longo truncado com `…` e `title`/tooltip; TAG em `font-mono`.
- **Seleção:** `Checkbox` na 1ª coluna, só quando a tela tem ação em lote (§5.8). "Selecionar todos" marca apenas a página atual e mostra "25 selecionados" (UL-01).
- **Ações por linha:** no máx. **1 ação visível** (botão `tertiary` com o verbo, ex.: "Agendar") + menu `…` (`MoreHorizontal`, `aria-label="Mais ações"`) para as demais. Ação destrutiva dentro do menu, separada por divisor, texto `danger-text`.
- **Paginação:** 25 por página (UL-01), no servidor. Componente `Pagination`: "Anterior", números (máx. 5 visíveis + reticências), "Próxima"; página atual `aria-current="page"`. Mudar página mantém filtros (UL-02) e rola ao topo da tabela.
- **Filtros (UL-02):** na URL. Barra: campos em linha (desktop) ou dentro de `Sheet` "Filtros" aberto por botão (mobile); botão "Limpar filtros" (`tertiary`) aparece com filtro ativo; **chips** dos filtros ativos abaixo da barra, cada um removível com `X` (`aria-label="Remover filtro {nome}"`). Busca por texto: campo com `Search`, dispara ao pressionar Enter ou após 400 ms sem digitar.
- **Estados:** carregando = 5 linhas `Skeleton` na altura real; vazio = `EmptyState` dentro da tabela (texto da tela, doc 04); com filtro = "Nenhum resultado para os filtros" + "Limpar filtros" (doc 04 §1.2); erro = "Não foi possível carregar. Tente novamente." + botão (mantém filtros).
- **Quando NÃO usar:** para ≤ 5 itens de leitura (usar lista simples); para execução no celular (usar `ListCard` e `ChecklistItem`).

### 3.6 Cards e `ListCard`

| Componente | Finalidade | Anatomia | Regras |
|---|---|---|---|
| `Card` | Agrupar um bloco de conteúdo | `CardHeader` (título `text-h2` + ação opcional à direita) → `CardContent` → `CardFooter` opcional | `surface`, borda `border`, `rounded-lg`, `shadow-1`, padding `4` (mobile) / `6` (desktop). Nunca card dentro de card; dentro use divisor ou `fieldset`. |
| `ListCard` (linha em formato de card, mobile e PWA) | Representar um item de lista no celular: visita, relatório, notificação, PMOC | Linha 1: título (local/código) · `StatusBadge` à direita · Linha 2: metadados (data, técnico) `text-small` · Linha 3 opcional: etiquetas ("Atrasada", "Relatório não enviado") · `ChevronRight` à direita | Toda a área é o alvo de toque (mín. 64 px de altura no PWA); active = `scale(0.98)`; foco com anel. Mostra no máximo 4 informações (lei de Hick). |
| `StatCard` (contador do painel) | Mostrar um número com rótulo e leva à lista | Número `text-h1` · rótulo `text-small` · ícone | Usado nos grupos de TL-100 e TL-300; clicável; zero = tom `neutral`, > 0 = tom do grupo; **o número nunca é a única indicação** (texto "{n} pendentes"). |

### 3.7 `StatusBadge` e etiquetas

- **Finalidade:** mostrar estado de entidade (UL-04, §2.3). **Único** componente para estado. Props: `kind` (enum do §2.3) e `value`; ele resolve rótulo, tom e ícone numa tabela central `src/components/status-badge/map.ts`. O chamador **não** passa cor.
- **Anatomia:** ícone 16 px + texto `text-small` peso 500; padding `1` vertical, `2` horizontal; `rounded-sm`; borda 1 px do tom.
- **Tamanhos:** `md` (padrão) altura 24 px; `lg` (cabeçalho de detalhe e TL-2xx) altura 32 px, texto `text-body`.
- **Estados:** não interativo (sem hover/foco). Texto nunca truncado; se longo ("Aguardando assinatura do cliente"), quebra em duas linhas no mobile.
- **`Tag`** (etiqueta de informação, não de estado): ex.: "Pendente de {mês}", "Relatório não enviado", "Requer corretiva". Mesma forma do badge, tom `neutral` ou `warning`. **Não** usar `Tag` para estado de enum.
- **Acessibilidade:** o texto do badge é lido pelo leitor de tela; o ícone é `aria-hidden`.

### 3.8 Diálogos e confirmações (`Dialog`, `AlertDialog`, `Sheet`)

| Componente | Finalidade | Regras |
|---|---|---|
| `Dialog` (modal) | Tarefa curta que mantém o contexto: agendar/remarcar visita, emissão do PMOC (TL-121), resolver pendências (TL-134), assinar (TL-307) | Largura 480 px (confirmação), 640 px (formulário), 800 px (TL-121/TL-134); fundo `--color-overlay`; `rounded-lg`, `shadow-3`; `--z-modal`; foco preso dentro; Esc fecha (exceto durante envio); foco volta ao gatilho ao fechar; título `text-h3` obrigatório (`aria-labelledby`); rodapé com botões (§3.1) |
| `AlertDialog` (confirmação) | **Somente** ações de UF-09. Não fecha com clique fora nem Esc durante o envio | Estrutura fixa abaixo |
| `Sheet` (gaveta) | Mobile: filtros, menu lateral do ADM, calendário; desktop: nunca para formulários | Lateral (menu/filtros) ou inferior (pickers); `--z-modal` |

**Estrutura fixa do `AlertDialog` de confirmação (FE-C3):**

1. Ícone (`AlertTriangle` 24 px para destrutiva; `Info` para irreversível não destrutiva).
2. Título = pergunta com o verbo e o objeto: "Cancelar o contrato CTR-00054?".
3. Corpo = **o efeito**, em 1–3 frases: o que muda, o que não muda, se é irreversível (UF-09). Ex. real: "As visitas futuras deste contrato serão canceladas e os técnicos serão avisados. Esta ação não pode ser desfeita." (efeito conforme RN-144/RN-065; texto final [A VALIDAR] com o doc 02).
4. Campo opcional/obrigatório de motivo, quando o doc 04 pede (UF-10).
5. Botões: `secondary` "Voltar" (esquerda; foco inicial) · `destructive` ou `primary` com **o mesmo verbo do gatilho** (ex.: "Cancelar contrato", "Finalizar visita") à direita. **Nunca** "Sim/Não".
6. O botão de confirmação mostra `loading` durante o envio; em erro, o diálogo permanece aberto com a mensagem de erro no topo do corpo (`Alert`).

Foco inicial: em `AlertDialog` destrutivo no botão **"Voltar"**; em `Dialog` de formulário, no primeiro campo.

### 3.9 Navegação interna: `Tabs`, `Breadcrumb`, menus

| Componente | Regras |
|---|---|
| `Tabs` | Dividem **conteúdo da mesma entidade** (TL-109 Cliente: Dados/Locais/Usuários [A VALIDAR]; TL-200: "Próximas" e "Finalizadas"). Máx. **5** abas. Aba ativa: borda inferior 2 px `action` + texto `action` + `aria-selected`. Teclado: setas esquerda/direita, Home/End. Aba na URL (`?aba=`). < 768 px: rolagem horizontal da lista de abas, sem quebra. Não usar para etapas sequenciais |
| `Breadcrumb` | **Só no ADM e no cliente (desktop)**, a partir do 2º nível de profundidade (ex.: Clientes › Porto Belo › Local L012 › Equipamento TH-…). Último item = página atual, sem link, `aria-current="page"`. Separador `ChevronRight`. < 768 px: mostra só "‹ {pai}" (um nível acima). No PWA: botão voltar, sem breadcrumb |
| `Sidebar` (ADM) | §4.2 |
| `Topbar` | §4.2 |
| `BottomNav` (PWA e portal no celular) | §4.2 |
| `UserMenu` | Menu do avatar: nome, "Minha conta" (TL-005), "Sair". Ações via teclado |
| `Tooltip` | Só texto curto (≤ 80 caracteres) que **complementa**; nunca informação essencial (não existe em toque). Abre em foco e hover, atraso 300 ms |

### 3.10 Avisos e retornos: `Toast`, `Alert`

| Componente | Quando | Regras |
|---|---|---|
| `Toast` (`sonner`) | Resultado de uma ação **concluída** ou falha transitória (rede). Posição: topo à direita (desktop); **topo, largura total** (mobile/PWA) | Sucesso: some em **5 s**, `aria-live="polite"`. Erro: **não some sozinho**, tem botão fechar e, se aplicável, "Tentar novamente", `aria-live="assertive"`. Máx. 3 empilhados. Ícone + texto; nunca só cor. Nunca para erro de validação de campo, nunca para informação que precisa ser relida |
| `Alert` (faixa em linha) | Informação que precisa ficar visível na tela: aviso de conflito (UF-07), "Plano alterado após a emissão" (TL-120), faixa de "Configure a empresa…" (TL-100), erro dentro de diálogo | Tons `info`/`warning`/`danger`/`success` (§2.1.4); ícone + título opcional + texto + ação opcional; persistente até resolver; `role="alert"` só para erro |
| `OfflineBanner` | Só PWA: "Sem conexão – seus dados ficam salvos no aparelho" (doc 04 §1.2) | Fixo no topo, abaixo da barra de título, tom `warning`, `--z-offline-banner`; some ao reconectar |

### 3.11 Estados vazios, carregamento e erro (`EmptyState`, `Skeleton`, `ErrorState`)

| Componente | Regras |
|---|---|
| `EmptyState` | Ícone 48 px `neutral-600` → título curto (`text-h3`) → frase (`text-body`, `text-muted`) → **ação primária se o perfil puder criar** (doc 04 §1.2). Textos: os do doc 04 por tela; padrão para os não definidos: "Nenhum(a) {entidade} cadastrado(a)." + "Cadastrar {entidade}" |
| `Skeleton` | Retângulos `--color-skeleton` com `rounded-md`, **na forma do conteúdo final** (mesma altura de linha/card); animação `pulse` suave (desligada em `prefers-reduced-motion`); `aria-busy="true"` no contêiner e texto oculto "Carregando…" (`sr-only`). Aparece se a requisição passar de 150 ms (evita piscar) |
| `ErrorState` | Ícone `CloudOff`/`AlertCircle` 48 px → "Não foi possível carregar. Tente novamente." → botão "Tentar novamente"; mantém filtros; sem detalhe técnico (doc 04 §1.2) |
| `ForbiddenState` / `NotFoundState` | Textos fixos do doc 04 §1.2 (`SEM_ACESSO`, `NAO_ENCONTRADO`); botão para a tela inicial do perfil |
| `Spinner` | `Loader2` girando, 16/20/24 px; **só** dentro de botão ou ao lado de texto "Salvando…"; nunca tela inteira sozinha |

### 3.12 Upload de arquivos (`FileUpload`) e fotos (`PhotoCapture`)

| Componente | Uso | Regras |
|---|---|---|
| `FileUpload` | Certificado do RT (TL-103: arquivo + senha), logo da empresa (TL-102), PDF [se existir] | Área de soltar + botão "Escolher arquivo"; mostra nome, tamanho, ícone; botão "Remover"; tipos e tamanho máximo **vêm do doc 06/03** (aqui [A VALIDAR]); barra de progresso (`role="progressbar"`) quando o envio é mensurável; erro por arquivo ("Arquivo maior que {x} MB", "Formato não aceito. Use {formatos}"). Certificado: **nunca** reexibe arquivo nem senha (DM-11, RN-121); campo de senha `type="password"` |
| `PhotoCapture` (PWA, TL-203) | Fotos do equipamento | Dois botões `lg` lado a lado: "Câmera" (`Camera`, `<input capture="environment">`) e "Galeria" (`Image`); grade de miniaturas 3 colunas, 96×96 px, `object-cover`; legenda opcional; badge de sincronização por foto (PW-03); contador "{n}/10" (RN-185); botão "Excluir foto" com `AlertDialog` leve [A VALIDAR]; compressão no aparelho (PW-05); ao atingir 10 desabilita os botões com motivo "Limite de 10 fotos por equipamento" |

### 3.13 Execução de checklist (`ChecklistItem`) — componente crítico do técnico

Usado em TL-203 (e, em formato desktop, TL-132). Um item = uma **atividade** do equipamento na visita (`occurrence_record`).

**Anatomia (de cima para baixo), mobile 360 px:**

1. Linha de título: nome da atividade (`text-h4`) + `Tag` "Pendente de {mês}" quando aplicável + indicador de sincronização (§2.3) à direita.
2. Linha de apoio: periodicidade/grupo (`text-small`, `text-muted`) — somente se vier do doc 04.
3. **Par de botões** lado a lado, cada um `xl` (64 px de altura, ≥ 48% da largura): `OK` (ícone `Check`) e `NOK – não efetuado` (ícone `X`). Selecionado = preenchido com `success-solid` / `danger-solid` + texto branco + `aria-pressed="true"`; não selecionado = `secondary`. Texto dos botões: "OK" e "NOK – não efetuado" (D-05).
4. Se "OK" e a atividade é de medição: campo **Valor medido** (`inputMode="decimal"`, 48 px) com a **unidade** fixa ao lado (ex.: "V") — obrigatório (CA-21.1).
5. Se "OK": `Checkbox` "Requer corretiva" (alvo 48 px) (RN-193).
6. Observação: `Textarea` aparece automaticamente ao marcar NOK ou "Requer corretiva" (obrigatória, CA-21.2/21.3) e sob o botão "Observação" nos demais casos.
7. `PhotoCapture` se a atividade exige foto (RN-185) — destaque: `Tag` "Foto obrigatória".
8. Link `tertiary` "Limpar marcação".

| Estado do item | Visual |
|---|---|
| Sem marcação | Borda `border`, fundo `surface`, sem badge |
| OK | Barra lateral esquerda 4 px `success-solid` + ícone `CheckCircle2` no título |
| NOK | Barra lateral 4 px `danger-solid` + ícone `XCircle` |
| Incompleto após tentar finalizar | Borda 2 px `danger-solid` + texto do motivo (ex.: "Informe o valor medido") — texto, não só cor |
| Salvando / não enviado | Indicador PW-03 |
| Somente leitura (visita `REGISTRADA`) | Sem botões; mostra o resultado como `StatusBadge` |

**Regras:** (a) gravação automática a cada toque (PW-01); (b) um único toque marca; tocar de novo no mesmo botão **não** desmarca (usa "Limpar marcação") para evitar erro com luva; (c) rolagem preserva a posição ao voltar do teclado; (d) ao marcar, o foco **não** salta sozinho (previsível); (e) barra fixa inferior (`--z-sticky`) com "Equipamento anterior" · progresso "{x} de {y} atividades" · "Próximo equipamento".

Em desktop (TL-132, lançamento manual do ADM) o item vira **linha de tabela** com os mesmos controles e a ação em lote "Marcar todas como OK" (DFT-13).

### 3.14 Linha do tempo e histórico (`Timeline`)

- **Finalidade:** mostrar a sequência de eventos de uma entidade: histórico de agendamento da visita (`visit_schedule_change`), versões do PMOC/relatório, assinaturas, auditoria exibida ao ADM.
- **Anatomia:** lista vertical; cada evento = marcador (círculo 12 px `neutral-400`; atual = `action`) + linha vertical 2 px `border-subtle` + conteúdo: título do evento (`text-body-strong`), data/hora `dd/mm/aaaa HH:mm` (`text-caption`, `tabular-nums`), autor ("por {nome}"), motivo (se houver, em `text-small`), valor anterior → novo (`de {a} para {b}`).
- **Ordem:** mais recente **no topo**. Mostra 10 eventos; "Ver mais" carrega +10.
- **Estados:** vazio = "Sem histórico."; carregando = 3 itens `Skeleton`.
- **Acessibilidade:** `<ol>`; cada item `<li>` com `<time datetime>`.
- **Versões (PMOC/relatório):** cada versão mostra "Versão {n}" + `StatusBadge` + botão "Baixar PDF"; versões anteriores continuam disponíveis (RNF-15).

### 3.15 Outros componentes obrigatórios

| Componente | Regra |
|---|---|
| `PageHeader` | Breadcrumb (se aplicável) → `h1` → `StatusBadge` da entidade → metadados → ações da página à direita (primária + `…`) |
| `ActionBar` (barra de ações fixa) | Rodapé de formulário/execução: `sticky bottom-0`, `surface`, borda superior, `--z-sticky`; primária à direita |
| `DescriptionList` | Pares rótulo/valor em detalhes; rótulo `text-small` `text-muted`, valor `text-body`; 2 colunas ≥ `md`, 1 coluna no mobile; valor vazio mostra "—" (nunca vazio, `null` ou `undefined`, RNF-07) |
| `Avatar` | Iniciais do nome, 32 px, fundo `brand-100`, texto `brand-800` |
| `NotificationBell` | Ícone `Bell` com contador (`rounded-full`, `danger-solid`, máx. "9+"); `aria-label="Notificações, {n} não lidas"`; atualiza a cada 60 s e ao voltar à aba (DFT-14) |
| `Stepper`/`ProgressBar` | Progresso de execução "{x} de {y}" (barra 8 px `action` sobre `neutral-200`, `role="progressbar"`) — **não** é wizard |
| `ConflictAlert` | Implementação de UF-07 (409): `Alert` `warning` + botões "Recarregar" e "Copiar meus dados" |
| `PreconditionList` | Lista de pré-condições do TL-121: cada item com ícone `CheckCircle2` (ok) ou `XCircle` (faltante) + texto + link "Corrigir" |

---

## 4. Padrões de layout e navegação

### 4.1 Estrutura global por área (doc 04 §1.1)

#### 4.1.1 Área `ADM` (`/adm`, web)

```
┌───────────────┬──────────────────────────────────────────────────┐
│ Sidebar 256px │ Topbar (altura 56): [☰ <lg] [busca global?] [🔔] [Avatar▼] │
│ (--z-nav)     ├──────────────────────────────────────────────────┤
│  Logo         │ Área de conteúdo (content-wide, scroll próprio)   │
│  Menu         │   Breadcrumb                                      │
│               │   PageHeader                                      │
│               │   Blocos da página (template §4.3)                │
│               │ Rodapé (altura 40): "{APP_NAME} · versão {x}"     │
└───────────────┴──────────────────────────────────────────────────┘
```

- Sidebar fixa ≥ `lg` (256 px); entre `md` e `lg`, recolhida em 64 px (só ícones, com `Tooltip` e `aria-label`); < `md`, gaveta aberta pelo ☰ na topbar.
- Topbar: sino (TL-010) e menu do usuário. **Busca global não existe no MVP** (não está nos docs): não implementar.
- Rodapé: apenas versão do sistema [A VALIDAR]; sem links de marketing.
- Link "Pular para o conteúdo" como primeiro elemento focável (WCAG 2.4.1).

#### 4.1.2 Área `CLIENTE` (`/cliente`, web responsiva)

- ≥ `md`: topbar com logo, itens do menu em linha, **seletor de local** (doc 04 §1.1), sino e menu do usuário. < `md`: topbar reduzida (logo + sino + avatar) e **barra inferior** com os itens.
- Conteúdo em `content-portal`.

#### 4.1.3 Área `TECNICO` (`/tecnico`, PWA)

```
┌─────────────────────────────┐
│ Barra de título (56): [‹] Título       [estado de sincronização] │
├─────────────────────────────┤
│ OfflineBanner (se offline)  │
│ Conteúdo (rola; content-pwa)│
├─────────────────────────────┤
│ ActionBar da tela (se houver)│
│ BottomNav (64): Visitas | Notificações │
└─────────────────────────────┘
```

- Barra inferior com **2 itens** (doc 04 §1.1): "Visitas" (`ClipboardList`) e "Notificações" (`Bell` + contador). Fica visível nas telas de 1º nível (TL-200, TL-010); nas telas empilhadas (TL-201 em diante) o `BottomNav` é substituído pela `ActionBar` da tela e o botão `‹` volta.
- Respeitar `env(safe-area-inset-*)` (iOS) no `BottomNav` e `ActionBar`.
- "Minha conta" (TL-005) e "Envios pendentes" (TL-207) abrem por ícones na barra de título da TL-200 [A VALIDAR; o doc 04 só define 2 itens na barra].

#### 4.1.4 Telas de autenticação (`/login`, `/senha/*`) e pública (`/verificar/{codigo}`)

Sem sidebar nem topbar de área; logo centralizado, `Card` em `content-auth` (400 px). TL-007 (pública): mesmo layout, sem menu, sem links para área logada.

### 4.2 Arquitetura de navegação

Nomenclatura = nome de tela do doc 04 §4.0 (sem sinônimos). Itens agrupados por tarefa (proximidade), em ordem de frequência de uso. **Rótulos e agrupamentos são (UI) [A VALIDAR]**; as rotas vêm do doc 04.

#### 4.2.1 Menu do `ADM` (sidebar)

| Ordem | Grupo (`text-h6`) | Item (rótulo) | Tela / rota | Ícone |
|---|---|---|---|---|
| 1 | — (sem grupo) | Painel de pendências | TL-100 `/adm` | `LayoutDashboard` |
| 2 | Operação | Agenda | TL-130 `/adm/agenda` | `CalendarDays` |
| 3 | Cadastros | Clientes | TL-108 `/adm/clientes` | `Building2` |
| 4 | Cadastros | Tipos de equipamento | TL-104 `/adm/tipos` | `Library` |
| 5 | Cadastros | Usuários | TL-106 `/adm/usuarios` | `Users` |
| 6 | Configuração | Empresa e RT | TL-102 `/adm/empresa` | `Briefcase` |
| 7 | Configuração | Pedidos de titular (LGPD) | TL-140 `/adm/lgpd` | `ShieldCheck` |

Acessos **sem item de menu próprio** (entrada por contexto, conforme doc 04): Local (TL-110), Equipamento (TL-111), Contrato (TL-112), PMOC (TL-120) a partir de Cliente → Local; Visita (TL-131) a partir de Agenda/Painel; Certificado (TL-103) a partir de Empresa e RT; Notificações (TL-010) pelo sino; Minha conta (TL-005) e Segundo fator (TL-004) pelo menu do usuário. **Não** criar telas "Contratos", "PMOCs" ou "Equipamentos" de nível superior para o ADM: não existem no doc 04 (se o ADM precisar, é pedido de nova tela, §10).

Item ativo: fundo `action-subtle`, texto `action`, barra esquerda 3 px `action`, `aria-current="page"`. Contador no item "Painel de pendências" = total de pendências [A VALIDAR].

#### 4.2.2 Menu do `CLIENTE`

| Ordem | Item | Tela / rota | Ícone |
|---|---|---|---|
| 1 | Início | TL-300 `/cliente` | `Home` |
| 2 | Cronograma de visitas | TL-301 `/cliente/visitas` | `CalendarDays` |
| 3 | PMOCs | TL-302 `/cliente/pmocs` | `FileText` |
| 4 | Relatórios | TL-304 `/cliente/relatorios` | `ClipboardCheck` |
| 5 | Equipamentos | TL-306 `/cliente/equipamentos` | `Fan` |

No celular, a barra inferior tem **5 itens** (rótulo sempre visível sob o ícone; mínimo recomendado em WCAG/Material). Sino e "Minha conta" na topbar.

#### 4.2.3 Menu do `TECNICO`

"Visitas" (TL-200) e "Notificações" (TL-010) — ver §4.1.3. Nada além disso.

#### 4.2.4 Visibilidade por perfil

| Regra | Descrição |
|---|---|
| FE-N1 | O menu mostra **somente** itens da área do perfil logado (matriz do doc 04 §4.0.1). O servidor continua sendo a única autoridade (PRD §3.1); esconder item não substitui checagem. |
| FE-N2 | Rota de outra área ou recurso de outro cliente → `ForbiddenState` / `NotFoundState` (doc 04 §1.1, regras 2–3). A interface **não** diferencia "não existe" de "não é seu". |
| FE-N3 | Após o login, redirecionar para a tela inicial do perfil (RF-01.4) ou para a rota de retorno (`SESSAO_EXPIRADA`). |
| FE-N4 | Itens de ação dentro das telas (ex.: "Emitir PMOC") seguem a matriz de permissões do PRD §3.2; ação sem permissão **não é renderizada** (não fica desabilitada), pois o perfil nunca poderá usá-la. Ação que o perfil pode usar mas cuja pré-condição falta fica **desabilitada com motivo**. |

### 4.3 Templates de página (ordem exata dos blocos)

Cada tela da §7 declara qual template usa. Blocos em **ordem fixa**; um bloco ausente é omitido, nunca reordenado.

#### T-LIST – Listagem (ex.: TL-108 Clientes, TL-106 Usuários, TL-104 Tipos, TL-304 Relatórios, TL-302 PMOCs, TL-306 Equipamentos)

1. `Breadcrumb` (se nível ≥ 2)
2. `PageHeader`: `h1` + contagem total em `text-muted` + **ação primária de criar** à direita (só se o perfil puder criar; ex.: "Novo cliente")
3. Barra de filtros (§3.5) + chips de filtros ativos
4. `DataTable` (desktop) / lista de `ListCard` (mobile) com `Pagination`
5. Estados vazio/erro/carregando dentro do bloco 4

#### T-DETAIL – Detalhe (ex.: TL-109 Cliente, TL-110 Local, TL-131 Visita, TL-303/TL-305)

1. `Breadcrumb`
2. `PageHeader`: `h1` (nome/código) + `StatusBadge` + ações (primária + menu `…`)
3. `Alert`s de situação (ex.: "Plano alterado após a emissão") — **sempre acima** do conteúdo
4. Resumo (`DescriptionList` em `Card`)
5. `Tabs` ou seções (`Card` por seção) com conteúdo relacionado (listas filhas)
6. `Timeline`/histórico (última seção)

#### T-FORM – Formulário (ex.: TL-107 Usuário, TL-111 Equipamento, TL-112 Contrato, TL-102 Empresa)

1. `Breadcrumb`
2. `PageHeader`: `h1` ("Novo equipamento" / "Editar equipamento {TAG}")
3. `Alert` de erro geral / conflito (UF-07) / bloqueios (ex.: E-06.3)
4. Seções em `Card` (`h2` por seção, 1 coluna de campos; 2 colunas só para pares curtos): ordem = do mais importante/obrigatório ao opcional; agrupamento por proximidade (ex.: "Identificação", "Endereço", "Responsável")
5. `ActionBar` fixa: "Cancelar" (`secondary`) à esquerda do "Salvar" (`primary`); durante envio ambos desabilitados

Largura `content-form` (768 px). Campos de uma seção nunca ultrapassam 6 (lei de Hick); acima disso, dividir em seções recolhíveis (`Accordion`, progressive disclosure) — a 1ª seção sempre aberta.

#### T-DASH – Painel (TL-100 Painel de pendências, TL-300 Início do cliente)

1. `PageHeader`: `h1` + data de atualização ("Atualizado às {HH:mm}") + botão `tertiary` "Atualizar"
2. `Alert` de primeiro uso (ex.: "Configure a empresa, o RT e o certificado")
3. Barra de filtros (TL-100)
4. Faixa de `StatCard`s (resumo; clicáveis, rolam até o grupo)
5. Grupos de pendência em `Card` recolhível, **ordenados por urgência** conforme doc 04 TL-100 (ordem de tabela); cada grupo: título + contagem + lista (máx. 5 linhas visíveis + "Ver todas")
6. Grupos carregam de forma independente (skeleton e erro por grupo)

#### T-REPORT – Relatório/documento (TL-133 e TL-205 Relatório da visita; TL-303 PMOC cliente; TL-305 Relatório cliente)

1. `Breadcrumb` / botão voltar
2. `PageHeader`: título do documento + `StatusBadge` + "Versão {n}"
3. `Alert` de situação (ex.: "Aguardando sua assinatura")
4. Bloco do documento: texto/dados (editor no técnico/ADM; leitura no cliente) ou visualizador de PDF
5. `DescriptionList` de dados da emissão (emitido em, assinaturas, código de verificação)
6. `ActionBar`: ações em ordem — "Baixar PDF" (`secondary`) · … · ação primária (ex.: "Enviar para assinatura", "Assinar")
7. `Timeline` de versões/assinaturas

#### T-EXEC – Execução no celular (TL-200 a TL-207)

1. Barra de título com `‹`, título e indicador de sincronização
2. `OfflineBanner` (condicional)
3. Cabeçalho da tela (local/equipamento + `StatusBadge`)
4. Lista de `ListCard`s ou de `ChecklistItem`s
5. `ActionBar` fixa inferior com **uma** ação primária (`lg`, largura total)

#### T-AUTH – Autenticação (TL-001 a TL-005, TL-007)

Logo → `Card` (`content-auth`) com `h1`, formulário de 1 coluna, botão primário largura total, links `tertiary` abaixo ("Esqueci minha senha"). Sem navegação.

---

## 5. Padrões de interação (iguais em todo o sistema)

Cada padrão tem **uma** forma. Origem: doc 04 §1 (UF/UL/PW) quando existe; o resto é (UI) **[A VALIDAR]**.

### 5.1 As 10 heurísticas de Nielsen aplicadas a este sistema

> Cada regra tem ID `FE-Hn.m` e é referenciada na checklist (§9) e nos fluxos (§8).

#### H1 – Visibilidade do estado do sistema
| ID | Regra |
|---|---|
| FE-H1.1 | Todo estado de entidade usa `StatusBadge` (§2.3) no `PageHeader` e em cada linha/`ListCard`. |
| FE-H1.2 | "Atrasada" (RN-109) é etiqueta adicional `danger` em visitas das listas de TL-100, TL-130, TL-200. |
| FE-H1.3 | Certificado do RT (`A_VENCER`/`VENCIDO`) aparece como `Alert` no TL-100 e em TL-102/TL-103, e como pré-condição em TL-121. |
| FE-H1.4 | Contratos a vencer em até 30 dias (RN-113) mostram "Vence em {n} dias" na lista e no grupo do painel. |
| FE-H1.5 | No PWA, o indicador PW-03 aparece por visita (TL-200), por equipamento (TL-202) e por atividade/foto (TL-203); `OfflineBanner` sempre que offline. |
| FE-H1.6 | Progresso de execução "{x} de {y} atividades" e "{x} de {y} equipamentos" visível na barra inferior de TL-202/TL-203. |
| FE-H1.7 | Toda requisição > 150 ms mostra `Skeleton` (leitura) ou botão em `loading` (escrita). Sem tela em branco (doc 04 §1.2). |
| FE-H1.8 | Contador de notificações (sino) atualiza a cada 60 s e ao voltar à aba (DFT-14). |
| FE-H1.9 | Emissão do PMOC (síncrona, pode levar minutos, A2 a / RNF-16): diálogo TL-121 em estado "Emitindo… isto pode levar alguns minutos. Não feche esta janela." com `Spinner`; o botão fica desabilitado; mostra o tempo decorrido. |

#### H2 – Correspondência entre o sistema e o mundo real
| ID | Regra |
|---|---|
| FE-H2.1 | Termos do glossário e do setor: "Visita", "Equipamento", "TAG", "Ocorrência" no ADM (para o cliente e o técnico, usar "Atividade" [A VALIDAR]), "Contrato", "PMOC", "RT", "ART", "Local", "Cliente". Proibido "OS", "ticket", "job", "registro", "item". |
| FE-H2.2 | Formatos brasileiros: data `dd/mm/aaaa`, hora `HH:mm`, CNPJ, CEP, telefone, vírgula decimal (§6). |
| FE-H2.3 | Ícones literais: `Fan` para equipamento, `FileText` para PMOC, `ClipboardCheck` para relatório, `CalendarDays` para agenda. |

#### H3 – Controle e liberdade do usuário
| ID | Regra |
|---|---|
| FE-H3.1 | Todo diálogo e formulário tem "Cancelar"/"Voltar" sempre visível; Esc fecha diálogos; `‹` no PWA. |
| FE-H3.2 | Sair de formulário web com alteração não salva → confirmação "Descartar alterações?" (UF-08). |
| FE-H3.3 | No PWA: "Limpar marcação" desfaz marcação de atividade; foto excluída pode ser recuperada por "Desfazer" por 8 s no toast [A VALIDAR; exclusão é lógica, `photo [L]`]. |
| FE-H3.4 | Ações em lote nunca se aplicam sem a seleção visível e confirmação do efeito (ver §5.8). |
| FE-H3.5 | Filtros sempre removíveis individualmente (chip `X`) e em conjunto ("Limpar filtros"). |

#### H4 – Consistência e padrões
| ID | Regra |
|---|---|
| FE-H4.1 | Os templates T-* (§4.3) e o menu (§4.3) são a única estrutura permitida. |
| FE-H4.2 | Mesmo verbo para a mesma ação em toda a interface (§6). |
| FE-H4.3 | Posição fixa: ação primária da página no canto superior direito do `PageHeader` e no canto direito da `ActionBar`; "Cancelar" à esquerda. |
| FE-H4.4 | Mesma cor/ícone para o mesmo estado em qualquer tela (tabela §2.3). |
| FE-H4.5 | Mesmos componentes de campo (`FormField`) e mesmas máscaras em toda tela. |

#### H5 – Prevenção de erros
| ID | Regra |
|---|---|
| FE-H5.1 | **Confirmação obrigatória** (UF-09, `AlertDialog` §3.8) em: Emitir PMOC / Emitir nova versão · Enviar relatório para assinatura · Assinar (TL-307) · Finalizar visita · Cancelar visita · Cancelar contrato · Excluir (qualquer entidade ou foto) · Inativar (usuário, cliente, equipamento, tipo, local) · Retirar relatório de assinatura · Redefinir segundo fator. Qualquer outra ação **não** pede confirmação. |
| FE-H5.2 | Pré-condição não atendida → botão **desabilitado com motivo** visível (tooltip desktop / texto abaixo no mobile). Emissão: `PreconditionList` lista **todos** os itens faltantes (RN-007). |
| FE-H5.3 | Validação em tempo real ao sair do campo (UF-01); máscara e `inputMode` corretos; impossível digitar letra em campo numérico/CEP/telefone (CNPJ aceita letras, DM-13). |
| FE-H5.4 | Botão de envio desabilitado durante a requisição (UF-06) + `idempotency_key` no PWA (PW-02). |
| FE-H5.5 | Valor medido: aceita vírgula e ponto; rejeita texto; mostra a unidade ao lado. |
| FE-H5.6 | Datas: `DatePicker` impede data impossível; aviso (não bloqueio) para data fora do mês de referência (RN-072). |
| FE-H5.7 | Botões OK/NOK de 64 px, afastados 12 px entre si; tocar no já marcado não desmarca (evita erro com luva). |
| FE-H5.8 | Conflito de edição: 409 → `ConflictAlert` (UF-07); nada é sobrescrito. |

#### H6 – Reconhecimento em vez de memorização
| ID | Regra |
|---|---|
| FE-H6.1 | Selecionar, nunca digitar, estas entidades: Cliente, Local, Técnico, Tipo de equipamento, Grupo, Atividade, UF, Periodicidade, Mês de referência, Perfil → `Combobox`/`Select`. |
| FE-H6.2 | Texto livre **somente** em: nomes, razão social, nº do contrato, nº da ART, logradouro e demais campos do doc 03 sem domínio fechado, observações, legendas, motivos. |
| FE-H6.3 | Opções de `Combobox` mostram a informação que distingue (razão social + CNPJ mascarado; Local = código + nome; equipamento = TAG + tipo + ambiente). |
| FE-H6.4 | Cabeçalho do equipamento (TAG, tipo, grupo, ambiente, marca, modelo) fica visível durante todo o registro em TL-203. |
| FE-H6.5 | Faltantes na finalização listados com o **motivo** e link direto para o item (TL-204, RN-085). |
| FE-H6.6 | Campo que depende de outro mostra por que está desabilitado (ex.: Local depende de Cliente). |

#### H7 – Flexibilidade e eficiência de uso
| ID | Regra |
|---|---|
| FE-H7.1 | Filtros salvos na URL (UL-02); URLs compartilháveis. |
| FE-H7.2 | Atalhos em lote: "Marcar todas como OK" (TL-132) e "Marcar todas como lidas" (TL-010) — só preenchem itens vazios (DFT-13). |
| FE-H7.3 | Teclado no desktop: `/` foca a busca da lista; `Esc` fecha diálogo; `Enter` envia formulário de linha única; `Tab` ordem lógica. |
| FE-H7.4 | Ação rápida na linha: "Agendar" direto da lista de TL-130 (para `A_AGENDAR`). |
| FE-H7.5 | Painel de pendências leva cada item direto à tela da ação (FL-20), sem passos intermediários. |

#### H8 – Estética e design minimalista
| ID | Regra |
|---|---|
| FE-H8.1 | Cada tela: 1 `h1`, 1 ação primária, no máx. 6 campos visíveis por grupo, no máx. 7 colunas visíveis em tabela (as demais em "Colunas" [A VALIDAR] ou no detalhe). |
| FE-H8.2 | Sem decoração: sem gradientes, sem ilustrações coloridas, sem imagens de fundo. Cor só para ação e estado. |
| FE-H8.3 | Informação rara em disclosure (`Accordion`, "Ver mais"); informação diária visível. |
| FE-H8.4 | Valor vazio mostra "—", nunca espaço em branco nem `null`. |

#### H9 – Ajudar a reconhecer, diagnosticar e corrigir erros
| ID | Regra |
|---|---|
| FE-H9.1 | Mensagem de erro = **o que aconteceu + como corrigir**, em português simples, sem código, junto do campo (UF-01). Ex.: "Informe o valor medido em V." (§6). |
| FE-H9.2 | Salvar com erro: foco no 1º campo inválido + `Alert` de resumo no topo "Corrija {n} campo(s) para salvar" com links para os campos. |
| FE-H9.3 | Erros de regra do servidor (422/409) usam a mensagem do catálogo `E-xx.y` do doc 04, mostrada no campo ou no `Alert`. O ID da regra **não** aparece na tela (doc 04, Convenções). |
| FE-H9.4 | Erro de rede mostra "Não foi possível {ação}. Verifique a conexão e tente novamente." + "Tentar novamente"; dados digitados são preservados. |
| FE-H9.5 | No PWA, falha de envio nunca é silenciosa: "Não enviado – nova tentativa automática" (PW-03) e fila visível em TL-207. |

#### H10 – Ajuda e documentação
| ID | Regra |
|---|---|
| FE-H10.1 | Texto de ajuda (`text-small`) sob o campo quando a regra não é óbvia (ex.: "Código do local: gerado pelo sistema, não pode ser alterado"). |
| FE-H10.2 | Botão desabilitado explica o motivo (FE-H5.2). |
| FE-H10.3 | `EmptyState` explica o que fazer ("As visitas aparecem depois que um PMOC é emitido.", doc 04 TL-130). |
| FE-H10.4 | Ícone `HelpCircle` com `Tooltip` para termos técnicos (ex.: "ART", "TAG", "Periodicidade") — texto do tooltip [A VALIDAR] com o glossário. |
| FE-H10.5 | Não existe central de ajuda/manual no MVP; **não criar**. |

### 5.2 Princípios de UX/UI aplicados

| Princípio | Regra concreta |
|---|---|
| **Hierarquia visual** | Ordem de peso: `h1` (28 px) › ação primária (azul cheio) › `StatusBadge` › corpo › auxiliar. Só **um** elemento azul cheio por tela. Título à esquerda, ação principal à direita, no topo. |
| **Lei de Fitts** | Alvos ≥ 44×44 px (≥ 48 px no PWA; botões OK/NOK 64 px de altura). Ação primária do PWA na `ActionBar` inferior, na área do polegar, largura total. Ações destrutivas afastadas ≥ 16 px da primária. |
| **Lei de Hick** | Máx. 7 itens no menu do ADM, 5 no do cliente, 2 no do técnico. Máx. 1 ação visível por linha + menu `…`. Máx. 6 campos por grupo. Filtros avançados em `Sheet`/disclosure. |
| **Proximidade / agrupamento** | Espaçamentos da §2.5: rótulo↔campo 8, campo↔campo 16, grupo↔grupo 24, seção↔seção 32. Campos relacionados em `Card` com `h2`. |
| **Carga cognitiva** | Uma tarefa por tela no PWA; entidade → atividade → resultado; listas com ≤ 4 informações por `ListCard`; valores padrão do doc quando existirem; não repetir informação entre blocos. |
| **Affordance** | Botão parece botão (preenchido ou com borda); link parece link (cor + sublinhado); linha clicável tem `cursor:pointer`, hover e `ChevronRight` no mobile; campo parece campo (borda 4,76:1); desabilitado parece apagado. |
| **Feedback imediato** | Toque/clique: mudança visual ≤ 100 ms (`active`/`loading`); sucesso: toast ≤ 1 s após a resposta; marcação OK/NOK muda a cor no mesmo instante (gravação local primeiro, PW-01). |
| **Progressive disclosure** | Observação aparece ao marcar NOK/"Requer corretiva"; "Requer corretiva" só com OK; seção opcional recolhida; detalhes de auditoria sob "Ver histórico"; filtros avançados sob "Mais filtros"; formulários longos em seções (`Accordion`). |

### 5.3 Criar, editar e excluir/inativar (padrão único)

| Ação | Padrão | Regras |
|---|---|---|
| **Criar** | Página `T-FORM` própria (`/adm/.../novo` [A VALIDAR rota]) ou `Dialog` quando a criação é curta (≤ 4 campos): agendar visita, resolver pendências. Botão primário **"Salvar"**; após salvar, volta ao detalhe da entidade criada com toast "{Entidade} salva." | Ação "Novo {entidade}" no `PageHeader` da lista. |
| **Editar** | Mesma página `T-FORM` com dados preenchidos; "Editar {entidade}" no detalhe. Salvar → volta ao detalhe + toast. `UPDATE` com `row_version` (UF-07). | Editar nunca altera documento emitido/assinado (RNF-15); a UI esconde "Editar" e mostra "Emitir nova versão" onde o doc 04 manda. |
| **Excluir** | Sempre **exclusão lógica** (nunca física, CLAUDE.md). "Excluir" aparece **só onde o doc 04 prevê**: tipo/grupo/atividade sem uso, cliente sem local, local sem contrato/equipamento, equipamento sem registro, contrato sem PMOC emitido, PMOC em rascunho, foto. Com registro/uso, "Excluir" é trocado por **"Inativar"** (E-07.5); visita e contrato usam **"Cancelar"**. | Sempre `AlertDialog` (FE-H5.1), mostrando o efeito; "Excluir" desabilitado mostra a dica do motivo (E-04.7). |
| **Reativar** | "Reativar" (`secondary`) no detalhe do registro `INATIVO`, sem confirmação [A VALIDAR]. | — |

### 5.4 Confirmação de ações destrutivas ou irreversíveis

Padrão único: `AlertDialog` da §3.8 (FE-C3), para **exatamente** a lista da FE-H5.1 (UF-09). Texto do botão = mesmo verbo do gatilho. Para ações **irreversíveis de alto impacto** (Emitir PMOC, Assinar), o diálogo mostra um resumo do que será gravado (ex.: "Será gerada a versão {n} do PMOC {código} e assinada pelo RT.") e **não** exige digitar nada.

### 5.5 Validação de formulário

| Quando | Onde | Como |
|---|---|---|
| Ao sair do campo (blur) | Abaixo do campo | Mensagem `text-small` `danger-text` + ícone; borda de erro; `aria-invalid`; **não** valida enquanto digita (exceto limpar o erro quando passa a válido) (UF-01) |
| Ao clicar "Salvar" | Todos os campos + resumo | Foco no 1º inválido; `Alert` de resumo com links (FE-H9.2) |
| Resposta do servidor 422 | No campo correspondente (UF-02); erro sem campo → `Alert` no topo | Servidor revalida tudo |
| Campo obrigatório vazio | "Informe {o/a rótulo}." (§6) | — |

Regras: nunca limpar o formulário em erro; nunca mostrar mensagem genérica "Dados inválidos"; mensagens positivas não são usadas (sem "✔ válido" ao lado do campo, exceto CNPJ validado [A VALIDAR]).

### 5.6 Feedback de sucesso e de erro

| Situação | Feedback |
|---|---|
| Salvou/criou/editou | `Toast` sucesso "{Entidade} salva." (5 s) + navegação ao detalhe |
| Ação de estado concluída (Agendada, Emitida, Enviada) | `Toast` sucesso com o novo estado + `StatusBadge` atualizado na tela |
| PWA gravou | Sem toast; indicador PW-03 muda (evita ruído) |
| Erro de validação | Junto do campo (§5.5) |
| Erro de servidor/rede | `Toast` erro persistente com "Tentar novamente" (ação transitória) ou `Alert` (carregamento de tela) |
| Bloqueio por regra (ex.: E-06.3) | `Alert` `danger`/`warning` no topo do formulário/diálogo com a mensagem do doc 04 |

### 5.7 Carregamento

| Situação | Padrão |
|---|---|
| Carga inicial de tela | `Skeleton` do layout final (doc 04 §1.2 `CARREGANDO`); ações desabilitadas |
| Troca de página/filtro em lista | Mantém a tabela com opacidade 60 % + barra de progresso fina (2 px, `action`) no topo da tabela; **não** troca por skeleton |
| Envio de formulário | Botão `loading` (UF-06) |
| Operação longa (emissão do PMOC, geração com IA) | Diálogo/bloco com `Spinner` + mensagem do que acontece + tempo decorrido; não fecha (FE-H1.9); IA: botão "Gerar relatório" vira "Gerando…", com limite de tempo do RNF-10.5; falha → texto manual (RNF-10.4) |
| PWA | Dados do aparelho aparecem de imediato (doc 04 TL-203 "Carregando") |

### 5.8 Busca, filtros e ações em lote

- **Busca/filtros:** §3.5 (URL, chips, limpar). Busca por texto em lista = um campo; por entidade em formulário = `Combobox`.
- **Lote:** só existem estes três casos no MVP — **não criar outros**:

| Lote | Tela | Comportamento |
|---|---|---|
| "Resolver selecionadas" (ocorrências pendentes, mesma visita/mês) | TL-100 → TL-134 | Seleção por `Checkbox`; barra de lote aparece com "{n} selecionadas" + botão; habilitada só com mesma visita/mês (senão motivo visível) |
| "Marcar todas como OK" | TL-132 | Preenche só itens vazios (DFT-13); `AlertDialog` leve "Marcar {n} atividades vazias como OK?" [A VALIDAR] |
| "Marcar todas como lidas" | TL-010 | Sem confirmação; efeito reversível não existe, mas é baixo impacto |

Barra de lote: aparece acima do cabeçalho da tabela, `action-subtle`, "{n} selecionados" · ações · "Limpar seleção"; `aria-live="polite"`.

### 5.9 Desfazer

Não há "Desfazer" genérico no sistema (a prevenção é por confirmação, FE-P6). Exceções, todas (UI) [A VALIDAR]:

| Onde | Desfazer |
|---|---|
| TL-203 | "Limpar marcação" volta a "sem marcação" |
| TL-203 | Toast "Foto excluída" com "Desfazer" por 8 s |
| TL-010 | Nenhum |

Estado de entidade (emitir, cancelar, assinar, finalizar) **nunca** tem desfazer na interface; correção segue o fluxo do doc 04 (ex.: nova versão, FL-09, FL-14).

### 5.10 Erros de rede, permissão e sessão

| Caso | Comportamento |
|---|---|
| Sem rede (web) | `Alert` no topo "Sem conexão. Verifique sua internet." ao falhar uma requisição; ações que gravam ficam em estado normal; ao reconectar, mantém filtros |
| Sem rede (PWA) | `OfflineBanner`; uso normal do que está no aparelho (doc 04 §4.3); botão "Finalizar visita" desabilitado com E-11.12 (DFT-07) |
| 401 | `SESSAO_EXPIRADA`: vai ao TL-001 com retorno à rota; no PWA, **antes** de sair, garante rascunho salvo; mensagem na tela de login "Sua sessão expirou. Entre novamente." |
| 403 | `ForbiddenState` (doc 04 §1.2) |
| 404 / outro cliente | `NotFoundState` idêntico (RN-162) |
| 409 | `ConflictAlert` (UF-07) |
| 5xx / timeout | `ErrorState` (leitura) ou toast de erro (escrita), sem detalhe técnico; erro registrado no Sentry sem dados sensíveis (CLAUDE.md) |

### 5.11 Formulários longos: seções, não wizard

- **Padrão: página única com seções** (`Card` + `h2`), `ActionBar` fixa com "Salvar". Navegação interna por âncoras num índice lateral ("Nesta página") **apenas** se a página tiver ≥ 5 seções [A VALIDAR].
- **Wizard** (passos "Próximo/Anterior") **não é usado**. Única sequência guiada: a emissão do PMOC (TL-121, lista de pré-condições → confirmar) e a assinatura (TL-307, ler → aceitar → confirmar), ambas em `Dialog`.
- TL-105 (tipo, grupos e atividades) e TL-120 (plano e cronograma) são telas de gestão com `Tabs`/seções, não formulários longos.

### 5.12 Salvamento

| Contexto | Padrão |
|---|---|
| **Web (ADM, cliente)** | **Manual**: botão "Salvar" (UF-06, UF-08). Sem autosave. |
| **PWA (técnico)** | **Automático** a cada alteração, primeiro no aparelho (PW-01); indicador PW-03; não existe botão "Salvar" em TL-203. O botão **"Finalizar visita"** é o único passo explícito (UF-09) |
| Editor de texto do relatório (TL-205/TL-133) | Rascunho salvo automaticamente a cada 5 s sem digitar [A VALIDAR] **e** botão "Salvar rascunho"; enviar é ação separada com confirmação |

---

---

## 6. Microcopy e linguagem

### 6.1 Tom de voz (FE-L)

| ID | Regra |
|---|---|
| FE-L1 | pt-BR, voz ativa, "você". Frases de até ~15 palavras. Sem exclamação, sem humor, sem "Ops", sem "Oi". |
| FE-L2 | Diga o que aconteceu e o que fazer. Sem jargão de TI: nunca "erro 500", "payload", "token", "sincronizar" (use "enviar"; exceção: botão "Sincronizar agora" do doc 04 TL-207), "request", "null". |
| FE-L3 | **Os textos entre aspas do doc 04 (§1, §3 `E-xx.y`, §4) prevalecem** sobre qualquer exemplo deste documento. Texto de tela novo segue os padrões de §6.3. |
| FE-L4 | Botão = verbo no infinitivo (+ objeto se preciso). Título de tela = substantivo ("Agenda", "Equipamento TH-…"). Nunca "Clique aqui". |
| FE-L5 | Estado e rótulos: só os de §2.3 (doc 04 §1.5). |

### 6.2 Vocabulário oficial (um termo = um nome)

Fonte: `docs/glossario.md`. Em caso de dúvida, o glossário vence.

| Use | Nunca use | Observação |
|---|---|---|
| Visita | OS, ordem de serviço, chamado, atendimento | D-01 |
| Relatório da visita | laudo, relatório técnico | `visit_report` |
| PMOC | plano, programa (sozinhos) | "Plano" = só a aba Plano do TL-120 |
| Equipamento · TAG | máquina, aparelho, ativo, código | TAG gerada pelo sistema (RN-046) |
| Local | filial, unidade, endereço (como entidade) | `site` |
| Cliente | empresa contratante, conta | `client` |
| Contrato · ART | — | "Nº da ART" |
| Tipo de equipamento · Grupo · Atividade | categoria, modelo, tarefa | Biblioteca (TL-104/105) |
| Ocorrência | — | Só no ADM; para técnico e cliente: "Atividade" [A VALIDAR] |
| Cronograma · Ficha histórico | calendário (do plano), planilha | TL-120 abas |
| Pendência · Pendente | atraso (para ocorrência) | "Atrasada" é só visita (RN-109) |
| Responsável técnico (RT) · Certificado do RT | engenheiro, token | Nunca mostrar arquivo/senha (RN-121) |
| Comprovante de visita | recibo, termo | TL-206 |
| Assinar · Assinatura | aprovar, validar, aceitar (como botão) | "Aceite" só no texto de TL-307 |
| Técnico · ADM · Cliente (perfis) | gestor, admin, usuário comum | Rótulos de perfil na tela [A VALIDAR] |
| Inativar / Reativar / Excluir / Cancelar | remover, apagar, desativar, deletar | §5.3 |
| Periodicidade | frequência | Rótulos de `MM/MB/MT/MS/MA`: do glossário |
| Notificação | alerta (na UI), aviso | — |

### 6.3 Padrões de mensagem

| Tipo | Padrão | Exemplo (entidades reais) |
|---|---|---|
| Campo obrigatório | "Informe {o/a campo}." | "Informe o nº da ART." |
| Formato inválido | "{Campo} inválido. Use {formato}." | "CEP inválido. Use 00000-000." |
| Valor fora da regra | Dizer a regra, não o erro | "A data final deve ser depois da data de início." |
| Bloqueio por pré-condição | "{Ação} indisponível: {motivo}." | "Emitir indisponível: falta o nº da ART do contrato." |
| Sucesso (toast) | "{Entidade} {particípio}." | "Contrato salvo." · "Visita agendada." · "PMOC emitido." · "Relatório enviado para assinatura." |
| Erro de rede | "Não foi possível {verbo no infinitivo}. Verifique a conexão e tente novamente." | "Não foi possível salvar. Verifique a conexão e tente novamente." |
| Erro inesperado | "Algo deu errado. Tente novamente. Se continuar, avise o escritório." | — |
| Carregamento de tela | "Não foi possível carregar. Tente novamente." (doc 04 §1.2) | — |
| Vazio | O que falta + o que fazer | "Nenhum cliente cadastrado." + "Novo cliente" |
| Vazio com filtro | "Nenhum resultado para os filtros." + "Limpar filtros" | — |
| Confirmação (corpo) | Efeito + irreversibilidade (§3.8) | "A visita de 14/03/2027 será cancelada e o técnico será avisado. Esta ação não pode ser desfeita." |
| Sem acesso / não encontrado | Fixos do doc 04 §1.2 | "Você não tem acesso a esta página." |

### 6.4 Rótulos de botões e ações

| Ação | Rótulo | Observação |
|---|---|---|
| Gravar formulário | Salvar | Primário. Nunca "Enviar", "Confirmar" |
| Fechar sem gravar | Cancelar (formulário/diálogo) · Voltar (confirmação, navegação) | Secundário |
| Criar | Novo {entidade} (feminino: Nova) | "Novo cliente", "Novo equipamento", "Nova visita avulsa" |
| Alterar estado do cadastro | Inativar · Reativar · Excluir | §5.3 |
| Visita | Agendar · Remarcar · Trocar técnico · Cancelar visita · Dividir visita · Incluir pendências · Lançar manualmente | doc 04 TL-131 |
| Técnico em campo | Iniciar visita · Revisar e finalizar · Finalizar visita · Coletar comprovante | doc 04 TL-201/204 |
| Marcação | OK · NOK – não efetuado · Limpar marcação | D-05 |
| PMOC | Criar PMOC · Emitir PMOC · Emitir nova versão · Baixar ficha atualizada | doc 04 TL-112/120 |
| Relatório | Gerar texto com IA · Pré-visualizar PDF · Enviar para assinatura do cliente | doc 04 TL-205 |
| Assinatura | Assinar · Confirmar assinatura | doc 04 TL-303/307 |
| Documento | Baixar PDF · Baixar PDF assinado | — |
| Contrato | Renovar · Confirmar renovação · Cancelar contrato | doc 04 TL-112 |
| Filtros | Filtrar · Limpar filtros | — |
| Recuperação | Tentar novamente · Recarregar · Copiar meus dados | UF-07 |
| Sessão | Entrar · Sair · Esqueci minha senha | — |

### 6.5 Formatos (fonte: RNF-07, RNF-12, UF-03/05)

| Dado | Formato | Exemplo |
|---|---|---|
| Data | `dd/mm/aaaa`, fuso `America/Sao_Paulo` | 14/03/2027 |
| Data e hora | `dd/mm/aaaa HH:mm` (24 h) | 14/03/2027 08:30 |
| Hora | `HH:mm` | 08:30 |
| Mês de referência | `mm/aaaa` | 03/2027 |
| Prazo relativo | "Vence em {n} dias", "há {n} dias" (singular "1 dia") | "Vence em 12 dias" |
| Número | milhar `.`, decimal `,`; valor medido aceita `,` e `.` na digitação | 1.234,5 |
| Valor medido | número + espaço + unidade da atividade | 220 V |
| Capacidade | número + espaço + unidade (padrão `BTU/h` [A VALIDAR]) | 60.000 BTU/h |
| Moeda | **Não há campo monetário nos docs.** Se surgir: `R$ 1.234,56` [A VALIDAR] | — |
| CNPJ · CEP · Telefone | `00.000.000/0000-00` (aceita letras, DM-13) · `00000-000` · `(00) 0000-0000` ou `(00) 00000-0000` | — |
| Valor vazio | "—" (nunca `null`, `undefined` ou rótulo sem valor) | — |
| Contagens | "1 equipamento", "2 equipamentos" (concordância correta) | — |
| TAG | `font-mono`, sem alteração | — |

---

## 7. Especificação tela a tela

### 7.1 Como ler esta seção

- **Campos, validações, colunas, estados específicos e regras de cada tela estão no doc 04 §4** (tabelas "Campo / Controle / Obrig. / Validação / Coluna", "Ação", "Estado"). Esta seção **não os repete**: define o template, a ordem dos blocos, o componente de cada controle, as ações e o comportamento mobile.
- Estados `CARREGANDO`, `VAZIO`, `ERRO`, `SEM_ACESSO`, `NAO_ENCONTRADO`, `SESSAO_EXPIRADA`, `OFFLINE`: implementar sempre como doc 04 §1.2, com os componentes de §3.11. Os textos específicos de cada tela vêm da tabela "Estado" dela no doc 04.
- Perfis com acesso: matriz do doc 04 §4.0.1. Ação sem permissão não é renderizada (FE-N4).

### 7.2 Controle do doc 04 → componente

| Controle citado no doc 04 | Componente | Placeholder / máscara |
|---|---|---|
| texto | `Input` | Sem placeholder (rótulo já diz); exemplo só em ajuda quando necessário |
| texto longo / observação | `Textarea` | — |
| busca (cliente, local, tipo…) | `Combobox` | "Buscar {entidade}" |
| lista dependente (Local de Cliente) | `Combobox` desabilitado até o pai ser escolhido, com ajuda "Escolha o cliente primeiro" | — |
| seleção (2–7 opções) | `Select` | "Selecione…" |
| UF | `Combobox` das 27 UFs | "Selecione…" |
| data / período | `DatePicker` / `DateRangePicker` | `dd/mm/aaaa` |
| hora | `TimeField` | `HH:mm` |
| numérico | `Input inputMode="decimal"` + unidade ao lado | — |
| caixa de seleção | `Checkbox` | — |
| CNPJ / CEP / telefone | `Input` com máscara de §3.2 | `00.000.000/0000-00` etc. |
| somente leitura | `DescriptionList` (nunca `Input` desabilitado) | "—" se vazio |
| arquivo | `FileUpload` | — |
| foto | `PhotoCapture` | — |
| senha | `Input type="password"` + mostrar/ocultar | — |

Ajuda (`text-small`) só quando o doc 04 traz regra não óbvia. Campos obrigatórios/opcionais: coluna "Obrig." do doc 04, marcação conforme §3.2.

### 7.3 Telas do fluxo crítico (prioridade 1)

| Tela | Template | Blocos, de cima para baixo | Ação primária / secundárias | Mobile e particularidades |
|---|---|---|---|---|
| **TL-111 Equipamento** (ADM) | T-FORM | Breadcrumb Cliente › Local › Equipamento · `h1` "Novo equipamento" / "Equipamento {TAG}" + `StatusBadge` · `Alert` de impacto (FL-07 passo 4) · Seção **Identificação** (Tipo, Grupo, Ambiente) · Seção **Dados opcionais** (marca, modelo, série, capacidade + unidade) · `ActionBar` | **Salvar** / Cancelar; no detalhe: Inativar, Excluir (se sem registro), Reativar | Tipo → Grupo em cascata (`Combobox`). Prévia da TAG ("será gerada ao salvar") em `DescriptionList`. Tipo somente leitura com registro (E-07.4). Diálogo de impacto (`AlertDialog`) antes de salvar se PMOC emitido |
| **TL-120 PMOC** (ADM) | T-DETAIL com `Tabs` | `PageHeader` (cliente, local, vigência, TH-revisão, `StatusBadge`, versão) · `Alert` "Plano alterado após a emissão"/"PMOC histórico" · Abas **Plano · Cronograma · Versões e assinaturas · Ficha histórico** | **Emitir PMOC** (`RASCUNHO`) ou **Emitir nova versão** / Baixar ficha atualizada, Excluir rascunho | Plano: uma tabela por tipo, periodicidade em `Select`. Cronograma e Ficha: grade com rolagem horizontal **dentro** do componente, coluna "Atividade/Equipamento" fixa à esquerda; células "•" prevista, "Ø" não prevista, e `StatusBadge` compacto (ícone + sigla) na ficha; legenda sempre visível. < 768 px: uma aba por vez, grade rolável |
| **TL-121 Emissão** (diálogo 800 px) | `Dialog` | `PreconditionList` (todos os faltantes, cada um com link "Corrigir") **ou** resumo (cliente, local, vigência, nº de equipamentos, atividades e visitas) + aviso do doc 04 · rodapé | **Emitir PMOC** (desabilitado enquanto houver faltante) / Voltar | Estados: `PROCESSANDO` ("Gerando e assinando o PDF…", `Spinner`, tempo decorrido, sem fechar) → concluído ("PMOC emitido": **Baixar PDF**, Ir para agenda). Mobile: tela cheia |
| **TL-112 Contrato** (ADM) | T-FORM | Faixa de estado · Seção **Vigência** (início, fim, nº de meses) · Seção **Documentos** (ART, código TH, revisão) · Seção **Renovação** (só quando aplicável) · `ActionBar` | **Salvar** / Criar PMOC · Abrir PMOC · Renovar · Confirmar renovação · Cancelar contrato (`destructive-outline` → diálogo com data e motivo obrigatório) · Excluir | `CANCELADO`: tudo somente leitura + `Alert` com data e motivo. "Emitir" desabilitado com a dica do doc 04 |
| **TL-130 Agenda** (ADM) | T-LIST + `SegmentedControl` Lista/Calendário | `PageHeader` + **Nova visita avulsa** · filtros (estado, técnico, cliente, local, período, mês, "Só atrasadas") · Lista (`DataTable`) **ou** Calendário mensal por técnico | **Agendar** (linha `A_AGENDAR`) / Nova visita avulsa | Lista: colunas do doc 04, "Atrasada" como etiqueta. Calendário: grid CSS, chip por visita com hora + local + cor do `StatusBadge`; dia com > 3 visitas mostra "+{n}". < 768 px: só lista (`ListCard`), calendário oculto [A VALIDAR] |
| **TL-131 Visita** (ADM) | T-DETAIL | `PageHeader` (local, mês de referência, `StatusBadge`, "Atrasada") · `Alert` por estado (`CANCELADA`, atrasada) · seções **Itens · Execução · Comprovante · Histórico** (`Timeline` de `visit_schedule_change`) | Ação primária depende do estado: `A_AGENDAR` → **Agendar**; `AGENDADA` → **Remarcar**; `REGISTRADA` → **Abrir relatório**. Demais no menu `…` conforme matriz do doc 04 | Diálogo Agendar/Remarcar: Data, Horário, Técnico, Motivo (opcional, UF-10). Aviso (não bloqueio) fora do mês (RN-072) |
| **TL-203 Execução – equipamento** (técnico) | T-EXEC | Barra de título (TAG + sincronização) · cabeçalho do equipamento (tipo, grupo, ambiente, marca, modelo) · lista de `ChecklistItem` na ordem RN-051 · observação geral · `ActionBar` (anterior · progresso · próximo) | Marcar **OK / NOK – não efetuado** (autossalva) / Próximo equipamento | Especificação completa em §3.13. Teclado numérico para valor. `visit` `REGISTRADA` ou de outro técnico: somente leitura |
| **TL-202 Execução – equipamentos** | T-EXEC | Resumo da visita · `ListCard` por equipamento (TAG, tipo, ambiente, "3 de 14 atividades", barra de progresso, sincronização) · `ActionBar` | **Revisar e finalizar** | Equipamento completo mostra `CheckCircle2` + texto "Completo" |
| **TL-204 Revisar e finalizar** | T-EXEC | Resumo (OK, NOK, fotos, envios pendentes) · faltantes agrupados por equipamento com motivo e link ao item · `ActionBar` | **Finalizar visita** (desabilitado com motivo; confirmação `AlertDialog`) / Coletar comprovante | Sem conexão: botão desabilitado + "Conecte-se para finalizar. Seus dados estão salvos." (E-11.12) |
| **TL-205 / TL-133 Relatório** | T-REPORT | Cabeçalho + `StatusBadge` + versão · `Alert` (falha da IA, conflito) · editor de texto (`Textarea` grande; contador não) · resumo do registro por equipamento (leitura) · `ActionBar` | **Enviar para assinatura do cliente** / Gerar texto com IA, Pré-visualizar PDF, Baixar PDF | Estados `GERANDO` (botão "Gerando…", `Spinner`), `FALHOU` (editor vazio liberado + mensagem E-12.1). Enviado: somente leitura + "Enviado em {data}". ADM (TL-133) acrescenta Retirar, Nova versão, Registrar observação |
| **TL-100 Painel de pendências** | T-DASH | Filtros (cliente, local, técnico, período) · `Alert` de primeiro uso · `StatCard`s · grupos (ordem do doc 04) com contagem | Abrir item → tela da ação (FL-20) / **Resolver selecionadas** (TL-134) | Grupo vazio: recolhido com 0. "Tudo em dia" quando tudo zerado. Mobile: grupos empilhados, `StatCard`s em 2 colunas |
| **TL-134 Resolver pendências** (diálogo 800 px) | `Dialog` | Lista das ocorrências selecionadas com OK/NOK/dispensar/cancelar por linha (controles do doc 04) · observação (obrigatória em NOK, CA-30.1) | **Salvar** / Cancelar | Mobile: tela cheia |
| **TL-300 Início do cliente** | T-DASH | `Alert`s "Aguardando sua assinatura" (PMOC/relatório, com botão **Assinar**) · próximas visitas (`ListCard`) · atalhos | **Assinar** (primeiro documento pendente) | Seletor de local na topbar |
| **TL-303 PMOC / TL-305 Relatório (cliente)** | T-REPORT | Cabeçalho + estado · visualizador do PDF (iframe no desktop; no celular, botão **Baixar PDF** + visualização embutida quando suportada) · dados da emissão · `ActionBar` | **Assinar** (só se aguardando e usuário ativo) / Baixar PDF | Sem botão de editar. TL-303: Baixar ficha atualizada |
| **TL-307 Assinar documento** (diálogo 640 px) | `Dialog` | Texto do aceite (P5 provisório) · `Checkbox` "Li e concordo" · resumo ("Você está assinando {documento}, versão {n}") | **Confirmar assinatura** (desabilitado até marcar) / Cancelar | Mobile: tela cheia. Erros E-17.1 a E-17.6 em `Alert` no topo do diálogo |

### 7.4 Demais telas

Todas seguem o template indicado, o padrão de estados (§7.1) e os controles de §7.2. Só o que foge do padrão está na última coluna.

| Tela | Perfil | Template | Ação primária | Particularidades de UI |
|---|---|---|---|---|
| TL-001 Login | todos | T-AUTH | **Entrar** | Campos E-mail e Senha (mostrar/ocultar); link "Esqueci minha senha"; mensagem de bloqueio e sessão expirada em `Alert`; PWA: mesmo layout |
| TL-002 Esqueci minha senha | todos | T-AUTH | **Enviar link** | Resposta sempre "Se o e-mail estiver cadastrado, você receberá um link." |
| TL-003 Definir nova senha | todos | T-AUTH | **Salvar senha** | Mínimo 8 caracteres (DFT-21) exibido como ajuda |
| TL-004 Segundo fator | ADM | T-AUTH (com `content-form`) | conforme doc 04 | Passos 1–2 em seções numeradas; códigos de recuperação em `font-mono`, com "Copiar" e "Baixar"; enquanto não ativo, é a única rota do ADM |
| TL-005 Minha conta | todos | T-FORM | **Salvar dados** | Seções Dados · Senha · Sessões · Meus dados (LGPD). Sem endereço/foto além do doc 04 |
| TL-007 Verificar documento | pública | T-AUTH | **Verificar** | Resultado: `Alert` sucesso/erro com dados do doc 04; sem menu |
| TL-010 Notificações | todos | T-LIST (lista de `ListCard`) | Abrir notificação → tela alvo | Não lida = ponto + `font-semibold`; **Marcar todas como lidas** no `PageHeader`; atualiza a cada 60 s |
| TL-102 Empresa e RT | ADM | T-FORM | **Salvar empresa** / **Salvar RT** | Duas seções, cada uma com seu botão; logo via `FileUpload`; aviso E-02.7 como `Alert`; endereço UF-04 |
| TL-103 Certificado do RT | ADM | T-FORM | **Enviar certificado** | `FileUpload` + senha; mostra titular, nº de série, emissor, validade e `StatusBadge` do certificado; nunca reexibe arquivo/senha |
| TL-104 Tipos de equipamento | ADM | T-LIST | **Novo tipo** | Filtro "Mostrar inativos" |
| TL-105 Tipo de equipamento | ADM | T-FORM com seções | **Salvar** | Grupos e atividades em tabelas editáveis dentro de `Card`; periodicidade em `Select`; Excluir/Inativar/Reativar conforme uso |
| TL-106 / TL-107 Usuários | ADM | T-LIST / T-FORM | **Novo usuário** / **Salvar** | Perfil não editável após criado (CA-02.5); Cliente obrigatório se perfil Cliente (CA-02.3); Inativar lista visitas futuras do técnico para reatribuir |
| TL-108 / TL-109 Clientes | ADM | T-LIST / T-DETAIL | **Novo cliente** / **Salvar** | TL-109 `Tabs`: **Dados · Locais · Usuários**; CNPJ com máscara alfanumérica; Excluir cliente com motivo |
| TL-110 Local | ADM | T-DETAIL | **Salvar** | `Tabs`: **Dados · Equipamentos · Contratos e PMOC**; código do local somente leitura; "Novo equipamento" na aba Equipamentos; "Novo contrato" na aba Contratos |
| TL-132 Lançamento manual | ADM | T-FORM em tabela | **Finalizar visita** / Salvar rascunho, Salvar correção | Itens em linhas com os mesmos controles de §3.13; **Marcar todas como OK** por equipamento; técnico executor em `Combobox` |
| TL-140 Pedidos de titular | ADM | T-LIST + `Dialog` | **Registrar pedido** | Campos conforme doc 04 |
| TL-200 Minhas visitas | técnico | T-EXEC com `Tabs` **Próximas · Finalizadas** | Tocar visita | `ListCard`: data, horário, local, endereço resumido, nº de equipamentos, `StatusBadge`, "Atrasada", "Relatório não enviado", sincronização; puxar para atualizar; offline: lista guardada + "Atualizado em {hora}" |
| TL-201 Detalhe da visita | técnico | T-EXEC | **Iniciar visita** (`AGENDADA`, com confirmação) / **Continuar visita** (`EM_ANDAMENTO`) [A VALIDAR rótulo] | Endereço com ação "Abrir no mapa" [A VALIDAR]; lista de equipamentos com atividades previstas |
| TL-206 Comprovante | técnico | T-EXEC | **Salvar comprovante** [A VALIDAR rótulo] | `SignaturePad` em tela cheia, campo Nome do responsável, "Limpar"; opcional |
| TL-207 Envios pendentes | técnico | T-EXEC | **Sincronizar agora** | Lista da fila com sincronização por item; **Baixar mais 7 dias**; contador global na barra de título |
| TL-301 Cronograma de visitas | cliente | T-LIST (`ListCard` no celular) | — (somente leitura) | Filtros Próximas · Realizadas · Canceladas; sem ação de edição |
| TL-302 PMOCs · TL-304 Relatórios | cliente | T-LIST | Abrir | Histórico marcado com `StatusBadge` "Histórico" |
| TL-306 Equipamentos | cliente | T-LIST | — | TAG em `font-mono`; filtro por local |

---

## 8. Fluxos de usuário principais

Passos e erros de cada fluxo estão no doc 04 §3. Aqui: **contagem de interações esperada**, decisões, saídas de emergência e heurísticas atendidas. "Toques/cliques" contam interações de navegação e confirmação, **não** digitação de campos.

| Fluxo (doc 04) | Perfil / dispositivo | Passos na interface | Meta de interações | Pontos de decisão | Erros tratados em | Saída de emergência | Heurísticas |
|---|---|---|---|---|---|---|---|
| **FL-07 Cadastrar equipamento** | ADM / desktop | Cliente › Local › aba Equipamentos › Novo equipamento › escolher Tipo, Grupo, Ambiente › Salvar | 5 cliques + campos | Se PMOC emitido: diálogo de impacto (confirmar/voltar) | E-07.1 a E-07.7 | Cancelar volta ao Local; UF-08 pede descartar | H3, H5, H6 (cascata Tipo→Grupo), H10 (prévia da TAG) |
| **FL-08 Criar e emitir PMOC** | ADM / desktop | TL-112 Criar PMOC › (copiar plano anterior? sim/não) › TL-120 Plano (ajustar periodicidade) › Cronograma (conferir) › Emitir PMOC › TL-121 (resolver faltantes **ou** confirmar) › Baixar PDF / Ir para agenda | 6 cliques sem ajuste | Copiar do anterior; faltantes (link "Corrigir" leva à tela e volta) | E-08.1 a E-08.11 (TL-121 lista todos de uma vez) | Voltar no TL-121 não grava nada; emissão em curso: janela não cancela (aviso explícito) | H1 (estado PROCESSANDO), H5 (pré-condições), H9 (lista completa), H6 |
| **FL-10 Agendar visita** | ADM / desktop | TL-100 "Visitas a agendar" ou TL-130 › Agendar (linha) › diálogo (Data, Horário, Técnico) › Agendar | 3 cliques + campos | Data fora do mês: aviso, pode seguir; técnico indisponível não aparece (só ativos) | E-10.x | Cancelar fecha o diálogo; remarcar depois | H7 (atalho na linha), H5, H1 |
| **FL-11 Executar visita** | Técnico / celular | TL-200 › tocar visita › **Iniciar visita** (confirmar) › tocar equipamento › por atividade: **OK/NOK** (+valor/foto/obs.) › Próximo equipamento… › Revisar e finalizar › **Finalizar visita** (confirmar) | 3 toques para começar; **1 toque por atividade** simples; 2 para finalizar | OK com/sem "Requer corretiva"; NOK exige observação; foto obrigatória conforme atividade | E-11.1 a E-11.18 (TL-204 lista faltantes com link) | `‹` volta sem perder dados (autossalvo, PW-01); fechar o app não perde nada (E-11.9) | H1 (progresso e sincronização), H3, H5 (botões 64 px), H6 (cabeçalho fixo), H9 |
| **FL-12 Relatório com IA** | Técnico / celular | Após finalizar: TL-205 › **Gerar texto com IA** › editar › (Pré-visualizar PDF) › **Enviar para assinatura do cliente** (confirmar) | 3 toques | Gerar de novo (confirma substituição); IA falhou → escrever manual | E-12.1 a E-12.9 | Fechar o app: relatório fica rascunho (E-12.6); editor salva sozinho | H1 (GERANDO), H5 (confirmação), H9 (FALHOU com saída), H3 |
| **FL-17 Assinar documento** | Cliente / desktop ou celular | Notificação ou TL-300 › abrir documento › ler PDF › **Assinar** › marcar "Li e concordo" › **Confirmar assinatura** › Baixar PDF assinado | 4 cliques | Documento atualizado entre leitura e assinatura (E-17.3) | E-17.1 a E-17.6 | Cancelar no TL-307 fecha sem gravar | H2 (linguagem do cliente), H5, H1, H10 |
| **FL-20 Tratar pendências** | ADM / desktop | TL-100 › clicar item do grupo › tela da ação (tabela de FL-20) › resolver | 2 cliques até a ação | Resolver em lote (mesma visita/mês) | FL-15 | Voltar ao painel mantém filtros (UL-02) | H1, H7, H8 |

Contagens são metas de projeto [A VALIDAR com teste de uso]; se uma implementação exigir mais interações que a meta, justificar na decisão registrada (§10).

---

## 9. Checklist de conformidade (antes de entregar qualquer tela)

Marque cada item. Item não aplicável: escrever "N/A" e o motivo. Falha em qualquer item = tela não entregue.

| # | Verificação | Como conferir |
|---|---|---|
| **Tokens** | | |
| 1 | Nenhum hex, `rgb()`, `px` arbitrário, `z-[…]`, sombra ou raio solto | `grep` por `#[0-9A-Fa-f]{3,8}`, `\[[0-9]+px\]`, `z-\[` em `src/` fora de `globals.css` → zero |
| 2 | Só classes de token (§2); nenhuma `bg-blue-*`, `text-gray-*`, `slate-*`, `dark:` | `grep` |
| 3 | Fonte, tamanhos e pesos só dos utilitários `text-h1…text-caption` | Visual + `grep` |
| **Componentes** | | |
| 4 | Só componentes de §3; nenhum componente novo sem registro (§10) | Revisão |
| 5 | Template da tela (§4.3) e ordem de blocos respeitados; ação primária única | Revisão |
| 6 | Estado de entidade só via `StatusBadge`; rótulos de §2.3 | Revisão |
| 7 | Campos via `FormField`; seleção em vez de digitação (FE-H6.1); máscaras de §3.2 | Revisão |
| **Estados** | | |
| 8 | `CARREGANDO`, `VAZIO` (com e sem filtro), `ERRO`, `SEM_ACESSO`, `NAO_ENCONTRADO`, `SESSAO_EXPIRADA` implementados; PWA também `OFFLINE` | Testar cada um (mock de 401/403/404/5xx) |
| 9 | Cada controle com default, hover, focus, active, disabled, loading e erro (§3.0.1) | Storybook/teste visual [A VALIDAR] ou revisão |
| 10 | Botão desabilitado explica o motivo; envio duplo impossível (UF-06) | Teste |
| **Acessibilidade** | | |
| 11 | Contraste ≥ 4,5:1 (texto) e ≥ 3:1 (borda de campo, ícone, anel de foco) usando só pares de §2.1.5 | Pares do doc; par novo = cálculo |
| 12 | Foco visível em todo elemento focável; ordem de tabulação lógica; nenhum `outline: none` sem substituto | Teclado: percorrer a tela só com Tab/Shift+Tab/Enter/Esc |
| 13 | Todo campo com `<label>` visível; erro ligado por `aria-describedby`, `aria-invalid`; botão só-ícone com `aria-label` | axe |
| 14 | Estado nunca só por cor: ícone + texto (§2.3) | Revisão |
| 15 | Alvos de toque ≥ 44 px (PWA ≥ 48 px; OK/NOK 64 px); espaço ≥ 8 px entre alvos | Medir no celular 360 px |
| 16 | Diálogos: foco preso, Esc fecha, foco volta ao gatilho; um `h1` por tela; link "Pular para o conteúdo" | Teste de teclado |
| 17 | `prefers-reduced-motion` respeitado | Teste |
| **Responsividade** | | |
| 18 | Sem rolagem horizontal da página em 360, 768, 1024 e 1280 px | Playwright nas 4 larguras |
| 19 | Tabelas viram `ListCard` < 768 px; formulários em 1 coluna; botões de rodapé largura total | Visual |
| 20 | `TL-2xx` desenhadas a 360 px, texto base 16 px, `ActionBar` com safe-area | Visual (emulação de celular) |
| **Microcopy** | | |
| 21 | Termos do §6.2; verbos do §6.4; mensagens do §6.3; textos do doc 04 mantidos literais | `grep` por termos proibidos (OS, laudo, deletar…) |
| 22 | Formatos de §6.5; "—" para vazio; nenhum `null`/`undefined` visível | Revisão |
| **Heurísticas** | | |
| 23 | H1: estado visível, `Skeleton`/`loading`, sincronização no PWA | FE-H1.1–H1.9 |
| 24 | H2: termos e formatos do domínio | FE-H2 |
| 25 | H3: Cancelar/Voltar, Esc, descartar alterações (UF-08) | FE-H3 |
| 26 | H4: template, posição e verbos consistentes | FE-H4 |
| 27 | H5: confirmação apenas nas ações de FE-H5.1; pré-condições com motivo | FE-H5 |
| 28 | H6: seleção em vez de digitação; contexto visível | FE-H6 |
| 29 | H7: filtros na URL, atalhos de lote previstos | FE-H7 |
| 30 | H8: 1 ação primária, sem decoração, vazio = "—" | FE-H8 |
| 31 | H9: erro diz o que fazer, junto do campo; foco no 1º inválido | FE-H9 |
| 32 | H10: ajuda onde a regra não é óbvia; vazio orienta | FE-H10 |
| **Domínio e segurança** | | |
| 33 | Nenhuma regra de negócio reimplementada no cliente; permissão só no servidor (ação sem permissão não renderizada) | Revisão |
| 34 | Nada em log/console com e-mail, token, certificado, texto da IA (CLAUDE.md) | Revisão |
| 35 | Teste (Playwright/Vitest) cita o ID da tela/regra (`TL-xxx`, `RN-xxx`) | Revisão |

---

## 10. Regras de implementação para a IA de desenvolvimento

### 10.1 Faça

| ID | Regra |
|---|---|
| FE-I1 | **Reutilize antes de criar.** Procure em `src/components/ui/` e `src/components/`. Só crie componente novo se nenhum cobrir o caso e o caso se repetir em ≥ 2 telas. |
| FE-I2 | Tokens só em `src/app/globals.css`. Estilo só por classes de token (§2). Nada de `style={{}}` com valores, nem CSS por componente com cores. |
| FE-I3 | Organização: primitivos shadcn em `src/components/ui/`; composições do domínio em `src/components/` (`status-badge/`, `checklist-item/`, `data-table/`…); telas em `src/app/(adm|cliente|tecnico)/…`; formatação em `src/lib/format`; textos fixos reaproveitados em `src/lib/copy.ts` (mapa de rótulos de §2.3 e §6.4). |
| FE-I4 | Nomes: arquivos `kebab-case.tsx`; componentes `PascalCase` em inglês (`StatusBadge`, `ListCard`); variáveis/props `camelCase` em inglês; **texto exibido em português** (§6). Tokens: `--color-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--duration-*`. Prefixos de ID do doc 04 em testes (`TL-111`). |
| FE-I5 | Toda tela nova começa de um template (§4.3) e declara na revisão o `TL-xxx` que implementa. |
| FE-I6 | Server Components por padrão; `"use client"` só onde há interação. Mutação web = Server Action via `next-safe-action` (doc 05); PWA = `/api/sync/v1/*` com `Idempotency-Key` (nunca Server Action no PWA, CLAUDE.md). Erros do servidor mapeados para campos (UF-02). |
| FE-I7 | PWA: gravar primeiro no aparelho (Dexie), depois enviar (PW-01); estado de sincronização sempre visível (PW-03). |
| FE-I8 | Imagens com `next/image` (exceto fotos do PWA em blob local); `alt` descritivo ou `alt=""` se decorativa. |
| FE-I9 | Teste de acessibilidade (axe via Playwright) em cada template e teste visual nas 4 larguras da checklist (#18). |
| FE-I10 | Versões de dependências de UI **exatas, sem `^`** (CLAUDE.md). |

### 10.2 Caso não previsto

1. Procure o padrão mais próximo neste documento (template, componente, padrão de §5) e **siga-o sem inventar variação**.
2. Se envolver regra de negócio, estado, entidade, tela ou perfil que não está nos docs 00–07: **pare e pergunte** (CLAUDE.md).
3. Registre a decisão em `docs/decisoes-frontend.md` (arquivo a criar na primeira ocorrência), uma linha por decisão: `data · tela (TL-xxx) · situação · padrão seguido · componente/arquivo`. Padrão repetido 3 vezes sem estar neste documento = propor inclusão aqui.

### 10.3 Não faça

| # | Proibido |
|---|---|
| 1 | Inventar cor, sombra, raio, tamanho de fonte ou espaçamento fora dos tokens |
| 2 | Criar variante de botão, badge, campo ou diálogo; usar `destructive` sem confirmação; mais de um botão `primary` por tela |
| 3 | Mudar nome de entidade, perfil, estado ou termo do domínio (§6.2, glossário); criar estado novo (ex.: "em dia") |
| 4 | Criar tela, item de menu, perfil ou fluxo que não esteja no doc 04 (ex.: "Contratos" ou "PMOCs" no menu do ADM, busca global, central de ajuda) |
| 5 | Adicionar biblioteca visual, de ícones, de animação, de gráfico ou de tabela fora da lista de §3.0 (inclui `@tanstack/react-table`, MUI, Ant, Framer Motion, Font Awesome) |
| 6 | Implementar modo escuro, tema por usuário ou qualquer item marcado "Fase 2" / "Depois" |
| 7 | Mostrar ao usuário código de erro, ID de regra, stack, `null`, `undefined`, JSON |
| 8 | Esconder permissão só no front; deixar regra de negócio só no cliente |
| 9 | Usar cor como único indicador; remover foco visível; usar `placeholder` no lugar de `label`; `div` clicável no lugar de `button`/`a` |
| 10 | Usar `window.confirm/alert/prompt`; "Sim/Não" como botões de confirmação |
| 11 | Salvar automaticamente na web (só o PWA salva sozinho) ou pedir confirmação em ação fora de FE-H5.1 |
| 12 | Usar emoji ou imagem como ícone; misturar bibliotecas de ícones |
| 13 | Registrar em log/Sentry e-mail, senha, token, certificado, texto/prompt da IA (CLAUDE.md) |

### 10.4 Itens [A VALIDAR] deste documento (resolver com o Patrik; implementar como descrito e isolado)

Logo, nome do sistema e cor de marca · bibliotecas `react-hook-form` e `SignaturePad` · rótulos "Ativo/Inativo", "Continuar visita", "Salvar comprovante" · calendário oculto no celular em TL-130 · "Desfazer" de foto (8 s) · contador no item Painel do menu · marcação "(opcional)" em vez de "(obrigatório)" · metas de interações do §8 · autosave de 5 s do editor de relatório · uso de "Atividade" no lugar de "Ocorrência" para técnico e cliente.
