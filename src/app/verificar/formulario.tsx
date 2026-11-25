import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Mensagem do código fora do formato (UI). Não consulta o banco nem conta no limite (INT-14). */
export const CODIGO_INVALIDO =
  "Código inválido. Digite os 26 caracteres impressos no rodapé do PDF, com ou sem hífens.";

/**
 * Campo da TL-007. Formulário GET simples (funciona sem JavaScript): `/verificar?codigo=…` confere o
 * formato e redireciona para `/verificar/{codigo}`.
 */
export function FormularioVerificar({
  valor,
  erro,
  rotuloBotao = "Verificar",
}: {
  valor?: string;
  erro?: string | null;
  rotuloBotao?: string;
}) {
  return (
    <form action="/verificar" method="get" noValidate className="flex flex-col gap-4">
      <Field
        id="codigo"
        label="Código de verificação"
        dica="Está no rodapé do PDF, depois de “Código de verificação”."
        erro={erro}
      >
        <Input
          name="codigo"
          required
          defaultValue={valor}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          className="font-mono"
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full">
        {rotuloBotao}
      </Button>
    </form>
  );
}
