"use client";
import { AlertTriangle, Info, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useHidratado } from "@/lib/use-hidratado";
import { Alert } from "./alert";
import { Button, type ButtonVariant } from "./button";

/**
 * Dialog modal (doc 08 §3.8) sobre `<dialog>` nativo: foco preso, Esc fecha (exceto durante o
 * envio), foco volta ao gatilho, fundo `--color-overlay`. Título `text-h3` obrigatório.
 */
export function Dialog({
  aberto,
  aoFechar,
  titulo,
  icone,
  largura = "sm",
  travado = false,
  children,
  rodape,
  onSubmit,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  icone?: ReactNode;
  largura?: "sm" | "md" | "lg";
  /** Durante o envio: Esc e o botão fechar não fecham (FE-C3 6). */
  travado?: boolean;
  children?: ReactNode;
  rodape: ReactNode;
  onSubmit?: (ev: FormEvent<HTMLFormElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        if (!travado) aoFechar();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface p-0 text-text shadow-3",
        "max-h-[calc(100dvh-2rem)] overflow-y-auto",
        largura === "sm" && "max-w-dialog-sm",
        largura === "md" && "max-w-dialog-md",
        largura === "lg" && "max-w-dialog-lg",
      )}
    >
      {aberto && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(e);
          }}
          className="flex flex-col"
        >
          <header className="flex items-start gap-3 px-6 pt-6">
            {icone}
            <h2 id={idTitulo} className="flex-1 text-h3">
              {titulo}
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              disabled={travado}
              onClick={aoFechar}
              className="-m-2 inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted disabled:opacity-50"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="flex flex-col gap-4 px-6 py-4 text-body">{children}</div>
          <footer className="flex flex-col-reverse gap-3 border-t border-border-subtle px-6 py-4 sm:flex-row sm:justify-end">
            {rodape}
          </footer>
        </form>
      )}
    </dialog>
  );
}

/**
 * Confirmação (doc 08 §3.8 FE-C3; UF-09): só para as ações de FE-H5.1. Título = pergunta com verbo
 * e objeto; corpo = efeito; "Voltar" (foco inicial) e o botão com o mesmo verbo do gatilho. Em erro,
 * o diálogo fica aberto com a mensagem no topo.
 */
export function ConfirmDialog({
  gatilho,
  titulo,
  efeito,
  confirmar,
  destrutiva = true,
  onConfirmar,
  children,
}: {
  gatilho: {
    rotulo: string;
    variant?: ButtonVariant;
    /** Motivo de não poder (FE-H5.2): o botão fica desabilitado e o motivo aparece abaixo. */
    bloqueio?: string | null;
    icone?: ReactNode;
    /** `sm` só em tabelas desktop (§3.1). */
    tamanho?: "sm" | "md";
    /** Dica de bloqueio alinhada à direita (cabeçalho) ou à esquerda (tabela, formulário). */
    alinhar?: "inicio" | "fim";
  };
  titulo: string;
  efeito: ReactNode;
  confirmar: { rotulo: string; carregando: string };
  destrutiva?: boolean;
  /**
   * Devolve a mensagem de erro (mantém aberto com Alert), `false` (mantém aberto: erro já está no
   * campo) ou nada (fecha). Recebe os campos extras.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: callback async que só fecha não devolve nada.
  onConfirmar: (dados: FormData) => Promise<string | false | null | undefined | void>;
  /** Campos extras (ex.: motivo, UF-10). */
  children?: ReactNode;
}) {
  const pronto = useHidratado();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueio = gatilho.bloqueio ?? null;
  const idDica = useId();

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    setEnviando(true);
    setErro(null);
    try {
      const e = await onConfirmar(new FormData(ev.currentTarget));
      if (e === false) return; // erro de campo, já mostrado junto do campo
      if (e) setErro(e);
      else setAberto(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1",
        (gatilho.alinhar ?? "fim") === "fim" && "sm:items-end",
      )}
    >
      <Button
        variant={gatilho.variant ?? (destrutiva ? "destructive-outline" : "secondary")}
        size={gatilho.tamanho ?? "md"}
        icon={gatilho.icone}
        disabled={!pronto || Boolean(bloqueio)}
        aria-describedby={bloqueio ? idDica : undefined}
        title={bloqueio ?? undefined}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        {gatilho.rotulo}
      </Button>
      {bloqueio && (
        <p id={idDica} className="max-w-prose text-small text-text-muted">
          {bloqueio}
        </p>
      )}
      <Dialog
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        travado={enviando}
        titulo={titulo}
        icone={
          destrutiva ? (
            <AlertTriangle
              size={24}
              className="mt-0.5 shrink-0 text-danger-solid"
              aria-hidden="true"
            />
          ) : (
            <Info size={24} className="mt-0.5 shrink-0 text-info-solid" aria-hidden="true" />
          )
        }
        onSubmit={enviar}
        rodape={
          <>
            <Button autoFocus disabled={enviando} onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant={destrutiva ? "destructive" : "primary"}
              loading={enviando}
            >
              {enviando ? confirmar.carregando : confirmar.rotulo}
            </Button>
          </>
        }
      >
        {erro && <Alert tom="danger">{erro}</Alert>}
        <div className="max-w-prose text-text">{efeito}</div>
        {children}
      </Dialog>
    </div>
  );
}
