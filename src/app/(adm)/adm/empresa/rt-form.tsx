"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, Fieldset } from "@/components/ui/card";
import { Field, FieldRow, Input } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import type { Endereco } from "@/lib/endereco";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { salvarRtAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface RtEditavel {
  rowVersion: number;
  nome: string;
  titulo: string;
  registro: string;
  telefone: string;
  email: string;
  endereco: Endereco;
}

/** TL-102 seção Responsável técnico (RF-04.3; DEC-29; FL-02 passo 3): Card com o botão próprio. */
export function RtForm({ rt }: { rt: RtEditavel | null }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(rt?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, true);
    const t = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      nome: t("nome"),
      titulo: t("titulo"),
      registro: t("registro"),
      telefone: telefone.replace(/\D/g, ""),
      email: t("email"),
      endereco,
    };
    if (!dados.nome) e.nome = "Informe o nome do RT.";
    if (!dados.titulo) e.titulo = "Informe o título profissional.";
    if (!dados.registro) e.registro = "Informe o nº de registro.";
    if (!dados.telefone) e.telefone = "Informe o telefone.";
    else if (!/^[0-9]{10,11}$/.test(dados.telefone)) e.telefone = "Telefone com 10 ou 11 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) e.email = "E-mail inválido.";
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro.replace("endereco.", "")) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = await chamarAcao(salvarRtAction({ rowVersion: rt?.rowVersion ?? null, ...dados }));
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    avisar.sucesso("Dados do RT salvos.");
    router.refresh();
  }

  if (conflito) return <Conflito />;

  return (
    <form onSubmit={salvar} noValidate aria-labelledby="titulo-rt">
      <Card
        titulo={<span id="titulo-rt">Responsável técnico (RT)</span>}
        descricao="O RT assina o PMOC com o certificado e-CPF."
        rodape={
          <Button type="submit" variant="primary" disabled={!pronto} loading={enviando}>
            {enviando ? "Salvando…" : "Salvar RT"}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          {geral && <Alert tom="danger">{geral}</Alert>}
          <div className="flex flex-col gap-4">
            <Field id="rt-nome" label="Nome do RT" erro={erros.nome}>
              <Input name="nome" defaultValue={rt?.nome} />
            </Field>
            <FieldRow className="lg:grid-cols-2">
              <Field id="rt-titulo" label="Título profissional" erro={erros.titulo}>
                <Input name="titulo" defaultValue={rt?.titulo} />
              </Field>
              <Field id="rt-registro" label="Nº de registro" erro={erros.registro}>
                <Input name="registro" defaultValue={rt?.registro} />
              </Field>
              <Field id="rt-telefone" label="Telefone do RT" erro={erros.telefone}>
                <Input
                  name="telefone"
                  inputMode="tel"
                  value={telefone}
                  placeholder="(00) 00000-0000"
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  className="tabular-nums"
                />
              </Field>
              <Field id="rt-email" label="E-mail do RT" erro={erros.email}>
                <Input name="email" type="email" defaultValue={rt?.email} />
              </Field>
            </FieldRow>
          </div>
          <Fieldset legenda="Endereço">
            <EnderecoCampos
              valor={rt?.endereco}
              erros={erros}
              bairroObrigatorio={true}
              prefixo="rt-"
            />
          </Fieldset>
        </div>
      </Card>
    </form>
  );
}
