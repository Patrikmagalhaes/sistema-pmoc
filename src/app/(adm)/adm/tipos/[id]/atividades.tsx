"use client";
import { Camera, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { cn } from "@/lib/cn";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarAtividadeAction, incluirAtividadeAction } from "../actions";
import { AcoesItem } from "./acoes-item";

type Periodicidade = "MM" | "MB" | "MT" | "MS" | "MA";
type Natureza = "VERIFICACAO" | "MEDICAO";

interface Atividade {
  id: string;
  titulo: string;
  periodicidade: Periodicidade;
  natureza: Natureza;
  unidade: string | null;
  exigeFoto: boolean;
  ordem: number;
  situacao: "ATIVO" | "INATIVO";
  rowVersion: number;
  emUso: boolean;
}

/** Rótulos vêm do servidor (módulo `biblioteca`), para não duplicar o enum aqui. */
export interface Rotulos {
  periodicidade: Record<Periodicidade, string>;
  natureza: Record<Natureza, string>;
  unidadeMax: number;
}

const th = "border-b border-border px-4 py-3 text-left text-h5 text-text-label";
const td = "px-4 align-middle md:h-12 md:py-2";

/**
 * TL-105 – atividades padrão, na ordem periodicidade → ordem de exibição (RN-051). Tabela editável
 * dentro do Card (doc 08 §7.4); abaixo de md cada atividade vira um card empilhado.
 */
export function Atividades({
  tipoId,
  atividades,
  rotulos,
}: {
  tipoId: string;
  atividades: Atividade[];
  rotulos: Rotulos;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {atividades.length === 0 ? (
        <p className="text-body text-text-muted">Inclua a primeira atividade.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table
            className="w-full border-collapse text-body max-md:block"
            aria-label="Atividades padrão"
          >
            <thead className="bg-surface-muted max-md:sr-only">
              <tr>
                <th scope="col" className={th}>
                  Título
                </th>
                <th scope="col" className={th}>
                  Periodicidade
                </th>
                <th scope="col" className={th}>
                  Ordem
                </th>
                <th scope="col" className={th}>
                  Natureza
                </th>
                <th scope="col" className={th}>
                  Estado
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {atividades.map((a) => (
                <Fragment key={`${a.id}-${a.rowVersion}`}>
                  <tr
                    className={cn(
                      "border-b border-border-subtle last:border-b-0",
                      "max-md:flex max-md:flex-wrap max-md:gap-x-2 max-md:gap-y-1 max-md:py-3",
                    )}
                  >
                    <td className={cn(td, "font-medium text-text max-md:min-w-0 max-md:flex-1")}>
                      <span className="inline-flex items-center gap-2">
                        {a.titulo}
                        {a.exigeFoto && (
                          <Camera
                            size={16}
                            className="shrink-0 text-text-muted"
                            aria-label="Exige foto"
                          />
                        )}
                      </span>
                    </td>
                    <td
                      className={cn(
                        td,
                        "max-md:order-2 max-md:basis-full max-md:text-small max-md:text-text-muted",
                      )}
                    >
                      {rotulos.periodicidade[a.periodicidade]}
                    </td>
                    <td className={cn(td, "tabular-nums max-md:hidden")}>{a.ordem}</td>
                    <td
                      className={cn(
                        td,
                        "max-md:order-2 max-md:basis-full max-md:text-small max-md:text-text-muted",
                      )}
                    >
                      {rotulos.natureza[a.natureza]}
                      {a.unidade ? ` (${a.unidade})` : ""}
                    </td>
                    <td className={cn(td, "max-md:order-1")}>
                      <StatusBadge tipo="situacao" valor={a.situacao} />
                    </td>
                    <td className={cn(td, "max-md:order-3 max-md:basis-full max-md:pt-2 md:w-px")}>
                      <div className="flex flex-wrap items-start gap-2 md:flex-nowrap md:justify-end">
                        <Button
                          size="sm"
                          variant="tertiary"
                          icon={<Pencil size={16} aria-hidden="true" />}
                          aria-expanded={editando === a.id}
                          onClick={() => setEditando(editando === a.id ? null : a.id)}
                        >
                          {editando === a.id ? "Fechar" : "Editar"}
                        </Button>
                        <AcoesItem
                          compacto
                          alvo="atividade"
                          id={a.id}
                          rowVersion={a.rowVersion}
                          nome={a.titulo}
                          situacao={a.situacao}
                          emUso={a.emUso}
                        />
                      </div>
                    </td>
                  </tr>
                  {editando === a.id && (
                    <tr className="border-b border-border-subtle bg-surface-muted max-md:block">
                      <td colSpan={6} className="p-4 max-md:block">
                        <AtividadeForm
                          tipoId={tipoId}
                          atividade={a}
                          rotulos={rotulos}
                          aoSalvar={(mudouPeriodicidade) => {
                            setEditando(null);
                            // E-03.5: a biblioteca é padrão; PMOCs já criados têm a cópia deles.
                            avisar.sucesso(
                              mudouPeriodicidade
                                ? "Atividade salva. A nova periodicidade não altera PMOCs já criados."
                                : "Atividade salva.",
                            );
                          }}
                          aoCancelar={() => setEditando(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando === "nova" ? (
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <h3 className="mb-4 text-h4 text-text">Nova atividade</h3>
          <AtividadeForm
            tipoId={tipoId}
            rotulos={rotulos}
            aoSalvar={() => {
              setEditando(null);
              avisar.sucesso("Atividade incluída.");
            }}
            aoCancelar={() => setEditando(null)}
          />
        </div>
      ) : (
        <Button
          className="self-start"
          icon={<Plus size={20} aria-hidden="true" />}
          onClick={() => setEditando("nova")}
        >
          Nova atividade
        </Button>
      )}
    </div>
  );
}

function AtividadeForm({
  tipoId,
  atividade,
  rotulos,
  aoSalvar,
  aoCancelar,
}: {
  tipoId: string;
  atividade?: Atividade;
  rotulos: Rotulos;
  aoSalvar: (mudouPeriodicidade: boolean) => void;
  aoCancelar: () => void;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [natureza, setNatureza] = useState<Natureza | "">(atividade?.natureza ?? "");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pre = atividade ? `at-${atividade.id}` : "at-nova";

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const d = {
      titulo: String(f.get("titulo") ?? "").trim(),
      periodicidade: String(f.get("periodicidade") ?? ""),
      natureza: String(f.get("natureza") ?? ""),
      unidade: natureza === "MEDICAO" ? String(f.get("unidade") ?? "").trim() : null,
      exigeFoto: f.get("exigeFoto") === "on",
      ordem: String(f.get("ordem") ?? "").trim(),
    };
    const e: Record<string, string> = {};
    if (!d.titulo) e.titulo = "Informe o título.";
    if (!d.periodicidade) e.periodicidade = "Escolha a periodicidade.";
    if (!d.natureza) e.natureza = "Escolha a natureza.";
    if (d.natureza === "MEDICAO" && !d.unidade) e.unidade = "Informe a unidade da medição."; // E-03.3
    if (!/^-?\d+$/.test(d.ordem)) e.ordem = "A ordem é um número inteiro.";
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const dados = d as typeof d & { periodicidade: Periodicidade; natureza: Natureza };
    const r = atividade
      ? await chamarAcao(
          atualizarAtividadeAction({
            id: atividade.id,
            rowVersion: atividade.rowVersion,
            ...dados,
          }),
        )
      : await chamarAcao(incluirAtividadeAction({ tipoId, ...dados }));
    setEnviando(false);
    if (r.tipo === "conflito")
      return setGeral("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    aoSalvar(Boolean((r.dados as { periodicidadeMudou?: boolean }).periodicidadeMudou));
    router.refresh();
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      {geral && <Alert tom="danger">{geral}</Alert>}
      <Field id={`${pre}-titulo`} label="Título" erro={erros.titulo}>
        <Input name="titulo" defaultValue={atividade?.titulo} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`${pre}-periodicidade`} label="Periodicidade padrão" erro={erros.periodicidade}>
          <Select name="periodicidade" defaultValue={atividade?.periodicidade ?? ""}>
            <option value="">Selecione…</option>
            {Object.entries(rotulos.periodicidade).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${pre}-natureza`} label="Natureza" erro={erros.natureza}>
          <Select
            name="natureza"
            value={natureza}
            onChange={(e) => setNatureza(e.target.value as Natureza)}
          >
            <option value="">Selecione…</option>
            {Object.entries(rotulos.natureza).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={`${pre}-unidade`}
          label="Unidade"
          erro={erros.unidade}
          dica={natureza === "MEDICAO" ? undefined : "Só para medição."}
        >
          <Input
            name="unidade"
            defaultValue={atividade?.unidade ?? ""}
            maxLength={rotulos.unidadeMax}
            disabled={natureza !== "MEDICAO"}
            placeholder={natureza === "MEDICAO" ? "Ex.: V, A, psi" : undefined}
          />
        </Field>
        <Field id={`${pre}-ordem`} label="Ordem" erro={erros.ordem}>
          <Input
            name="ordem"
            inputMode="numeric"
            defaultValue={atividade?.ordem ?? 1}
            className="tabular-nums"
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <Checkbox
          label="Exige foto"
          name="exigeFoto"
          defaultChecked={atividade?.exigeFoto ?? false}
        />
        <p className="text-small text-text-muted">
          A ocorrência só é finalizada com ao menos 1 foto do equipamento na visita (RN-185).
        </p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={enviando} onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!pronto} loading={enviando}>
          {enviando ? "Salvando…" : atividade ? "Salvar atividade" : "Incluir atividade"}
        </Button>
      </div>
    </form>
  );
}
