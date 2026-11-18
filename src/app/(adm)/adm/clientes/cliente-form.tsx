"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldRow, Input } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import type { Endereco } from "@/lib/endereco";
import { mascararCnpj, mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarClienteAction, criarClienteAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface ClienteEditavel {
  id: string;
  rowVersion: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  telefone1: string | null;
  telefone2: string | null;
  endereco: Endereco;
}

const digitos = (v: string) => v.replace(/\D/g, "");

/**
 * TL-109 aba Dados (RF-05; FL-04 passo 2). Template T-FORM: seções Identificação, Contato e
 * Endereço; Cancelar/Salvar na ActionBar. Máscara só na tela; grava sem máscara (RF-05.5).
 */
export function ClienteForm({ cliente }: { cliente?: ClienteEditavel }) {
  const novo = !cliente;
  const router = useRouter();
  const pronto = useHidratado();
  const [cnpj, setCnpj] = useState(mascararCnpj(cliente?.cnpj));
  const [tel1, setTel1] = useState(mascararTelefone(cliente?.telefone1 ?? ""));
  const [tel2, setTel2] = useState(mascararTelefone(cliente?.telefone2 ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [existente, setExistente] = useState<string | null>(null);
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, false);
    const dados = {
      razaoSocial: String(f.get("razaoSocial") ?? "").trim(),
      nomeFantasia: String(f.get("nomeFantasia") ?? "").trim() || null,
      cnpj: normalizarCnpj(cnpj),
      telefone1: digitos(tel1) || null,
      telefone2: digitos(tel2) || null,
      endereco,
    };
    if (!dados.razaoSocial) e.razaoSocial = "Informe a razão social.";
    if (!cnpjValido(dados.cnpj)) e.cnpj = "CNPJ inválido."; // E-04.1
    for (const [k, v] of [
      ["telefone1", dados.telefone1],
      ["telefone2", dados.telefone2],
    ] as const)
      if (v && !/^[0-9]{10,11}$/.test(v)) e[k] = "Telefone com 10 ou 11 dígitos.";
    if (!e.telefone2 && dados.telefone2 && !dados.telefone1)
      e.telefone2 = "Preencha o telefone 1 antes."; // E-04.4
    else if (!e.telefone2 && dados.telefone2 && dados.telefone2 === dados.telefone1)
      e.telefone2 = "O telefone 2 repete o 1.";
    setErros(e);
    setExistente(null);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      const nome = primeiro.replace("endereco.", "");
      (form.elements.namedItem(nome) as HTMLElement | null)?.focus(); // UF-01
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarClienteAction(dados))
      : await chamarAcao(
          atualizarClienteAction({ id: cliente.id, rowVersion: cliente.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      setExistente(r.falha?.existenteId ?? null);
      return setGeral(r.mensagem);
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/clientes/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    avisar.sucesso("Dados salvos.");
    router.refresh();
  }

  if (conflito) return <Conflito />;

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      {geral && (
        <Alert
          tom="danger"
          acao={
            existente && (
              <Link href={`/adm/clientes/${existente}`} className={buttonClasses({ size: "sm" })}>
                Abrir o cliente existente
              </Link>
            )
          }
        >
          {geral}
        </Alert>
      )}
      <Card titulo="Identificação">
        <div className="flex flex-col gap-4">
          <Field id="razaoSocial" label="Razão social" erro={erros.razaoSocial}>
            <Input name="razaoSocial" defaultValue={cliente?.razaoSocial} />
          </Field>
          <FieldRow className="lg:grid-cols-2">
            <Field id="nomeFantasia" label="Nome fantasia" opcional>
              <Input name="nomeFantasia" defaultValue={cliente?.nomeFantasia ?? ""} />
            </Field>
            <Field
              id="cnpj"
              label="CNPJ"
              erro={erros.cnpj}
              dica={novo ? "Aceita letras (CNPJ alfanumérico)." : undefined}
            >
              <Input
                name="cnpj"
                value={cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
                className="tabular-nums"
              />
            </Field>
          </FieldRow>
        </div>
      </Card>

      <Card titulo="Contato">
        <FieldRow className="lg:grid-cols-2">
          <Field id="telefone1" label="Telefone 1" opcional erro={erros.telefone1}>
            <Input
              name="telefone1"
              inputMode="tel"
              value={tel1}
              placeholder="(00) 00000-0000"
              onChange={(e) => setTel1(mascararTelefone(e.target.value))}
              className="tabular-nums"
            />
          </Field>
          <Field id="telefone2" label="Telefone 2" opcional erro={erros.telefone2}>
            <Input
              name="telefone2"
              inputMode="tel"
              value={tel2}
              placeholder="(00) 00000-0000"
              onChange={(e) => setTel2(mascararTelefone(e.target.value))}
              className="tabular-nums"
            />
          </Field>
        </FieldRow>
      </Card>

      <Card titulo="Endereço">
        <EnderecoCampos valor={cliente?.endereco} erros={erros} bairroObrigatorio={false} />
      </Card>

      <FormActions>
        {novo ? (
          <Link href="/adm/clientes" className={buttonClasses({ variant: "secondary" })}>
            Cancelar
          </Link>
        ) : (
          <Button
            type="reset"
            disabled={enviando}
            onClick={() => {
              // Volta aos valores salvos (o reset nativo cuida dos campos não controlados).
              setCnpj(mascararCnpj(cliente.cnpj));
              setTel1(mascararTelefone(cliente.telefone1 ?? ""));
              setTel2(mascararTelefone(cliente.telefone2 ?? ""));
              setErros({});
              setGeral(null);
            }}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!pronto} loading={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </FormActions>
    </form>
  );
}
