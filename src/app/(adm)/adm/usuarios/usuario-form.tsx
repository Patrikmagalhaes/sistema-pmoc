"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, Input, Select } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { avisar } from "@/components/ui/toaster";
import { mascararTelefone, ROTULO_PERFIL } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarUsuarioAction, criarUsuarioAction } from "./actions";

type Perfil = keyof typeof ROTULO_PERFIL;
type Erros = Record<string, string | undefined>;

export interface UsuarioEditavel {
  id: string;
  rowVersion: number;
  nome: string;
  email: string;
  perfil: Perfil;
  clientId: string | null;
  telefone: string | null;
}

const SESSAO_EXPIRADA = "SESSAO_EXPIRADA";

/** UF-01: validação no cliente antes de enviar; o servidor revalida tudo (UF-02). */
function validar(d: Record<string, string>, novo: boolean): Erros {
  const e: Erros = {};
  if (!d.nome?.trim()) e.nome = "Informe o nome.";
  if (novo) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email?.trim() ?? "")) e.email = "E-mail inválido.";
    if (!d.perfil) e.perfil = "Escolha o perfil.";
    if (d.perfil === "CLIENTE" && !d.clientId) e.clientId = "Escolha o cliente."; // RN-169
  }
  const tel = (d.telefone ?? "").replace(/\D/g, "");
  if (tel && !/^[0-9]{10,11}$/.test(tel)) e.telefone = "Telefone com 10 ou 11 dígitos.";
  return e;
}

/**
 * TL-107 – Usuário (criação e edição). Template T-FORM (doc 08 §7.4). Na edição, e-mail, perfil e
 * cliente não mudam (CA-02.5) e aparecem como somente leitura (§7.2).
 */
export function UsuarioForm({
  usuario,
  clientes,
  travado,
  cancelarHref,
}: {
  usuario?: UsuarioEditavel;
  clientes: { id: string; razaoSocial: string }[];
  /** Aberto de TL-109: perfil CLIENTE e cliente já preenchidos e travados (FL-04 passo 4). */
  travado?: { clientId: string };
  /** Destino do "Cancelar" na criação. */
  cancelarHref?: string;
}) {
  const novo = !usuario;
  const router = useRouter();
  const pronto = useHidratado();
  const [perfil, setPerfil] = useState<Perfil | "">(usuario?.perfil ?? (travado ? "CLIENTE" : ""));
  const [telefone, setTelefone] = useState(mascararTelefone(usuario?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const nomeCliente = (id: string | null | undefined) =>
    clientes.find((c) => c.id === id)?.razaoSocial ?? "—";

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const d = Object.fromEntries(
      [...new FormData(form).entries()].map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>;
    if (travado) {
      d.perfil = "CLIENTE";
      d.clientId = travado.clientId;
    }
    const e = validar(d, novo);
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus(); // UF-01
      return;
    }
    setEnviando(true);
    try {
      const r = novo
        ? await criarUsuarioAction({
            nome: d.nome ?? "",
            email: d.email ?? "",
            perfil: d.perfil ?? "",
            clientId: d.perfil === "CLIENTE" ? d.clientId : null,
            telefone: d.telefone ?? null,
          })
        : await atualizarUsuarioAction({
            id: usuario.id,
            rowVersion: usuario.rowVersion,
            nome: d.nome ?? "",
            telefone: d.telefone ?? null,
          });
      if (r?.serverError === SESSAO_EXPIRADA) {
        window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const res = r?.data;
      if (!res) {
        setGeral(r?.serverError ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      if (!res.ok) {
        if (res.codigo === "ALTERADO_POR_OUTRO") return setConflito(true); // UF-07
        if (res.campos) setErros(res.campos);
        setGeral(res.mensagem);
        return;
      }
      if (novo && "id" in res) {
        const aviso = (res as { emailEnviado?: boolean }).emailEnviado ? "criado" : "sem-email";
        router.push(`/adm/usuarios/${String(res.id)}?aviso=${aviso}`);
        return;
      }
      avisar.sucesso("Dados salvos.");
      router.refresh();
    } catch {
      setGeral("Não foi possível salvar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (conflito) return <Conflito />;

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      {geral && <Alert tom="danger">{geral}</Alert>}
      <Card titulo="Dados do usuário">
        <div className="flex flex-col gap-4">
          <Field id="nome" label="Nome" erro={erros.nome}>
            <Input name="nome" defaultValue={usuario?.nome} autoComplete="off" />
          </Field>
          {novo ? (
            <Field id="email" label="E-mail" erro={erros.email}>
              <Input name="email" type="email" autoComplete="off" />
            </Field>
          ) : null}
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
        </div>
      </Card>

      <Card titulo="Acesso">
        {novo && !travado ? (
          <div className="flex flex-col gap-4">
            <Field
              id="perfil"
              label="Perfil"
              erro={erros.perfil}
              dica="O perfil não muda depois de criado."
            >
              <Select
                name="perfil"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as Perfil)}
              >
                <option value="">Selecione…</option>
                {Object.entries(ROTULO_PERFIL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            {perfil === "CLIENTE" && (
              <Field
                id="clientId"
                label="Cliente"
                erro={erros.clientId}
                dica={clientes.length === 0 ? "Nenhum cliente cadastrado ainda." : undefined}
              >
                <Select name="clientId" defaultValue="">
                  <option value="">Selecione…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.razaoSocial}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        ) : (
          <DescriptionList
            itens={[
              ...(novo
                ? []
                : [
                    {
                      rotulo: "E-mail",
                      valor: usuario.email,
                      ajuda:
                        "A troca de e-mail exige reautenticação (SEG-12) e ainda não está disponível.",
                    },
                  ]),
              {
                rotulo: "Perfil",
                valor: ROTULO_PERFIL[(usuario?.perfil ?? "CLIENTE") as Perfil],
                ajuda: novo ? undefined : "O perfil não muda depois de criado (RN-179).",
              },
              ...((usuario?.perfil ?? "CLIENTE") === "CLIENTE"
                ? [
                    {
                      rotulo: "Cliente",
                      valor: nomeCliente(usuario?.clientId ?? travado?.clientId),
                    },
                  ]
                : []),
            ]}
          />
        )}
        {novo && (
          <p className="mt-4 text-small text-text-muted">
            Ao salvar, o usuário recebe por e-mail um link para definir a senha (vale 72 horas).
          </p>
        )}
      </Card>

      <FormActions>
        {novo ? (
          <Link
            href={cancelarHref ?? "/adm/usuarios"}
            className={buttonClasses({ variant: "secondary" })}
          >
            Cancelar
          </Link>
        ) : (
          <Button
            type="reset"
            disabled={enviando}
            onClick={() => {
              setTelefone(mascararTelefone(usuario.telefone ?? ""));
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
