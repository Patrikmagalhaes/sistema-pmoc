"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { EnderecoCampos, lerEndereco } from "@/components/endereco-campos";
import { chamarAcao } from "@/lib/chamar-acao";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import type { Endereco } from "@/lib/endereco";
import { mascararCnpj, mascararTelefone } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { VERSAO_APP } from "@/lib/versao-app";
import { salvarEmpresaAction } from "./actions";

type Erros = Record<string, string | undefined>;

export interface EmpresaEditavel {
  rowVersion: number;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  crea: string;
  logoId: string;
  endereco: Endereco;
}

/** SEG-51 / SEG-52 / E-02.2 [A VALIDAR]: a mesma regra do servidor (módulo `arquivos`). */
const LOGO_TIPOS = ["image/png", "image/jpeg"];
const LOGO_MAX = 2 * 1024 * 1024;
const LOGO_MENSAGEM = "Envie uma imagem PNG ou JPEG de até 2 MB.";

const digitos = (v: string) => v.replace(/\D/g, "");

async function sha256(f: File): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Envia o logo direto ao armazenamento (SEG-50) e devolve o comprovante que o "Salvar" confirma
 * (SEG-53), ou a mensagem de erro.
 */
async function enviarLogo(f: File): Promise<{ comprovante: string } | { erro: string }> {
  try {
    // SEG-29a: JSON, `X-App-Version` e mesma origem.
    const preparo = await fetch("/api/arquivos", {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-version": VERSAO_APP },
      body: JSON.stringify({
        finalidade: "LOGO_EMPRESA",
        nome: f.name,
        mime: f.type,
        tamanho: f.size,
        sha256: await sha256(f),
      }),
    });
    if (preparo.status === 401) {
      window.location.assign(`/login?voltar=${encodeURIComponent(window.location.pathname)}`);
      return { erro: "Sua sessão expirou." };
    }
    const r = (await preparo.json()) as { url?: string; comprovante?: string; mensagem?: string };
    if (!preparo.ok || !r.url || !r.comprovante) {
      return { erro: r.mensagem ?? "Não foi possível enviar o logo." };
    }
    // A URL do armazenamento local é do próprio sistema (mesmos cabeçalhos da SEG-29a).
    const local = r.url.startsWith("/");
    const put = await fetch(r.url, {
      method: "PUT",
      body: f,
      headers: { "content-type": f.type, ...(local ? { "x-app-version": VERSAO_APP } : {}) },
    });
    if (!put.ok) return { erro: "O logo não foi enviado. Tente de novo." };
    return { comprovante: r.comprovante };
  } catch {
    return { erro: "Sem conexão. Tente novamente." };
  }
}

/** TL-102 seção Empresa (RF-04.2; FL-02 passo 2). Sem empresa, o primeiro "Salvar" cria. */
export function EmpresaForm({ empresa }: { empresa: EmpresaEditavel | null }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [cnpj, setCnpj] = useState(mascararCnpj(empresa?.cnpj));
  const [telefone, setTelefone] = useState(mascararTelefone(empresa?.telefone ?? ""));
  const [logo, setLogo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(
    empresa ? `/api/arquivos/${empresa.logoId}` : null,
  );
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function escolherLogo(f: File | null) {
    setLogo(f);
    setErros((e) => ({ ...e, logo: undefined }));
    if (f && (!LOGO_TIPOS.includes(f.type) || f.size > LOGO_MAX)) {
      setErros((e) => ({ ...e, logo: LOGO_MENSAGEM }));
    }
    setPrevia(f ? URL.createObjectURL(f) : empresa ? `/api/arquivos/${empresa.logoId}` : null);
  }

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const { endereco, erros: e } = lerEndereco(f, true);
    const dados = {
      razaoSocial: String(f.get("razaoSocial") ?? "").trim(),
      cnpj: normalizarCnpj(cnpj),
      telefone: digitos(telefone),
      crea: String(f.get("crea") ?? "").trim(),
      endereco,
    };
    if (!dados.razaoSocial) e.razaoSocial = "Informe a razão social.";
    if (!cnpjValido(dados.cnpj)) e.cnpj = "CNPJ inválido."; // E-02.1
    if (!dados.telefone) e.telefone = "Informe o telefone.";
    else if (!/^[0-9]{10,11}$/.test(dados.telefone)) e.telefone = "Telefone com 10 ou 11 dígitos.";
    if (!dados.crea) e.crea = "Informe o registro CREA.";
    if (!empresa && !logo) e.logo = "Envie o logo da empresa.";
    else if (logo && (!LOGO_TIPOS.includes(logo.type) || logo.size > LOGO_MAX))
      e.logo = LOGO_MENSAGEM;
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro.replace("endereco.", "")) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    let comprovante: string | null = null;
    if (logo) {
      const envio = await enviarLogo(logo);
      if ("erro" in envio) {
        setEnviando(false);
        setErros({ logo: envio.erro });
        return setGeral({ tipo: "erro", texto: envio.erro });
      }
      comprovante = envio.comprovante;
    }
    const r = await chamarAcao(
      salvarEmpresaAction({ rowVersion: empresa?.rowVersion ?? null, logo: comprovante, ...dados }),
    );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    setLogo(null);
    setGeral({ tipo: "ok", texto: "Dados da empresa salvos." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="campo">
        <label htmlFor="razaoSocial">Razão social</label>
        <input
          id="razaoSocial"
          name="razaoSocial"
          defaultValue={empresa?.razaoSocial}
          aria-invalid={Boolean(erros.razaoSocial)}
        />
        {erro("razaoSocial")}
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="cnpj">CNPJ</label>
          <input
            id="cnpj"
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
            aria-invalid={Boolean(erros.cnpj)}
          />
          {erro("cnpj")}
        </div>
        <div className="campo">
          <label htmlFor="empresa-telefone">Telefone</label>
          <input
            id="empresa-telefone"
            name="telefone"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            aria-invalid={Boolean(erros.telefone)}
          />
          {erro("telefone")}
        </div>
        <div className="campo">
          <label htmlFor="crea">Registro CREA</label>
          <input
            id="crea"
            name="crea"
            defaultValue={empresa?.crea}
            aria-invalid={Boolean(erros.crea)}
          />
          {erro("crea")}
        </div>
      </div>
      <EnderecoCampos
        valor={empresa?.endereco}
        erros={erros}
        bairroObrigatorio={true}
        prefixo="empresa-"
      />
      <div className="campo">
        <label htmlFor="logo">Logo</label>
        {previa && (
          // biome-ignore lint/performance/noImgElement: prévia local (blob:) ou rota protegida, sem otimização
          <img src={previa} alt="Logo da empresa" style={{ maxHeight: 80, maxWidth: 240 }} />
        )}
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => escolherLogo(e.target.files?.[0] ?? null)}
          aria-invalid={Boolean(erros.logo)}
        />
        <span className="dica">PNG ou JPEG de até 2 MB. Vai no cabeçalho dos PDFs.</span>
        {erro("logo")}
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar empresa"}
      </button>
    </form>
  );
}
