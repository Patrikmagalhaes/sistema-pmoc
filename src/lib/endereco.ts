import { z } from "zod";

/** 03 bloco `[E]`: as 27 UFs do `CHECK` de `address_state`. */
export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export interface Endereco {
  logradouro: string;
  numero: string | null;
  semNumero: boolean;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: (typeof UFS)[number];
  cep: string;
}

const opcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

/**
 * UF-04 (bloco `[E]`): logradouro, nº **ou** "s/n" (CA-05.4), complemento opcional (DM-14), bairro
 * obrigatório só em empresa e RT, cidade, UF e CEP com 8 dígitos (CA-05.3). Gravado sem máscara (RF-05.5).
 */
export function enderecoSchema(opcoes: { bairroObrigatorio: boolean }) {
  return z
    .object({
      logradouro: z.string().trim().min(1, "Informe o logradouro."),
      numero: opcional,
      semNumero: z.boolean().default(false),
      complemento: opcional,
      bairro: opcional,
      cidade: z.string().trim().min(1, "Informe a cidade."),
      uf: z.enum(UFS, "Escolha a UF."),
      cep: z
        .string()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => /^[0-9]{8}$/.test(v), "O CEP tem 8 dígitos."),
    })
    .superRefine((v, ctx) => {
      if (!v.semNumero && !v.numero)
        ctx.addIssue({
          code: "custom",
          path: ["numero"],
          message: "Informe o número ou marque s/n.",
        });
      if (opcoes.bairroObrigatorio && !v.bairro)
        ctx.addIssue({ code: "custom", path: ["bairro"], message: "Informe o bairro." });
    })
    .transform((v) => ({ ...v, numero: v.semNumero ? null : v.numero }));
}

/** Telefone opcional só com dígitos, 10 ou 11 [A VALIDAR] (03 §2.1, §2.3). */
export const telefoneOpcional = z
  .string()
  .nullish()
  .transform((v) => (v ?? "").replace(/\D/g, ""))
  .refine((v) => v === "" || /^[0-9]{10,11}$/.test(v), "Telefone com 10 ou 11 dígitos.")
  .transform((v) => (v === "" ? null : v));
