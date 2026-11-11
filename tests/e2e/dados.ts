import { join } from "node:path";

/** Dados fictícios dos testes E2E (06 LG-06), compartilhados pelo servidor e pelos testes. */
export const E2E = {
  port: 3100,
  baseURL: "http://localhost:3100",
  secret: "e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e-0123456789",
  emailDir: join(process.cwd(), "tmp", "e2e-emails"),
  storageDir: join(process.cwd(), "tmp", "e2e-armazenamento"),
  /** 32 bytes em base64, só para o E2E (chave fictícia do certificado). */
  certKey: Buffer.alloc(32, 7).toString("base64"),
  usuarios: [
    {
      nome: "Ana Administradora E2E",
      email: "adm.e2e@exemplo.test",
      senha: "frase longa do adm",
      perfil: "ADM",
    },
    {
      nome: "Carla Cliente E2E",
      email: "cliente.e2e@exemplo.test",
      senha: "frase longa da cliente",
      perfil: "CLIENTE",
    },
    {
      nome: "Tiago Técnico E2E",
      email: "tecnico.e2e@exemplo.test",
      senha: "frase longa do tecnico",
      perfil: "TECNICO",
    },
  ],
} as const;

export const usuario = (perfil: "ADM" | "CLIENTE" | "TECNICO") =>
  E2E.usuarios.find((u) => u.perfil === perfil) as (typeof E2E.usuarios)[number];
