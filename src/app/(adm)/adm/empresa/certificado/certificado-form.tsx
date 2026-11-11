"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
 * cada envio (RN-121).
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
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok" | "aviso"; texto: string }[]>([]);
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
      return setGeral([{ tipo: "erro", texto: r.tipo === "erro" ? r.mensagem : "Tente de novo." }]);
    }
    form.reset();
    setGeral([
      {
        tipo: "ok",
        texto: `Certificado de ${String(r.dados.titular)} enviado. Ele passa a ser o atual.`,
      },
      ...(r.dados.aviso ? [{ tipo: "aviso" as const, texto: String(r.dados.aviso) }] : []),
    ]);
    router.refresh();
  }

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={enviar} noValidate className="formulario" style={{ maxWidth: 560 }}>
      {geral.map((g) => (
        <div key={g.texto} className={`alerta ${g.tipo}`} role="status">
          {g.texto}
        </div>
      ))}
      <div className="campo">
        <label htmlFor="arquivo">Arquivo do certificado (.pfx ou .p12)</label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".pfx,.p12,application/x-pkcs12"
          aria-invalid={Boolean(erros.arquivo)}
        />
        {erro("arquivo")}
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha do certificado</label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="off"
          aria-invalid={Boolean(erros.senha)}
        />
        {erro("senha")}
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Validando certificado…" : "Enviar certificado"}
      </button>
    </form>
  );
}
