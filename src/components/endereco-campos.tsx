"use client";
import { useState } from "react";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { type Endereco, UFS } from "@/lib/endereco";
import { mascararCep } from "@/lib/formato";

/**
 * UF-04 – bloco de endereço: logradouro, nº **ou** "s/n" (desabilita o nº; CA-05.4), complemento
 * opcional (DM-14), bairro, cidade, UF (as 27) e CEP com 8 dígitos (CA-05.3). Os erros chegam com a
 * chave `endereco.<campo>` (UF-02). Vai dentro de um Card "Endereço" (doc 08 T-FORM).
 */
export function EnderecoCampos({
  valor,
  erros,
  bairroObrigatorio,
  prefixo = "",
  somenteLeitura = false,
}: {
  valor?: Endereco;
  erros: Record<string, string | undefined>;
  bairroObrigatorio: boolean;
  /** Prefixo dos `id` quando há dois blocos na mesma página (TL-102). */
  prefixo?: string;
  somenteLeitura?: boolean;
}) {
  const [semNumero, setSemNumero] = useState(valor?.semNumero ?? false);
  const [cep, setCep] = useState(mascararCep(valor?.cep));
  const erro = (k: string) => erros[`endereco.${k}`];

  return (
    <div className="flex flex-col gap-4">
      <Field id={`${prefixo}logradouro`} label="Logradouro" erro={erro("logradouro")}>
        <Input name="logradouro" defaultValue={valor?.logradouro} readOnly={somenteLeitura} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*:last-child]:sm:col-span-2">
        <div className="flex flex-col gap-1">
          <Field id={`${prefixo}numero`} label="Número" erro={erro("numero")}>
            <Input
              name="numero"
              defaultValue={valor?.numero ?? ""}
              disabled={semNumero}
              readOnly={somenteLeitura}
            />
          </Field>
          <Checkbox
            label="s/n"
            name="semNumero"
            checked={semNumero}
            disabled={somenteLeitura}
            onChange={(e) => setSemNumero(e.target.checked)}
          />
        </div>
        <Field id={`${prefixo}complemento`} label="Complemento" opcional>
          <Input
            name="complemento"
            defaultValue={valor?.complemento ?? ""}
            readOnly={somenteLeitura}
          />
        </Field>
      </div>
      <Field
        id={`${prefixo}bairro`}
        label="Bairro"
        opcional={!bairroObrigatorio}
        erro={erro("bairro")}
      >
        <Input name="bairro" defaultValue={valor?.bairro ?? ""} readOnly={somenteLeitura} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 [&>*:first-child]:sm:col-span-2">
        <Field id={`${prefixo}cidade`} label="Cidade" erro={erro("cidade")}>
          <Input name="cidade" defaultValue={valor?.cidade} readOnly={somenteLeitura} />
        </Field>
        <Field id={`${prefixo}uf`} label="UF" erro={erro("uf")}>
          <Select name="uf" defaultValue={valor?.uf ?? ""} disabled={somenteLeitura}>
            <option value="">Selecione…</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${prefixo}cep`} label="CEP" erro={erro("cep")}>
          <Input
            name="cep"
            inputMode="numeric"
            value={cep}
            placeholder="00000-000"
            readOnly={somenteLeitura}
            onChange={(e) => setCep(mascararCep(e.target.value))}
            className="tabular-nums"
          />
        </Field>
      </div>
    </div>
  );
}

/** Lê o bloco do `FormData` e valida no cliente antes de enviar (UF-01); o servidor revalida. */
export function lerEndereco(
  f: FormData,
  bairroObrigatorio: boolean,
): { endereco: Endereco; erros: Record<string, string> } {
  const t = (k: string) => String(f.get(k) ?? "").trim();
  const semNumero = f.get("semNumero") === "on";
  const endereco = {
    logradouro: t("logradouro"),
    numero: semNumero ? null : t("numero") || null,
    semNumero,
    complemento: t("complemento") || null,
    bairro: t("bairro") || null,
    cidade: t("cidade"),
    uf: t("uf") as Endereco["uf"],
    cep: t("cep").replace(/\D/g, ""),
  };
  const erros: Record<string, string> = {};
  if (!endereco.logradouro) erros["endereco.logradouro"] = "Informe o logradouro.";
  if (!semNumero && !endereco.numero) erros["endereco.numero"] = "Informe o número ou marque s/n.";
  if (bairroObrigatorio && !endereco.bairro) erros["endereco.bairro"] = "Informe o bairro.";
  if (!endereco.cidade) erros["endereco.cidade"] = "Informe a cidade.";
  if (!(UFS as readonly string[]).includes(endereco.uf)) erros["endereco.uf"] = "Escolha a UF.";
  if (!/^[0-9]{8}$/.test(endereco.cep)) erros["endereco.cep"] = "O CEP tem 8 dígitos.";
  return { endereco, erros };
}
