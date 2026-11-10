import { z } from "zod";

/** RN-178, RN-169, RF-02. O perfil é fixo depois de criado (RN-179). */
export const criarUsuarioSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome."),
    email: z.email("E-mail inválido.").trim().toLowerCase(),
    perfil: z.enum(["ADM", "TECNICO", "CLIENTE"]),
    clientId: z.uuid().nullish(),
    // RF-02.3: só dígitos, 10 ou 11 [A VALIDAR] (03 §2.1).
    telefone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v === "" || /^[0-9]{10,11}$/.test(v), "Telefone com 10 ou 11 dígitos.")
      .transform((v) => (v === "" ? null : v))
      .nullish(),
  })
  .refine((v) => (v.perfil === "CLIENTE") === (v.clientId != null), {
    message: "Usuário do cliente exige o cliente; os demais perfis não têm cliente (RN-169).",
    path: ["clientId"],
  });

export type CriarUsuarioInput = z.input<typeof criarUsuarioSchema>;

export const alterarSituacaoSchema = z.object({
  id: z.uuid(),
  rowVersion: z.number().int().min(1),
});
