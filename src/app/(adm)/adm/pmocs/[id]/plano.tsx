"use client";
import { Camera, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao, type Desfecho } from "@/lib/chamar-acao";
import { cn } from "@/lib/cn";
import { useHidratado } from "@/lib/use-hidratado";
import type { ResultadoRecalculo, TipoNoPlano } from "@/modules/pmoc";
import {
  alterarPeriodicidadeAction,
  incluirDaBibliotecaAction,
  incluirNovaAction,
  previaDaMudancaAction,
  removerAtividadeAction,
  restaurarAtividadeAction,
} from "../actions";
import { CONFLITO, resumoDoRecalculo, useMudancaComImpacto } from "./impacto";

type Periodicidade = "MM" | "MB" | "MT" | "MS" | "MA";
type Natureza = "VERIFICACAO" | "MEDICAO";

/** Rótulos vêm do servidor (módulo `biblioteca`), para não duplicar o enum aqui. */
export interface RotulosPlano {
  periodicidades: { valor: Periodicidade; rotulo: string }[];
  periodicidade: Record<Periodicidade, string>;
  natureza: Record<Natureza, string>;
  unidadeMax: number;
  motivoMax: number;
}

type Gravacao = Desfecho<
  | { ok: true; recalculo?: ResultadoRecalculo | null }
  | { ok: false; codigo: string; mensagem: string }
>;

/** Mensagem da tela para o desfecho da action (UF-02, UF-07); `null` = deu certo. */
const falha = (r: Gravacao) =>
  r.tipo === "conflito" ? CONFLITO : r.tipo === "erro" ? r.mensagem : null;

/** Toast de sucesso, com o que o recálculo mudou quando o PMOC está emitido (FL-09 passo 3). */
const sucesso = (texto: string, r: Gravacao) =>
  avisar.sucesso(
    [texto, r.tipo === "ok" ? resumoDoRecalculo(r.dados.recalculo) : null]
      .filter(Boolean)
      .join(" "),
  );

const th = "border-b border-border px-4 py-3 text-left text-h5 text-text-label";
const td = "px-4 align-middle md:h-12 md:py-2";

/** O que cada linha e o "Incluir" precisam saber do PMOC. */
interface Contexto {
  pmocId: string;
  podeAlterar: boolean;
  /** FL-09: PMOC emitido; toda mudança passa pelo diálogo de impacto. */
  emitido: boolean;
  rotulos: RotulosPlano;
}

/**
 * TL-120 aba Plano: uma tabela por tipo (doc 08 §7.3), atividades na ordem da RN-051. Periodicidade
 * em `Select` vale para todos os equipamentos do tipo neste PMOC (RN-026); remover e incluir
 * atividade (RF-10.3). Em `RASCUNHO`, remover é reversível ("Voltar ao plano") e não pede confirmação
 * (FE-P6). Emitido, toda mudança mostra antes o impacto no cronograma e nas visitas (FL-09).
 */
export function Plano({ tipos, ...c }: Contexto & { tipos: TipoNoPlano[] }) {
  return (
    <div className="flex flex-col gap-6">
      {c.podeAlterar && (
        <Alert tom="info">
          A periodicidade vale para todos os equipamentos do tipo neste PMOC. A biblioteca não muda.
          {c.emitido && " Com o PMOC emitido, o cronograma muda só nos meses após o corrente."}
        </Alert>
      )}
      {tipos.map((t) => (
        <BlocoTipo key={t.id} tipo={t} c={c} />
      ))}
    </div>
  );
}

function BlocoTipo({ tipo, c }: { tipo: TipoNoPlano; c: Contexto }) {
  const { podeAlterar } = c;
  const [incluindo, setIncluindo] = useState(false);
  return (
    <Card
      titulo={tipo.nome}
      descricao={`${tipo.equipamentosAtivos} ${
        tipo.equipamentosAtivos === 1 ? "equipamento ativo" : "equipamentos ativos"
      }`}
      acao={
        podeAlterar &&
        !incluindo && (
          <Button icon={<Plus size={20} aria-hidden="true" />} onClick={() => setIncluindo(true)}>
            Incluir atividade
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {tipo.atividades.length === 0 ? (
          <p className="text-body text-text-muted">Nenhuma atividade deste tipo no plano.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-subtle">
            <table
              className="w-full border-collapse text-body max-md:block"
              aria-label={`Atividades de ${tipo.nome}`}
            >
              <thead className="bg-surface-muted max-md:sr-only">
                <tr>
                  <th scope="col" className={th}>
                    Atividade
                  </th>
                  <th scope="col" className={th}>
                    Natureza
                  </th>
                  <th scope="col" className={th}>
                    Periodicidade
                  </th>
                  {podeAlterar && (
                    <th scope="col" className={th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="max-md:block">
                {tipo.atividades.map((a) => (
                  <LinhaAtividade key={`${a.id}-${a.rowVersion}`} atividade={a} c={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {podeAlterar && incluindo && (
          <Incluir tipo={tipo} c={c} fechar={() => setIncluindo(false)} />
        )}
      </div>
    </Card>
  );
}

function LinhaAtividade({
  atividade: a,
  c: { podeAlterar, emitido, rotulos },
}: {
  atividade: TipoNoPlano["atividades"][number];
  c: Contexto;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState<"periodicidade" | "remover" | null>(null);
  /** Controlada: "Voltar" no diálogo de impacto devolve a periodicidade gravada. */
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(a.periodicidade);
  const impacto = useMudancaComImpacto(rotulos.motivoMax);

  /** Grava e avisa; devolve a mensagem de erro ou `null`. */
  async function gravar(
    qual: "periodicidade" | "remover",
    p: Promise<Gravacao>,
    texto: string,
  ): Promise<string | null> {
    setEnviando(qual);
    const r = await p;
    setEnviando(null);
    const erro = falha(r);
    if (erro) return erro;
    sucesso(texto, r);
    router.refresh(); // RN-006 (rascunho) e FL-09 (emitido): a TL-120 relê plano e cronograma
    return null;
  }

  async function mudar(nova: Periodicidade) {
    setPeriodicidade(nova);
    const voltar = () => setPeriodicidade(a.periodicidade);
    const salvar = (motivo: string | null) =>
      gravar(
        "periodicidade",
        chamarAcao(
          alterarPeriodicidadeAction({
            id: a.id,
            rowVersion: a.rowVersion,
            periodicidade: nova,
            motivo,
          }),
        ),
        `"${a.titulo}" passou a ${rotulos.periodicidade[nova]}.`,
      );
    const erro = emitido
      ? await impacto.pedir({
          titulo: `Alterar a periodicidade de "${a.titulo}" para ${rotulos.periodicidade[nova]}?`,
          confirmar: { rotulo: "Alterar periodicidade", carregando: "Alterando…" },
          previa: chamarAcao(
            previaDaMudancaAction({ acao: "PERIODICIDADE", id: a.id, periodicidade: nova }),
          ),
          gravar: salvar,
          aoVoltar: voltar,
        })
      : await salvar(null);
    if (erro) {
      voltar();
      avisar.erro(erro);
    }
  }

  async function remover() {
    const texto = `"${a.titulo}" saiu do plano. Para voltar, use "Incluir atividade".`;
    const salvar = (motivo: string | null) =>
      gravar(
        "remover",
        chamarAcao(removerAtividadeAction({ id: a.id, rowVersion: a.rowVersion, motivo })),
        texto,
      );
    const erro = emitido
      ? await impacto.pedir({
          titulo: `Remover "${a.titulo}" do plano?`,
          confirmar: { rotulo: "Remover", carregando: "Removendo…" },
          previa: chamarAcao(previaDaMudancaAction({ acao: "REMOVER", id: a.id })),
          gravar: salvar,
        })
      : await salvar(null);
    if (erro) avisar.erro(erro);
  }

  const ocupado = !pronto || enviando !== null || impacto.ocupado;

  return (
    <tr
      className={cn(
        "border-b border-border-subtle last:border-b-0",
        "max-md:flex max-md:flex-wrap max-md:gap-x-2 max-md:gap-y-2 max-md:py-3",
      )}
    >
      <td className={cn(td, "font-medium text-text max-md:basis-full")}>
        <span className="inline-flex items-center gap-2">
          {a.titulo}
          {a.exigeFoto && (
            <Camera size={16} className="shrink-0 text-text-muted" aria-label="Exige foto" />
          )}
        </span>
      </td>
      <td className={cn(td, "max-md:basis-full max-md:text-small max-md:text-text-muted")}>
        {rotulos.natureza[a.natureza]}
        {a.unidade ? ` (${a.unidade})` : ""}
      </td>
      <td className={cn(td, "max-md:min-w-0 max-md:flex-1")}>
        {podeAlterar ? (
          <Select
            aria-label={`Periodicidade de ${a.titulo}`}
            value={periodicidade}
            disabled={ocupado}
            onChange={(e) => mudar(e.target.value as Periodicidade)}
            className="md:w-48"
          >
            {rotulos.periodicidades.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Select>
        ) : (
          rotulos.periodicidade[a.periodicidade]
        )}
      </td>
      {podeAlterar && (
        <td className={cn(td, "text-right")}>
          <Button
            size="sm"
            variant="tertiary"
            icon={<X size={16} aria-hidden="true" />}
            disabled={ocupado}
            loading={enviando === "remover"}
            onClick={remover}
          >
            {enviando === "remover" ? "Removendo…" : "Remover"}
          </Button>
          {impacto.dialogo}
        </td>
      )}
    </tr>
  );
}

/**
 * "Incluir atividade" (RF-10.3 [A VALIDAR]): volta uma removida pela mesma linha (RN-184), inclui uma
 * da biblioteca com a periodicidade padrão, ou cria uma nova só deste PMOC.
 */
function Incluir({
  tipo,
  c: { pmocId, emitido, rotulos },
  fechar,
}: {
  tipo: TipoNoPlano;
  c: Contexto;
  fechar: () => void;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [natureza, setNatureza] = useState<Natureza | "">("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const impacto = useMudancaComImpacto(rotulos.motivoMax);

  /**
   * Inclui (emitido: depois do diálogo de impacto, FL-09). Erro da prévia fica no topo do bloco;
   * erro ao gravar, no diálogo (ou no topo, em rascunho).
   */
  async function feito(
    chave: string,
    previa: Parameters<typeof previaDaMudancaAction>[0],
    incluir: (motivo: string | null) => Promise<Gravacao>,
    titulo: string,
  ) {
    setGeral(null);
    const salvar = async (motivo: string | null) => {
      setEnviando(chave);
      const r = await incluir(motivo);
      setEnviando(null);
      const erro = falha(r);
      if (erro) {
        if (r.tipo === "erro" && r.campos) setErros(r.campos);
        return erro;
      }
      sucesso(`"${titulo}" entrou no plano.`, r);
      fechar();
      router.refresh();
      return null;
    };
    const erro = emitido
      ? await impacto.pedir({
          titulo: `Incluir "${titulo}" no plano?`,
          confirmar: { rotulo: "Incluir", carregando: "Incluindo…" },
          previa: chamarAcao(previaDaMudancaAction(previa)),
          gravar: salvar,
        })
      : await salvar(null);
    if (erro) setGeral(erro);
  }

  async function criar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const d = {
      titulo: String(f.get("titulo") ?? "").trim(),
      periodicidade: String(f.get("periodicidade") ?? ""),
      natureza: String(f.get("natureza") ?? ""),
      unidade: natureza === "MEDICAO" ? String(f.get("unidade") ?? "").trim() : null,
      exigeFoto: f.get("exigeFoto") === "on",
    };
    const e: Record<string, string> = {};
    if (!d.titulo) e.titulo = "Informe o título.";
    if (!d.periodicidade) e.periodicidade = "Escolha a periodicidade.";
    if (!d.natureza) e.natureza = "Escolha a natureza.";
    if (d.natureza === "MEDICAO" && !d.unidade) e.unidade = "Informe a unidade da medição.";
    setErros(e);
    const primeiro = Object.keys(e)[0];
    if (primeiro) return (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
    await feito(
      "nova",
      {
        acao: "INCLUIR_NOVA",
        pmocId,
        tipoId: tipo.id,
        periodicidade: d.periodicidade as Periodicidade,
      },
      (motivo) => chamarAcao(incluirNovaAction({ pmocId, tipoId: tipo.id, ...d, motivo })),
      d.titulo,
    );
  }

  const pre = `nova-${tipo.id}`;
  const ocupado = !pronto || enviando !== null || impacto.ocupado;

  return (
    <section
      aria-label={`Incluir atividade em ${tipo.nome}`}
      className="flex flex-col gap-6 rounded-md border border-border bg-surface-muted p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-h4 text-text">Incluir atividade em {tipo.nome}</h3>
        <Button size="sm" variant="tertiary" onClick={fechar}>
          Fechar
        </Button>
      </div>
      {geral && <Alert tom="danger">{geral}</Alert>}

      {tipo.removidas.length > 0 && (
        <ListaEscolha
          titulo="Removidas deste plano"
          itens={tipo.removidas.map((a) => ({
            id: a.id,
            texto: `${a.titulo} (${rotulos.periodicidade[a.periodicidade]})`,
            acao: (
              <Button
                size="sm"
                icon={<RotateCcw size={16} aria-hidden="true" />}
                disabled={ocupado}
                loading={enviando === a.id}
                onClick={() =>
                  feito(
                    a.id,
                    { acao: "RESTAURAR", id: a.id },
                    (motivo) =>
                      chamarAcao(
                        restaurarAtividadeAction({ id: a.id, rowVersion: a.rowVersion, motivo }),
                      ),
                    a.titulo,
                  )
                }
              >
                Voltar ao plano
              </Button>
            ),
          }))}
        />
      )}

      {tipo.disponiveis.length > 0 && (
        <ListaEscolha
          titulo="Da biblioteca"
          itens={tipo.disponiveis.map((m) => ({
            id: m.id,
            texto: `${m.titulo} (${rotulos.periodicidade[m.periodicidade]})`,
            acao: (
              <Button
                size="sm"
                icon={<Plus size={16} aria-hidden="true" />}
                disabled={ocupado}
                loading={enviando === m.id}
                onClick={() =>
                  feito(
                    m.id,
                    { acao: "INCLUIR_MODELO", pmocId, modeloId: m.id },
                    (motivo) =>
                      chamarAcao(incluirDaBibliotecaAction({ pmocId, modeloId: m.id, motivo })),
                    m.titulo,
                  )
                }
              >
                Incluir
              </Button>
            ),
          }))}
        />
      )}

      <form onSubmit={criar} noValidate className="flex flex-col gap-4">
        <h4 className="text-h5 text-text-label">Nova atividade só deste PMOC</h4>
        <Field id={`${pre}-titulo`} label="Título" erro={erros.titulo}>
          <Input name="titulo" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id={`${pre}-periodicidade`} label="Periodicidade" erro={erros.periodicidade}>
            <Select name="periodicidade" defaultValue="">
              <option value="">Selecione…</option>
              {rotulos.periodicidades.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
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
              maxLength={rotulos.unidadeMax}
              disabled={natureza !== "MEDICAO"}
              placeholder={natureza === "MEDICAO" ? "Ex.: V, A, psi" : undefined}
            />
          </Field>
        </div>
        <Checkbox label="Exige foto" name="exigeFoto" />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={enviando !== null} onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={ocupado} loading={enviando === "nova"}>
            {enviando === "nova" ? "Incluindo…" : "Incluir nova atividade"}
          </Button>
        </div>
      </form>
      {impacto.dialogo}
    </section>
  );
}

function ListaEscolha({
  titulo,
  itens,
}: {
  titulo: string;
  itens: { id: string; texto: string; acao: ReactNode }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-h5 text-text-label">{titulo}</h4>
      <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface">
        {itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="text-body text-text">{i.texto}</span>
            {i.acao}
          </li>
        ))}
      </ul>
    </div>
  );
}
