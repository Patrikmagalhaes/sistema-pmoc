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
    {
      // ADM próprio do spec da emissão: ativa o segundo fator sozinho, sem depender do acesso.spec.
      nome: "Bruno Administrador da Emissão E2E",
      email: "adm.emissao.e2e@exemplo.test",
      senha: "frase longa da emissao",
      perfil: "ADM",
    },
  ],
  /** Dados de demonstração criados pelo servidor (`popularDemo`), lidos pelos specs. */
  demoFile: join(process.cwd(), "tmp", "e2e-demo.json"),
} as const;

/** O primeiro usuário de cada perfil (o ADM da emissão vem depois e é lido por `usuarioPorEmail`). */

export const usuario = (perfil: "ADM" | "CLIENTE" | "TECNICO") =>
  E2E.usuarios.find((u) => u.perfil === perfil) as (typeof E2E.usuarios)[number];

export const usuarioPorEmail = (email: string) =>
  E2E.usuarios.find((u) => u.email === email) as (typeof E2E.usuarios)[number];
