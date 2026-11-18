# Decisões de front-end (doc 08 §10.2)

Uma linha por decisão: `data · tela (TL-xxx) · situação · padrão seguido · componente/arquivo`.

- 18/11/2026 · todas · Diálogo e confirmação sem Radix · `<dialog>` nativo com `showModal()` (foco preso, Esc, foco volta ao gatilho, FE-C3), sem dependência nova · `src/components/ui/dialog.tsx`
- 18/11/2026 · todas · `Select` em desktop · `<select>` nativo estilizado também no desktop (§3.3 permite no celular); Radix Select só se faltar algo · `src/components/ui/field.tsx`
- 18/11/2026 · TL-112, TL-131 · `DatePicker` · mantido `<input type="date">` nativo; `react-day-picker` [A VALIDAR] entra quando a agenda (TL-130) exigir · `contrato-form.tsx`, `contratos/[id]/acoes.tsx`
- 18/11/2026 · TL-106, TL-107, TL-111 · `Combobox` (cliente, tipo) · `Select` nativo enquanto as listas são curtas; `cmdk` [A VALIDAR] quando a lista crescer · telas de usuários e equipamentos
- 18/11/2026 · todas as listas · `DataTable` × `ListCard` · uma única `<table>` que vira card por CSS abaixo de md (sem duplicar conteúdo para leitor de tela e testes); linha inteira clicável pelo link do texto principal · `src/components/ui/data-table.tsx`
- 18/11/2026 · menu do ADM · itens de telas ainda não construídas · menu do §4.2.1 só com as telas existentes; Agenda (TL-130) e Pedidos de titular (TL-140) entram nas etapas delas · `src/components/layout/adm-shell.tsx`
- 18/11/2026 · TL-100 · painel ainda sem grupos de pendência · `EmptyState` com atalho para os cadastros até a etapa da agenda · `src/app/(adm)/adm/page.tsx`
- 18/11/2026 · TL-120 · "Remover" atividade do plano · sem confirmação (é reversível por "Voltar ao plano"; FE-P6, FE-H5.1) · `pmocs/[id]/plano.tsx`
- 18/11/2026 · TL-105, TL-107, TL-111 · "Reativar" · sem confirmação (§5.3) · `acoes-item.tsx`, `usuarios/[id]/acoes.tsx`, `equipamentos/[id]/situacao.tsx`
- 18/11/2026 · todas · botão de confirmação · mesmo verbo do gatilho + objeto ("Inativar usuário", "Excluir local", "Cancelar contrato"), nunca "Confirmar …" genérico (FE-C3 item 5) · `ConfirmDialog`
- 18/11/2026 · TL-102, TL-005 · duas seções com botão próprio na mesma tela · botão no rodapé do Card de cada seção, não na ActionBar fixa · `empresa-form.tsx`, `rt-form.tsx`, `conta/*`
- 18/11/2026 · TL-005 · moldura da "Minha conta" · abre dentro da moldura do perfil (sidebar do ADM; topo do portal/app) · `src/app/conta/page.tsx`
- 18/11/2026 · todas · formulários · mantido `useState` + `FormData` + server action; `react-hook-form` [A VALIDAR] não adotado · formulários
- 18/11/2026 · todas · UF-08 (aviso ao sair com alteração não salva) · **pendente**: não implementado nesta revisão (já não existia) · —
