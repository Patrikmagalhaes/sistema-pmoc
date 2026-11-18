"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { incluirGrupoAction, renomearGrupoAction } from "../actions";
import { AcoesItem } from "./acoes-item";

interface Grupo {
  id: string;
  nome: string;
  situacao: "ATIVO" | "INATIVO";
  rowVersion: number;
  emUso: boolean;
}

/**
 * TL-105 – lista editável de grupos (RN-040; E-03.2: tipo ativo mantém ao menos um grupo ativo).
 * Tabela editável dentro do Card (doc 08 §7.4); no celular cada grupo vira um bloco empilhado.
 */
export function Grupos({ tipoId, grupos }: { tipoId: string; grupos: Grupo[] }) {
  return (
    <div className="flex flex-col gap-4">
      {grupos.length === 0 ? (
        <p className="text-body text-text-muted">Inclua o primeiro grupo.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border">
          {grupos.map((g) => (
            <LinhaGrupo key={`${g.id}-${g.rowVersion}`} grupo={g} />
          ))}
        </ul>
      )}
      <NovoGrupo tipoId={tipoId} />
    </div>
  );
}

function LinhaGrupo({ grupo }: { grupo: Grupo }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [nome, setNome] = useState(grupo.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudou = nome.trim() !== grupo.nome;

  async function salvar() {
    if (!nome.trim()) return setErro("Informe o nome do grupo.");
    setEnviando(true);
    const r = await chamarAcao(
      renomearGrupoAction({ id: grupo.id, rowVersion: grupo.rowVersion, nome }),
    );
    setEnviando(false);
    if (r.tipo === "conflito")
      return setErro("Este registro foi alterado por outra pessoa. Recarregue a página.");
    if (r.tipo === "erro") return setErro(r.campos?.nome ?? r.mensagem);
    setErro(null);
    avisar.sucesso("Grupo salvo.");
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 p-3 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Input
            aria-label={`Nome do grupo ${grupo.nome}`}
            value={nome}
            aria-invalid={Boolean(erro) || undefined}
            onChange={(e) => setNome(e.target.value)}
          />
          <StatusBadge tipo="situacao" valor={grupo.situacao} />
        </div>
        <FieldError erro={erro} />
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {mudou && (
          <Button
            variant="primary"
            size="sm"
            disabled={!pronto}
            loading={enviando}
            onClick={salvar}
          >
            {enviando ? "Salvando…" : "Salvar"}
          </Button>
        )}
        <AcoesItem
          compacto
          alvo="grupo"
          id={grupo.id}
          rowVersion={grupo.rowVersion}
          nome={grupo.nome}
          situacao={grupo.situacao}
          emUso={grupo.emUso}
        />
      </div>
    </li>
  );
}

function NovoGrupo({ tipoId }: { tipoId: string }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function incluir(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const nome = String(new FormData(form).get("novo-grupo") ?? "").trim();
    if (!nome) return setErro("Informe o nome do grupo.");
    setEnviando(true);
    const r = await chamarAcao(incluirGrupoAction({ tipoId, nome }));
    setEnviando(false);
    if (r.tipo !== "ok")
      return setErro(r.tipo === "erro" ? (r.campos?.nome ?? r.mensagem) : "Recarregue a página.");
    setErro(null);
    form.reset();
    avisar.sucesso("Grupo incluído.");
    router.refresh();
  }

  return (
    <form onSubmit={incluir} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field id="novo-grupo" label="Novo grupo" erro={erro} className="sm:w-72">
        <Input name="novo-grupo" placeholder="Ex.: Cassete" />
      </Field>
      <Button
        type="submit"
        icon={<Plus size={20} aria-hidden="true" />}
        disabled={!pronto}
        loading={enviando}
        className={erro ? "sm:mb-7" : undefined}
      >
        {enviando ? "Incluindo…" : "Incluir grupo"}
      </Button>
    </form>
  );
}
