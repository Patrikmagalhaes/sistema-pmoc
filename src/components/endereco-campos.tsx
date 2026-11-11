"use client";
import { useState } from "react";
import { type Endereco, UFS } from "@/lib/endereco";
import { mascararCep } from "@/lib/formato";

/**
 * UF-04 – bloco de endereço: logradouro, nº **ou** "s/n" (desabilita o nº; CA-05.4), complemento
 * opcional (DM-14), bairro, cidade, UF (as 27) e CEP com 8 dígitos (CA-05.3). Os erros chegam com a
 * chave `endereco.<campo>` (UF-02).
 */
export function EnderecoCampos({
  valor,
  erros,
  bairroObrigatorio,
  prefixo = "",
}: {
  valor?: Endereco;
  erros: Record<string, string | undefined>;
  bairroObrigatorio: boolean;
  /** Prefixo dos `id` quando há dois blocos na mesma página (TL-102). */
  prefixo?: string;
}) {
  const [semNumero, setSemNumero] = useState(valor?.semNumero ?? false);
  const [cep, setCep] = useState(mascararCep(valor?.cep));
  const erro = (k: string) =>
    erros[`endereco.${k}`] ? <span className="erro">{erros[`endereco.${k}`]}</span> : null;
  const invalido = (k: string) => Boolean(erros[`endereco.${k}`]);

  return (
    <fieldset className="campo">
      <legend>Endereço</legend>
      <div className="campo">
        <label htmlFor={`${prefixo}logradouro`}>Logradouro</label>
        <input
          id={`${prefixo}logradouro`}
          name="logradouro"
          defaultValue={valor?.logradouro}
          aria-invalid={invalido("logradouro")}
        />
        {erro("logradouro")}
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor={`${prefixo}numero`}>Número</label>
          <input
            id={`${prefixo}numero`}
            name="numero"
            defaultValue={valor?.numero ?? ""}
            disabled={semNumero}
            aria-invalid={invalido("numero")}
          />
          <label className="caixa">
            <input
              type="checkbox"
              name="semNumero"
              checked={semNumero}
              onChange={(e) => setSemNumero(e.target.checked)}
            />
            s/n
          </label>
          {erro("numero")}
        </div>
        <div className="campo">
          <label htmlFor={`${prefixo}complemento`}>Complemento</label>
          <input
            id={`${prefixo}complemento`}
            name="complemento"
            defaultValue={valor?.complemento ?? ""}
          />
        </div>
        <div className="campo">
          <label htmlFor={`${prefixo}bairro`}>Bairro{bairroObrigatorio ? "" : " (opcional)"}</label>
          <input
            id={`${prefixo}bairro`}
            name="bairro"
            defaultValue={valor?.bairro ?? ""}
            aria-invalid={invalido("bairro")}
          />
          {erro("bairro")}
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor={`${prefixo}cidade`}>Cidade</label>
          <input
            id={`${prefixo}cidade`}
            name="cidade"
            defaultValue={valor?.cidade}
            aria-invalid={invalido("cidade")}
          />
          {erro("cidade")}
        </div>
        <div className="campo">
          <label htmlFor={`${prefixo}uf`}>UF</label>
          <select
            id={`${prefixo}uf`}
            name="uf"
            defaultValue={valor?.uf ?? ""}
            aria-invalid={invalido("uf")}
          >
            <option value="">Escolha</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {erro("uf")}
        </div>
        <div className="campo">
          <label htmlFor={`${prefixo}cep`}>CEP</label>
          <input
            id={`${prefixo}cep`}
            name="cep"
            inputMode="numeric"
            value={cep}
            onChange={(e) => setCep(mascararCep(e.target.value))}
            aria-invalid={invalido("cep")}
          />
          {erro("cep")}
        </div>
      </div>
    </fieldset>
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
