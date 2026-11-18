"use client";
import { Copy, Download, LogOut } from "lucide-react";
import QRCode from "qrcode";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { avisar } from "@/components/ui/toaster";
import { authClient, mensagemDeLogin } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

/** QR code do URI `otpauth://`, gerado no navegador: o segredo não vai a nenhum serviço externo. */
function QrCode({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(uri, { margin: 1, width: 200 }).then(setSrc, () => setSrc(null));
  }, [uri]);
  // Carregando: esqueleto do QR code (TL-004).
  return src ? (
    // biome-ignore lint/performance/noImgElement: imagem gerada localmente (data URL), sem otimização
    <img
      src={src}
      width={200}
      height={200}
      alt="QR code para o aplicativo autenticador"
      className="rounded-md border border-border"
    />
  ) : (
    <div aria-busy="true" className="size-50 animate-pulse rounded-md bg-skeleton">
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

type Passo =
  | { nome: "senha" }
  | { nome: "qr"; uri: string; chave: string; codigos: string[] }
  | { nome: "codigos"; codigos: string[] };

const sair = async () => {
  await authClient.signOut();
  window.location.assign("/login");
};

const copiar = (texto: string) =>
  navigator.clipboard.writeText(texto).then(
    () => avisar.sucesso("Copiado."),
    () => avisar.erro("Não foi possível copiar."),
  );

/** Seção numerada dos passos (doc 08 §7.4 TL-004). */
function Etapa({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-h4 text-text">
        <span
          aria-hidden="true"
          className="inline-flex size-7 items-center justify-center rounded-full bg-action-strong-bg text-small font-semibold text-action-strong-text"
        >
          {n}
        </span>
        <span>
          <span className="sr-only">Passo {n}: </span>
          {titulo}
        </span>
      </h2>
      {children}
    </section>
  );
}

/**
 * TL-004. Passo 1: QR code / chave + código; passo 2: 10 códigos de recuperação, mostrados uma vez.
 * A biblioteca exige a senha para ativar e para gerar novos códigos (reautenticação, SEG-12).
 */
export function SegundoFator({ ativo, ativoDesde }: { ativo: boolean; ativoDesde: string | null }) {
  const [passo, setPasso] = useState<Passo>({ nome: "senha" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pronto = useHidratado();
  const [guardei, setGuardei] = useState(false);

  async function comSenha(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("senha") ?? "");
    setErro(null);
    setEnviando(true);
    try {
      if (ativo) {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
        if (error || !data) return setErro("Senha incorreta.");
        return setPasso({ nome: "codigos", codigos: data.backupCodes });
      }
      const { data, error } = await authClient.twoFactor.enable({ password, issuer: "PMOC" });
      if (error || !data || data.method !== "totp")
        return setErro(error?.status === 429 ? mensagemDeLogin(429, "senha") : "Senha incorreta.");
      const chave = new URL(data.totpURI).searchParams.get("secret") ?? "";
      setPasso({ nome: "qr", uri: data.totpURI, chave, codigos: data.backupCodes });
    } catch {
      setErro("Não foi possível continuar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passo.nome !== "qr") return;
    const code = String(new FormData(e.currentTarget).get("codigo") ?? "").trim();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) return setErro(mensagemDeLogin(error.status, "codigo")); // E-01.7; SEG-62
      setPasso({ nome: "codigos", codigos: passo.codigos });
    } catch {
      setErro("Não foi possível confirmar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const alerta = erro && <Alert tom="danger">{erro}</Alert>;

  if (passo.nome === "codigos") {
    const texto = passo.codigos.join("\n");
    return (
      <Etapa n={ativo ? 1 : 2} titulo="Guarde os códigos de recuperação">
        <p className="max-w-prose text-text">
          Cada código pode ser usado <strong>uma vez</strong> se você perder o aplicativo. Eles não
          serão mostrados de novo.
        </p>
        <ul
          aria-label="Códigos de recuperação"
          className="grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-4 font-mono text-body tabular-nums"
        >
          {passo.codigos.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Copy size={20} aria-hidden="true" />} onClick={() => copiar(texto)}>
            Copiar
          </Button>
          <a
            className={buttonClasses({ variant: "secondary" })}
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(texto)}`}
            download="codigos-recuperacao-pmoc.txt"
          >
            <Download size={20} aria-hidden="true" />
            Baixar .txt
          </a>
        </div>
        <Checkbox
          label="Guardei os códigos em local seguro"
          checked={guardei}
          onChange={(e) => setGuardei(e.target.checked)}
        />
        <Button
          variant="primary"
          size="lg"
          disabled={!guardei}
          onClick={() => window.location.assign("/adm")}
        >
          Concluir
        </Button>
        {!guardei && (
          <p className="text-small text-text-muted">Marque a caixa acima para concluir.</p>
        )}
      </Etapa>
    );
  }

  if (passo.nome === "qr") {
    return (
      <form onSubmit={confirmar} noValidate className="flex flex-col gap-6">
        {alerta}
        <Etapa n={1} titulo="Leia o QR code no aplicativo autenticador">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <QrCode uri={passo.uri} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-small text-text-muted">Se preferir, digite a chave:</p>
              <code
                data-slot="chave"
                className="rounded-md bg-surface-muted px-3 py-2 font-mono text-body break-all text-text"
              >
                {passo.chave}
              </code>
              <Button
                className="self-start"
                icon={<Copy size={20} aria-hidden="true" />}
                onClick={() => copiar(passo.chave)}
              >
                Copiar chave
              </Button>
            </div>
          </div>
          <Field
            id="codigo"
            label="Código do aplicativo"
            dica="Os 6 dígitos mostrados no aplicativo."
          >
            <Input
              name="codigo"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              className="max-w-40 tabular-nums"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="self-start"
            disabled={!pronto}
            loading={enviando}
          >
            {enviando ? "Confirmando…" : "Confirmar código"}
          </Button>
        </Etapa>
      </form>
    );
  }

  return (
    <form onSubmit={comSenha} noValidate className="flex flex-col gap-4">
      {ativo ? (
        <Alert tom="success">Segundo fator ativo{ativoDesde ? ` desde ${ativoDesde}` : ""}.</Alert>
      ) : (
        <p className="max-w-prose text-text">
          Para proteger o sistema, administradores precisam de um código de aplicativo autenticador
          além da senha. Ative agora para continuar.
        </p>
      )}
      {alerta}
      <Field id="senha" label="Confirme sua senha">
        <PasswordInput name="senha" required autoComplete="current-password" />
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!pronto}
        loading={enviando}
      >
        {ativo ? "Gerar novos códigos de recuperação" : "Continuar"}
      </Button>
      <Button
        variant="tertiary"
        className="self-center"
        icon={<LogOut size={20} aria-hidden="true" />}
        onClick={sair}
      >
        Sair
      </Button>
    </form>
  );
}
