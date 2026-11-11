import { z } from "zod";
import { lerDecimal } from "@/lib/numero";
import { CAPACIDADE_LIMITE, UNIDADE_MAX } from "./domain/equipamento";

const id = z.uuid();
const versao = z.number().int().min(1);
const opcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/**
 * RF-09.2, RF-09.3; RN-045, RN-052; TL-111. A capacidade chega como texto digitado (pt-BR) e vira
 * número; sem capacidade, a unidade não é gravada. O padrão `BTU/h` (RN-052) vem preenchido na tela.
 */
const dadosEquipamento = z
  .object({
    grupoId: z.uuid("Escolha o grupo."),
    // E-07.1 / CA-09.3: ambiente obrigatório.
    ambiente: z.string().trim().min(1, "Informe o ambiente."),
    marca: opcional,
    modelo: opcional,
    serie: opcional,
    capacidade: z
      .string()
      .nullish()
      .transform((v) => lerDecimal(v)),
    unidade: opcional,
  })
  .superRefine((v, ctx) => {
    // E-07.3: capacidade > 0 e com unidade.
    if (v.capacidade === null) return;
    if (Number.isNaN(v.capacidade))
      ctx.addIssue({
        code: "custom",
        path: ["capacidade"],
        message: "Capacidade inválida (número com até 2 casas decimais).",
      });
    else if (v.capacidade <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["capacidade"],
        message: "A capacidade deve ser maior que zero.",
      });
    else if (v.capacidade >= CAPACIDADE_LIMITE)
      ctx.addIssue({
        code: "custom",
        path: ["capacidade"],
        message: "Capacidade acima do limite.",
      });
    if (!v.unidade)
      ctx.addIssue({
        code: "custom",
        path: ["unidade"],
        message: "Informe a unidade da capacidade.",
      });
    else if (v.unidade.length > UNIDADE_MAX)
      ctx.addIssue({
        code: "custom",
        path: ["unidade"],
        message: `A unidade tem até ${UNIDADE_MAX} caracteres.`,
      });
  })
  .transform((v) => ({ ...v, unidade: v.capacidade === null ? null : v.unidade }));

/** FL-07 criar: o local vem da tela de origem e o tipo só aqui (fica fixo depois; RN-049). */
export const criarEquipamentoSchema = z
  .object({ localId: id, tipoId: z.uuid("Escolha o tipo.") })
  .and(dadosEquipamento);
export type CriarEquipamentoInput = z.input<typeof criarEquipamentoSchema>;

export const atualizarEquipamentoSchema = z
  .object({ id, rowVersion: versao })
  .and(dadosEquipamento);
export type AtualizarEquipamentoInput = z.input<typeof atualizarEquipamentoSchema>;

/** TL-111 "Inativar" e "Reativar" [A VALIDAR]. */
export const alterarSituacaoSchema = z.object({
  id,
  rowVersion: versao,
  situacao: z.enum(["ATIVO", "INATIVO"]),
});

export const excluirSchema = z.object({ id, rowVersion: versao, motivo: opcional });
