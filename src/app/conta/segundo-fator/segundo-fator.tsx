"use client";
import { type FormEvent, useState } from "react";
import { authClient, mensagemDeLogin } from "@/lib/auth-client";
import { useHidratado } from "@/lib/use-hidratado";

type Passo =
  | { nome: "senha" }
  | { nome: "qr"; uri: string; chave: string; codigos: string[] }
  | { nome: "codigos"; codigos: string[] };

const sair = async () => {
  await authClient.signOut();
  window.location.assign("/login");
};

function Alerta({ texto }: { texto: string | null }) {
  return texto ? (
    <div className="alerta erro" role="alert">
      {texto}
    </div>
  ) : null;
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
      setErro("Sem conexão. Tente novamente.");
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
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (passo.nome === "codigos") {
    const texto = passo.codigos.join("\n");
    return (
      <>
        <p>
          Guarde estes códigos de recuperação. Cada um pode ser usado <strong>uma vez</strong> se
          você perder o aplicativo. Eles não serão mostrados de novo.
        </p>
        <ul className="codigos">
          {passo.codigos.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="linha">
          <button
            className="botao secundario"
            type="button"
            onClick={() => navigator.clipboard.writeText(texto)}
          >
            Copiar
          </button>
          <a
            className="botao secundario"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(texto)}`}
            download="codigos-recuperacao-pmoc.txt"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Baixar .txt
          </a>
        </div>
        <div className="campo">
          <label style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={guardei}
              onChange={(e) => setGuardei(e.target.checked)}
            />{" "}
            Guardei os códigos em local seguro
          </label>
        </div>
        <button
          className="botao"
          type="button"
          disabled={!guardei}
          onClick={() => window.location.assign("/adm")}
        >
          Concluir
        </button>
      </>
    );
  }

  if (passo.nome === "qr") {
    return (
      <form onSubmit={confirmar} noValidate>
        <Alerta texto={erro} />
        <p>
          No aplicativo autenticador, adicione uma conta pela chave abaixo
          {/* [A VALIDAR] QR code: nenhuma biblioteca de QR na stack (05 §3.0). */} ou, no celular,{" "}
          <a href={passo.uri}>abra o link no aplicativo</a>.
        </p>
        <div className="linha">
          <span className="chave" style={{ flex: 1 }}>
            {passo.chave}
          </span>
          <button
            className="botao secundario"
            type="button"
            onClick={() => navigator.clipboard.writeText(passo.chave)}
          >
            Copiar
          </button>
        </div>
        <div className="campo">
          <label htmlFor="codigo">Código do aplicativo</label>
          <input
            id="codigo"
            name="codigo"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
          />
        </div>
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          {enviando ? "Confirmando…" : "Confirmar código"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={comSenha} noValidate>
      {ativo ? (
        <p>Segundo fator ativo{ativoDesde ? ` desde ${ativoDesde}` : ""}.</p>
      ) : (
        <p>
          Para proteger o sistema, administradores precisam de um código de aplicativo autenticador
          além da senha. Ative agora para continuar.
        </p>
      )}
      <Alerta texto={erro} />
      <div className="campo">
        <label htmlFor="senha">Confirme sua senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" />
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {ativo ? "Gerar novos códigos de recuperação" : "Continuar"}
      </button>
      <div className="links">
        <button type="button" className="botao secundario" onClick={sair}>
          Sair
        </button>
      </div>
    </form>
  );
}
