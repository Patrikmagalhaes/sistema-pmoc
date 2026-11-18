"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, FieldRow, Input } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import type { Endereco } from "@/lib/endereco";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarLocalAction, criarLocalAction } from "../clientes/actions";

type Erros = Record<string, string | undefined>;

export interface LocalEditavel {
  id: string;
  rowVersion: number;
  codigo: string;
  nome: string;
  telefone: string | null;
  endereco: Endereco;
}

/**
 * TL-110 aba Dados (RF-06; FL-04 passo 3). O código é gerado ao salvar (DM-19) e não muda (RN-047):
 * aparece como somente leitura (doc 08 §7.2, DescriptionList).
 */
export function LocalForm({ clienteId, local }: { clienteId: string; local?: LocalEditavel }) {
  const novo = !local;
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(local?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, false);
    const dados = {
      nome: String(f.get("nome") ?? "").trim(),
      telefone: telefone.replace(/\D/g, "") || null,
      endereco,
    };
    if (!dados.nome) e.nome = "Informe o nome do local.";
    if (dados.telefone && !/^[0-9]{10,11}$/.test(dados.telefone))
      e.telefone = "Telefone com 10 ou 11 dígitos.";
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro.replace("endereco.", "")) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarLocalAction({ clienteId, ...dados }))
      : await chamarAcao(
          atualizarLocalAction({ id: local.id, rowVersion: local.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/locais/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    avisar.sucesso("Dados salvos.");
    router.refresh();
  }

  if (conflito) return <Conflito />;

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      {geral && <Alert tom="danger">{geral}</Alert>}
      <Card titulo="Identificação">
        <div className="flex flex-col gap-4">
          <DescriptionList
            itens={[
              {
                rotulo: "Código",
                valor: local ? (
                  <span className="font-mono">{local.codigo}</span>
                ) : (
                  "Gerado ao salvar"
                ),
                ajuda: "Vai na TAG dos equipamentos e não muda.",
              },
            ]}
          />
          <FieldRow className="lg:grid-cols-2">
            <Field id="nome" label="Nome do local" erro={erros.nome}>
              <Input name="nome" defaultValue={local?.nome} />
            </Field>
            <Field id="telefone" label="Telefone" opcional erro={erros.telefone}>
              <Input
                name="telefone"
                inputMode="tel"
                value={telefone}
                placeholder="(00) 00000-0000"
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                className="tabular-nums"
              />
            </Field>
          </FieldRow>
        </div>
      </Card>
      <Card titulo="Endereço">
        <EnderecoCampos valor={local?.endereco} erros={erros} bairroObrigatorio={false} />
      </Card>
      <FormActions>
        {novo ? (
          <Link
            href={`/adm/clientes/${clienteId}?aba=locais`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Cancelar
          </Link>
        ) : (
          <Button
            type="reset"
            disabled={enviando}
            onClick={() => {
              setTelefone(mascararTelefone(local.telefone ?? ""));
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
