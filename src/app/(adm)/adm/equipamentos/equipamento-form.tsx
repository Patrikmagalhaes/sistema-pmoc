"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, FieldRow, Input, Select } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { decimalParaCampo, lerDecimal } from "@/lib/numero";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarEquipamentoAction, criarEquipamentoAction } from "./actions";

type Erros = Record<string, string | undefined>;

interface Opcao {
  id: string;
  nome: string;
}

export interface TipoParaNovo extends Opcao {
  previaTag: string;
  grupos: Opcao[];
}

export interface EquipamentoEditavel {
  id: string;
  rowVersion: number;
  tag: string;
  tipoNome: string;
  grupoId: string;
  grupos: Opcao[];
  ambiente: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  capacidade: string | null;
  unidade: string | null;
}

/**
 * TL-111 (RF-09; FL-07). Seções Identificação e Dados opcionais (doc 08 §7.3). Na criação, tipo e
 * grupo vêm só dos `ATIVO` (cascata Tipo → Grupo) e a TAG aparece como prévia (passo 3); depois de
 * salvar, o tipo fica somente leitura (RN-049) e a TAG não muda (RN-046).
 */
export function EquipamentoForm({
  localId,
  tipos,
  equipamento,
  unidadePadrao,
  unidadeMax,
}: {
  localId: string;
  tipos?: TipoParaNovo[];
  equipamento?: EquipamentoEditavel;
  unidadePadrao: string;
  unidadeMax: number;
}) {
  const novo = !equipamento;
  const router = useRouter();
  const pronto = useHidratado();
  const [tipoId, setTipoId] = useState("");
  const tipo = tipos?.find((t) => t.id === tipoId);
  const grupos = novo ? (tipo?.grupos ?? []) : equipamento.grupos;
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const texto = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      grupoId: texto("grupoId"),
      ambiente: texto("ambiente"),
      marca: texto("marca") || null,
      modelo: texto("modelo") || null,
      serie: texto("serie") || null,
      capacidade: texto("capacidade") || null,
      unidade: texto("unidade") || null,
    };
    const e: Erros = {};
    if (novo && !tipoId) e.tipoId = "Escolha o tipo.";
    if (!dados.grupoId) e.grupoId = "Escolha o grupo.";
    if (!dados.ambiente) e.ambiente = "Informe o ambiente."; // CA-09.3
    const capacidade = lerDecimal(dados.capacidade);
    if (capacidade !== null) {
      // E-07.3
      if (Number.isNaN(capacidade))
        e.capacidade = "Capacidade inválida (número com até 2 casas decimais).";
      else if (capacidade <= 0) e.capacidade = "A capacidade deve ser maior que zero.";
      if (!dados.unidade) e.unidade = "Informe a unidade da capacidade.";
      else if (dados.unidade.length > unidadeMax)
        e.unidade = `A unidade tem até ${unidadeMax} caracteres.`;
    }
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarEquipamentoAction({ localId, tipoId, ...dados }))
      : await chamarAcao(
          atualizarEquipamentoAction({
            id: equipamento.id,
            rowVersion: equipamento.rowVersion,
            ...dados,
          }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/equipamentos/${String(r.dados.id)}?aviso=criado`);
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
                rotulo: "TAG",
                valor: equipamento ? (
                  <span className="font-mono">{equipamento.tag}</span>
                ) : tipo ? (
                  <>
                    Será gerada ao salvar: <span className="font-mono">{tipo.previaTag}</span>
                  </>
                ) : (
                  "Escolha o tipo para ver a TAG"
                ),
                ajuda: "Gerada pelo sistema; não muda e não é reaproveitada.",
              },
              ...(novo
                ? []
                : [
                    {
                      rotulo: "Tipo",
                      valor: equipamento.tipoNome,
                      // E-07.4 / RN-049: o tipo compõe a TAG.
                      ajuda: "O tipo compõe a TAG e não muda. Inative e cadastre outro.",
                    },
                  ]),
            ]}
          />
          <FieldRow className="lg:grid-cols-2">
            {novo && (
              <Field id="tipoId" label="Tipo" erro={erros.tipoId}>
                <Select
                  name="tipoId"
                  value={tipoId}
                  onChange={(ev) => setTipoId(ev.target.value)}
                  // Controlado: antes da hidratação a escolha se perderia.
                  disabled={!pronto}
                >
                  <option value="">Selecione…</option>
                  {tipos?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field
              id="grupoId"
              label="Grupo"
              erro={erros.grupoId}
              dica={novo && !tipo ? "Escolha o tipo primeiro." : undefined}
            >
              <Select
                name="grupoId"
                key={novo ? tipoId : equipamento.grupoId}
                defaultValue={novo ? "" : equipamento.grupoId}
                disabled={novo && !tipo}
              >
                <option value="">Selecione…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>
          <Field id="ambiente" label="Ambiente / localização interna" erro={erros.ambiente}>
            <Input
              name="ambiente"
              defaultValue={equipamento?.ambiente}
              placeholder="Ex.: Consultório 03"
            />
          </Field>
        </div>
      </Card>

      <Card titulo="Dados opcionais">
        <div className="flex flex-col gap-4">
          <FieldRow>
            <Field id="marca" label="Marca" opcional>
              <Input name="marca" defaultValue={equipamento?.marca ?? ""} />
            </Field>
            <Field id="modelo" label="Modelo" opcional>
              <Input name="modelo" defaultValue={equipamento?.modelo ?? ""} />
            </Field>
            <Field id="serie" label="Nº de série" opcional>
              <Input name="serie" defaultValue={equipamento?.serie ?? ""} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field id="capacidade" label="Capacidade" opcional erro={erros.capacidade}>
              <Input
                name="capacidade"
                inputMode="decimal"
                defaultValue={decimalParaCampo(equipamento?.capacidade)}
                placeholder="Ex.: 12000"
                className="tabular-nums"
              />
            </Field>
            <Field
              id="unidade"
              label="Unidade da capacidade"
              erro={erros.unidade}
              dica="Obrigatória quando há capacidade."
            >
              <Input
                name="unidade"
                maxLength={unidadeMax}
                defaultValue={equipamento?.unidade ?? unidadePadrao}
              />
            </Field>
          </FieldRow>
        </div>
      </Card>

      <FormActions>
        {novo ? (
          <Link
            href={`/adm/locais/${localId}?aba=equipamentos`}
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
