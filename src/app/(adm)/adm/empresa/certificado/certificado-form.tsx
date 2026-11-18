"use client";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FileInput } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { enviarCertificadoAction } from "../actions";

type Erros = Record<string, string | undefined>;

function emBase64(b: ArrayBuffer): string {
  let s = "";
  for (const byte of new Uint8Array(b)) s += String.fromCharCode(byte);
  return btoa(s);
}

/**
 * TL-103 "Enviar certificado" (FL-02 passos 4–6). A senha nunca é reexibida: o campo é limpo depois de
 * cada envio (RN-121). O resultado fica em Alert (precisa ser relido: titular e aviso de divergência).
 */
export function CertificadoForm({
  tamanhoMax,
  extensoes,
}: {
  tamanhoMax: number;
  extensoes: readonly string[];
}) {
  const router = useRouter();
  const pronto = useHidratado();
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tom: "danger" | "success" | "warning"; texto: string }[]>(
    [],
  );
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const arquivo = f.get("arquivo");
    const senha = String(f.get("senha") ?? "");
    const e: Erros = {};
    if (!(arquivo instanceof File) || arquivo.size === 0)
      e.arquivo = "Escolha o arquivo do certificado.";
    else if (!extensoes.some((x) => arquivo.name.toLowerCase().endsWith(x)))
      e.arquivo = "Envie o arquivo .pfx ou .p12 do certificado A1.";
    else if (arquivo.size > tamanhoMax) e.arquivo = "O arquivo do certificado tem até 50 KB.";
    if (!senha) e.senha = "Informe a senha do certificado.";
    setErros(e);
    setGeral([]);
    const primeiro = Object.keys(e)[0];
    if (primeiro || !(arquivo instanceof File)) {
      if (primeiro) (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = await chamarAcao(
      enviarCertificadoAction({
        nomeArquivo: arquivo.name,
        arquivo: emBase64(await arquivo.arrayBuffer()),
        senha,
      }),
    );
    setEnviando(false);
    // A senha sai da tela em qualquer desfecho.
    const campoSenha = form.elements.namedItem("senha") as HTMLInputElement | null;
    if (campoSenha) campoSenha.value = "";
    if (r.tipo !== "ok") {
      if (r.tipo === "erro" && r.campos) setErros(r.campos);
      return setGeral([
        { tom: "danger", texto: r.tipo === "erro" ? r.mensagem : "Tente de novo." },
      ]);
    }
    form.reset();
    setGeral([
      {
        tom: "success",
        texto: `Certificado de ${String(r.dados.titular)} enviado. Ele passa a ser o atual.`,
      },
      ...(r.dados.aviso ? [{ tom: "warning" as const, texto: String(r.dados.aviso) }] : []),
    ]);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate aria-labelledby="titulo-envio">
      <Card
        titulo={<span id="titulo-envio">Enviar certificado</span>}
        descricao="Certificado A1 (.pfx ou .p12) do RT. O arquivo e a senha nunca são mostrados de novo."
        rodape={
          <Button
            type="submit"
            variant="primary"
            icon={<Upload size={20} aria-hidden="true" />}
            disabled={!pronto}
            loading={enviando}
          >
            {enviando ? "Validando certificado…" : "Enviar certificado"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {geral.map((g) => (
            <Alert key={g.texto} tom={g.tom}>
              {g.texto}
            </Alert>
          ))}
          <Field id="arquivo" label="Arquivo do certificado (.pfx ou .p12)" erro={erros.arquivo}>
            <FileInput name="arquivo" accept=".pfx,.p12,application/x-pkcs12" />
          </Field>
          <Field id="senha" label="Senha do certificado" erro={erros.senha}>
            <PasswordInput name="senha" autoComplete="off" />
          </Field>
        </div>
      </Card>
    </form>
  );
}
