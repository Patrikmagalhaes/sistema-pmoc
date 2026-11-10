import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** E-mail de segurança da conta (06 SEG-19; exceção a RN-100, 05 §3.10 decisão B4 a). */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

/**
 * Desenvolvimento: grava o e-mail em `tmp/emails/` (fora do git) em vez de enviar. Não é log: o link de
 * senha precisa chegar a quem testa, e o conteúdo nunca vai para o console (LG-30).
 */
export function fileEmailSender(dir = join(process.cwd(), "tmp", "emails")): EmailSender {
  return {
    async send(msg) {
      mkdirSync(dir, { recursive: true });
      const name = `${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
      writeFileSync(join(dir, name), `Para: ${msg.to}\nAssunto: ${msg.subject}\n\n${msg.text}\n`);
    },
  };
}

/** Testes: guarda as mensagens em memória. */
export function memoryEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(msg) {
      sent.push(msg);
    },
  };
}
