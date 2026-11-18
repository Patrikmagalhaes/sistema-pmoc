"use client";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, FieldError, FieldRow, Input } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarTipoAction, criarTipoAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface TipoEditavel {
  id: string;
  rowVersion: number;
  nome: string;
  plural: string | null;
  sigla: string;
  siglaTravada: boolean;
}

const SIGLA = /^[A-Z]{2,5}$/; // E-03.1 [A VALIDAR: formato]

/** TL-105 – dados do tipo (T-FORM). Na criação inclui os grupos (RN-040: ao menos um). */
export function TipoForm({ tipo }: { tipo?: TipoEditavel }) {
  const novo = !tipo;
  const router = useRouter();
  const pronto = useHidratado();
  const [grupos, setGrupos] = useState<{ chave: number; nome: string }[]>([{ chave: 0, nome: "" }]);
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const nome = String(f.get("nome") ?? "").trim();
    const plural = String(f.get("plural") ?? "").trim();
    const sigla = tipo?.siglaTravada
      ? tipo.sigla
      : String(f.get("sigla") ?? "")
          .trim()
          .toUpperCase();
    const gs = grupos.map((g) => g.nome.trim()).filter(Boolean);
    const e: Erros = {};
    if (!nome) e.nome = "Informe o nome.";
    if (!SIGLA.test(sigla)) e.sigla = "A sigla tem de 2 a 5 letras, sem números.";
    if (novo && gs.length === 0) e.grupos = "Inclua ao menos um grupo."; // E-03.2
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (
        form.elements.namedItem(primeiro === "grupos" ? "grupo-0" : primeiro) as HTMLElement | null
      )?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarTipoAction({ nome, plural, sigla, grupos: gs }))
      : await chamarAcao(
          atualizarTipoAction({ id: tipo.id, rowVersion: tipo.rowVersion, nome, plural, sigla }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral(r.mensagem);
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/tipos/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    avisar.sucesso("Dados salvos.");
    router.refresh();
  }

  if (conflito) return <Conflito />;

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      {geral && <Alert tom="danger">{geral}</Alert>}
      <Card titulo="Dados do tipo">
        <div className="flex flex-col gap-4">
          <FieldRow className="lg:grid-cols-2">
            <Field id="nome" label="Nome" erro={erros.nome}>
              <Input name="nome" defaultValue={tipo?.nome} />
            </Field>
            <Field
              id="plural"
              label="Plural"
              opcional
              dica='Usado no PMOC ("2 (dois) Splits"). Em branco, repete o nome.'
            >
              <Input name="plural" defaultValue={tipo?.plural ?? ""} />
            </Field>
          </FieldRow>
          {tipo?.siglaTravada ? (
            <DescriptionList
              itens={[
                {
                  rotulo: "Sigla",
                  valor: <span className="font-mono">{tipo.sigla}</span>,
                  ajuda: "A sigla compõe as TAGs e não pode mudar.",
                },
              ]}
            />
          ) : (
            <Field
              id="sigla"
              label="Sigla"
              erro={erros.sigla}
              dica="2 a 5 letras; vai na TAG do equipamento (ex.: SPL)."
            >
              <Input
                name="sigla"
                defaultValue={tipo?.sigla}
                maxLength={5}
                className="max-w-40 font-mono uppercase"
              />
            </Field>
          )}
        </div>
      </Card>

      {novo && (
        <Card
          titulo="Grupos permitidos"
          descricao="Ao menos um grupo. Os equipamentos deste tipo escolhem um destes grupos."
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Grupos permitidos</legend>
            {grupos.map((g, i) => (
              <div className="flex items-center gap-2" key={g.chave}>
                <Input
                  name={`grupo-${i}`}
                  aria-label={`Grupo ${i + 1}`}
                  value={g.nome}
                  placeholder="Ex.: Hi-Wall"
                  aria-invalid={Boolean(erros.grupos) || undefined}
                  onChange={(e) =>
                    setGrupos(
                      grupos.map((x) => (x.chave === g.chave ? { ...x, nome: e.target.value } : x)),
                    )
                  }
                />
                {grupos.length > 1 && (
                  <Button
                    variant="tertiary"
                    aria-label={`Remover grupo ${i + 1}`}
                    title="Remover"
                    className="px-3"
                    onClick={() => setGrupos(grupos.filter((x) => x.chave !== g.chave))}
                  >
                    <Trash2 size={20} aria-hidden="true" />
                    <span className="sr-only md:not-sr-only">Remover</span>
                  </Button>
                )}
              </div>
            ))}
            <FieldError erro={erros.grupos} />
            <Button
              className="self-start"
              icon={<Plus size={20} aria-hidden="true" />}
              onClick={() =>
                setGrupos([
                  ...grupos,
                  { chave: Math.max(...grupos.map((x) => x.chave)) + 1, nome: "" },
                ])
              }
            >
              Incluir grupo
            </Button>
          </fieldset>
        </Card>
      )}

      <FormActions>
        {novo ? (
          <Link href="/adm/tipos" className={buttonClasses({ variant: "secondary" })}>
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
