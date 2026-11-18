"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, FieldRow, Input } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { formatarDataIso } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarContratoAction, criarContratoAction } from "../clientes/actions";

type Erros = Record<string, string | undefined>;

export interface ContratoEditavel {
  id: string;
  rowVersion: number;
  inicio: string;
  fim: string;
  meses: number;
  art: string;
  th: string | null;
  revisao: string | null;
}

/**
 * TL-112 – campos do contrato (RF-07; RN-176), em seções Vigência e Documentos (doc 08 §7.3). Datas
 * somente leitura depois da emissão (E-06.4); tudo somente leitura quando cancelado (E-06.7).
 */
export function ContratoForm({
  localId,
  anteriorId,
  inicioSugerido,
  contrato,
  datasTravadas = false,
  somenteLeitura = false,
}: {
  localId: string;
  /** Renovação (FL-06): contrato anterior do mesmo local. */
  anteriorId?: string;
  /** Renovação: dia seguinte ao fim do anterior (UI). */
  inicioSugerido?: string;
  contrato?: ContratoEditavel;
  datasTravadas?: boolean;
  somenteLeitura?: boolean;
}) {
  const novo = !contrato;
  const router = useRouter();
  const pronto = useHidratado();
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const t = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      inicio: datasTravadas && contrato ? contrato.inicio : t("inicio"),
      fim: datasTravadas && contrato ? contrato.fim : t("fim"),
      art: t("art"),
      th: t("th") || null,
      revisao: t("revisao") || null,
    };
    const e: Erros = {};
    if (!dados.inicio) e.inicio = "Informe a data de início.";
    if (!dados.fim) e.fim = "Informe a data de fim.";
    else if (dados.inicio && dados.fim <= dados.inicio)
      e.fim = "A data de fim deve ser depois da de início."; // E-06.1
    if (!dados.art) e.art = "Informe o nº da ART."; // E-06.3
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarContratoAction({ localId, anteriorId: anteriorId ?? null, ...dados }))
      : await chamarAcao(
          atualizarContratoAction({ id: contrato.id, rowVersion: contrato.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/contratos/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    avisar.sucesso("Contrato salvo.");
    router.refresh();
  }

  if (conflito) return <Conflito />;

  // Cancelado (E-06.7): tudo em leitura (doc 08 §7.2: DescriptionList, nunca campo desabilitado).
  if (somenteLeitura && contrato) {
    return (
      <Card titulo="Dados do contrato">
        <DescriptionList
          itens={[
            { rotulo: "Data de início", valor: formatarDataIso(contrato.inicio) },
            { rotulo: "Data de fim", valor: formatarDataIso(contrato.fim) },
            { rotulo: "Nº de meses", valor: contrato.meses },
            { rotulo: "Nº da ART", valor: contrato.art },
            { rotulo: "Código TH", valor: contrato.th },
            { rotulo: "Revisão", valor: contrato.revisao },
          ]}
        />
      </Card>
    );
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      {geral && <Alert tom="danger">{geral}</Alert>}
      <Card titulo="Vigência">
        {datasTravadas && contrato ? (
          <div className="flex flex-col gap-4">
            <DescriptionList
              className="md:grid-cols-3"
              itens={[
                { rotulo: "Data de início", valor: formatarDataIso(contrato.inicio) },
                { rotulo: "Data de fim", valor: formatarDataIso(contrato.fim) },
                { rotulo: "Nº de meses", valor: contrato.meses },
              ]}
            />
            <p className="text-small text-text-muted">
              Datas travadas após a emissão. Para encerrar antes, cancele o contrato.
            </p>
          </div>
        ) : (
          <FieldRow>
            <Field id="inicio" label="Data de início" erro={erros.inicio}>
              <Input
                name="inicio"
                type="date"
                defaultValue={contrato?.inicio ?? inicioSugerido}
                className="tabular-nums"
              />
            </Field>
            <Field id="fim" label="Data de fim" erro={erros.fim}>
              <Input name="fim" type="date" defaultValue={contrato?.fim} className="tabular-nums" />
            </Field>
            <DescriptionList
              className="md:grid-cols-1"
              itens={[
                {
                  rotulo: "Nº de meses",
                  valor: contrato ? contrato.meses : "Calculado ao salvar",
                },
              ]}
            />
          </FieldRow>
        )}
      </Card>

      <Card titulo="Documentos">
        <FieldRow>
          <Field id="art" label="Nº da ART" erro={erros.art}>
            <Input name="art" defaultValue={contrato?.art} />
          </Field>
          <Field id="th" label="Código TH" opcional erro={erros.th}>
            <Input name="th" maxLength={30} defaultValue={contrato?.th ?? ""} />
          </Field>
          <Field id="revisao" label="Revisão" opcional erro={erros.revisao}>
            <Input name="revisao" maxLength={10} defaultValue={contrato?.revisao ?? ""} />
          </Field>
        </FieldRow>
      </Card>

      <FormActions>
        {novo ? (
          <Link
            href={`/adm/locais/${localId}?aba=contratos`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Cancelar
          </Link>
        ) : (
          <Button
            type="reset"
            disabled={enviando}
            onClick={() => {
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
