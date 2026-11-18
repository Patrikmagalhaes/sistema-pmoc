"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Field, FieldRow, Input } from "@/components/ui/field";
import { avisar } from "@/components/ui/toaster";
import { mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { salvarMeusDadosAction } from "./actions";

/** TL-005 – Seus dados: nome e telefone (LG-21). E-mail só pelo administrador (SEG-12). */
export function DadosForm(p: {
  rowVersion: number;
  nome: string;
  email: string;
  telefone: string | null;
  /** Perfil e cliente, só leitura. */
  vinculo: string;
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [telefone, setTelefone] = useState(mascararTelefone(p.telefone ?? ""));
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const nome = String(f.get("nome") ?? "");
    const tel = telefone.replace(/\D/g, "");
    const err: Record<string, string> = {};
    if (!nome.trim()) err.nome = "Informe o nome.";
    if (tel && !/^[0-9]{10,11}$/.test(tel)) err.telefone = "Telefone com 10 ou 11 dígitos.";
    setErros(err);
    setErro(null);
    const primeiro = Object.keys(err)[0];
    if (primeiro) return (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
    setEnviando(true);
    try {
      const r = await salvarMeusDadosAction({ rowVersion: p.rowVersion, nome, telefone: tel });
      if (r?.serverError === "SESSAO_EXPIRADA")
        return window.location.assign("/login?voltar=%2Fconta");
      const d = r?.data;
      if (!d) return setErro(r?.serverError ?? "Não foi possível salvar.");
      if (!d.ok) {
        if (d.campos) setErros(d.campos);
        return setErro(d.mensagem);
      }
      avisar.sucesso("Dados salvos.");
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate aria-labelledby="titulo-dados">
      <Card
        titulo={<span id="titulo-dados">Seus dados</span>}
        rodape={
          <Button type="submit" variant="primary" disabled={!pronto} loading={enviando}>
            {enviando ? "Salvando…" : "Salvar dados"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {erro && <Alert tom="danger">{erro}</Alert>}
          <DescriptionList
            itens={[
              {
                rotulo: "E-mail",
                valor: p.email,
                ajuda: "Para trocar o e-mail, fale com o administrador.",
              },
              { rotulo: "Perfil", valor: p.vinculo },
            ]}
          />
          <FieldRow className="lg:grid-cols-2">
            <Field id="nome" label="Nome" erro={erros.nome}>
              <Input name="nome" defaultValue={p.nome} autoComplete="name" />
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
    </form>
  );
}
