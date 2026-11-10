# Runbook – Primeiro ADM de um banco novo

**Quando usar:** logo depois de criar o banco (`pnpm db:migrate`), quando ainda não existe nenhum
`ADM`. Sem ADM não há quem use a tela de usuários (TL-107).
**Quem executa:** o operador, junto com a pessoa que será o primeiro ADM.
**Fontes:** 04 DFT-01 e FL-01; 02 RN-194; 06 SEG-05, SEG-06, SEG-15 e SEG-17.

## O que o comando faz e o que não faz

- O comando é `pnpm adm:primeiro`. Ele cria o usuário `ADM` (`auth_user` + `app_user`) **sem senha** e
  envia por e-mail o link "Definir senha", que vale 72 horas e só pode ser usado uma vez.
- Ele recusa a execução se já existir qualquer ADM, ativo ou inativo. A partir daí:
  - ADM novo se cria pela TL-107.
  - Para recuperar acesso, veja `acesso-emergencia.md`.
- Ele não aceita senha na linha de comando e não imprime o link nem o e-mail (LG-30 a LG-33). Não
  existe "senha mestra" (SEG-18).

## Pré-requisitos

1. As migrações estão aplicadas (`pnpm db:migrate`).
2. As variáveis `DATABASE_URL` (papel `app_rw`), `BETTER_AUTH_SECRET` e `APP_URL` vêm do ambiente ou
   do arquivo `.env.local`.
3. **O envio de e-mail funciona.**
   - Em desenvolvimento, o e-mail é gravado em `tmp/emails` (ou em `EMAIL_DEV_DIR`).
   - Em produção, o envio real (Resend) ainda não está configurado. Até lá, o comando falha com
     "Envio de e-mail de produção ainda não configurado" e **não deixa usuário criado**.

## Passos

1. Rode o comando:
   ```
   pnpm adm:primeiro --nome "Nome Completo" --email pessoa@empresa.com.br [--telefone 11999998888]
   ```
2. Confira se apareceu "ADM criado. O link para definir a senha foi enviado por e-mail (vale 72 horas)."
3. A pessoa abre o link, define a senha (TL-003) e entra.
4. No primeiro login, o sistema só mostra a tela de segundo fator (TL-004, RN-194).
   - A pessoa lê o QR code no aplicativo autenticador e confirma o código.
   - A pessoa **guarda os 10 códigos de recuperação** em lugar seguro, fora do celular.
5. Pela TL-107, a pessoa cria **pelo menos mais um ADM** e ele ativa o segundo fator (SEG-17: mínimo
   de 2 ADMs ativos com segundo fator; GL-04). Sem o segundo ADM, perder o celular e os códigos só tem
   saída pelo `acesso-emergencia.md`.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| "Já existe administrador..." | Não é banco novo. Use a TL-107 ou `acesso-emergencia.md`. |
| "Este e-mail já está em uso." | O e-mail já pertence a outro usuário. Use outro e-mail. |
| Falha no envio do e-mail | Nada fica criado. Corrija o envio e rode de novo. |
| O link venceu (72 h) | Rode o comando de novo só se ainda não existir ADM. Se já existir, use "Reenviar link de senha" na TL-107, ou peça pelo "Esqueci a senha" (TL-002). |
