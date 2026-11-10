# Runbook – Acesso de emergência (SEG-18)

**Quando usar:** só quando **nenhum** ADM consegue entrar.
**Quem executa:** o operador, direto no banco com o usuário dono (`pmoc_owner`), **junto com o dono
da empresa**. O motivo fica gravado no `audit_log`.
**Fontes:** 06 SEG-17 e SEG-18; 02 RN-141 e RN-194; 03 §5.3.

Não existe "senha mestra" no código. Este procedimento é a única porta fora da aplicação.

## Antes de tudo: o caso é mesmo de emergência?

| Situação | Caminho normal (sem este runbook) |
|---|---|
| Esqueceu a senha | "Esqueci a senha" no login (TL-002). |
| Perdeu o celular, mas tem um código de recuperação | Usa o código no login e depois gera novos códigos na TL-004. |
| Perdeu o celular e os códigos, e **existe outro ADM** que entra | O outro ADM abre a TL-107 → "Redefinir segundo fator", com motivo (SEG-17). |
| ADM inativado por engano, e **existe outro ADM** que entra | O outro ADM abre a TL-107 → "Reativar". |
| **Nenhum** ADM entra (único ADM sem segundo fator e sem códigos, ou único ADM inativo) | **Este runbook.** |

## Passos

1. **Confirme a identidade** da pessoa com o dono da empresa, por um canal fora do sistema (presencial
   ou chamada de vídeo). Anote quem confirmou.
2. Escolha a ação:
   - `SEGUNDO_FATOR`: o ADM está ativo, mas perdeu o aplicativo e os códigos. O script apaga o TOTP, os
     códigos de recuperação e as sessões. No próximo login, a pessoa configura o aplicativo de novo
     (TL-004).
   - `REATIVAR`: o único ADM está inativo. O script volta o ADM para `ATIVO` e retira o banimento. Se ele
     também perdeu o segundo fator, rode de novo com `SEGUNDO_FATOR`.
3. Conecte com o **usuário dono** (`DATABASE_OWNER_URL`), **pela conexão direta, não pelo pooler**. Os
   parâmetros abaixo valem para a sessão inteira.
4. Defina os três parâmetros e rode o arquivo `docs/runbooks/sql/acesso-emergencia.sql`:
   ```sql
   SELECT set_config('emergencia.email', 'pessoa@empresa.com.br', false),
          set_config('emergencia.acao', 'SEGUNDO_FATOR', false),
          set_config('emergencia.motivo', 'SEG-18: perdeu celular e códigos – operador Fulano, dono Beltrano', false);
   \i docs/runbooks/sql/acesso-emergencia.sql
   ```
   - Pelo psql, use `\i`.
   - Pelo editor SQL do Supabase, cole o `SELECT` e o conteúdo do arquivo juntos, numa única execução.
5. Confira se apareceu `NOTICE: concluído (request_id ...)`. Qualquer outra mensagem significa que nada
   foi alterado: o script roda numa transação.
6. Peça à pessoa que entre:
   - Ela informa a senha. Depois de `SEGUNDO_FATOR`, ela também configura o aplicativo e guarda os
     novos códigos.
   - Se ela também esqueceu a senha, usa o "Esqueci a senha".
7. Se o sistema tem só um ADM, crie o segundo **no mesmo dia** pela TL-107 (SEG-17).

## O que fica registrado

| Onde | O quê |
|---|---|
| `audit_log` | `SEGUNDO_FATOR`: uma linha com `table_name = 'auth_user'`, `changed_fields = {two_factor_enabled}`, `source = 'SISTEMA'` e o motivo. `REATIVAR`: o trigger de `app_user` grava a mudança de `status` com o motivo. |
| `security_event` | `SEGUNDO_FATOR`: `MFA_REMOVIDO` e `SESSAO_REVOGADA`, com o mesmo `request_id`. |

Para conferir depois:
```sql
SELECT occurred_at, table_name, record_id, changed_fields, reason
FROM audit_log WHERE source = 'SISTEMA' AND reason LIKE 'SEG-18:%' ORDER BY id DESC;
```

## Mensagens do script

| Mensagem | Significado |
|---|---|
| `defina emergencia.email e emergencia.motivo` | Faltou um parâmetro, ou o motivo está vazio. |
| `nenhum ADM com este e-mail` | O e-mail está errado ou não é de um ADM. |
| `o ADM está INATIVO: execute primeiro com emergencia.acao = REATIVAR` | Rode `REATIVAR` antes. |
| `o ADM não tem segundo fator ativo` | Não há segundo fator para redefinir: no próximo login a pessoa já cai na TL-004. |
| `o ADM já está ATIVO` | `REATIVAR` não é necessário. |

O script é testado em `tests/integration/primeiro-adm.test.ts`.
