"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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

/** TL-107 – Usuário (criação e edição). */
export function UsuarioForm({
  usuario,
  clientes,
  travado,
}: {
  usuario?: UsuarioEditavel;
  clientes: { id: string; razaoSocial: string }[];
  /** Aberto de TL-109: perfil CLIENTE e cliente já preenchidos e travados (FL-04 passo 4). */
  travado?: { clientId: string };
}) {
  const novo = !usuario;
  const router = useRouter();
  const pronto = useHidratado();
  const [perfil, setPerfil] = useState<Perfil | "">(usuario?.perfil ?? (travado ? "CLIENTE" : ""));
  const [telefone, setTelefone] = useState(mascararTelefone(usuario?.telefone ?? ""));
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

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
        setGeral({
          tipo: "erro",
          texto: r?.serverError ?? "Não foi possível salvar. Tente novamente.",
        });
        return;
      }
      if (!res.ok) {
        if (res.codigo === "ALTERADO_POR_OUTRO") return setConflito(true); // UF-07
        if (res.campos) setErros(res.campos);
        setGeral({ tipo: "erro", texto: res.mensagem });
        return;
      }
      if (novo && "id" in res) {
        const aviso = (res as { emailEnviado?: boolean }).emailEnviado ? "criado" : "sem-email";
        router.push(`/adm/usuarios/${String(res.id)}?aviso=${aviso}`);
        return;
      }
      setGeral({ tipo: "ok", texto: "Dados salvos." });
      router.refresh();
    } catch {
      setGeral({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  if (conflito) {
    return (
      <div className="alerta erro" role="status">
        Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.{" "}
        <button type="button" className="botao secundario" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }

  const erro = (k: string) =>
    erros[k] ? (
      <span className="erro" id={`${k}-erro`}>
        {erros[k]}
      </span>
    ) : null;

  return (
    <form onSubmit={salvar} noValidate className="formulario">
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="campo">
        <label htmlFor="nome">Nome</label>
        <input
          id="nome"
          name="nome"
          defaultValue={usuario?.nome}
          aria-invalid={Boolean(erros.nome)}
        />
        {erro("nome")}
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={usuario?.email}
          readOnly={!novo}
          aria-invalid={Boolean(erros.email)}
          aria-describedby={novo ? undefined : "email-dica"}
        />
        {!novo && (
          <span className="dica" id="email-dica">
            A troca de e-mail exige reautenticação (SEG-12) e ainda não está disponível.
          </span>
        )}
        {erro("email")}
      </div>
      <div className="campo">
        <label htmlFor="perfil">Perfil</label>
        <select
          id="perfil"
          name="perfil"
          value={perfil}
          disabled={!novo || Boolean(travado)}
          onChange={(e) => setPerfil(e.target.value as Perfil)}
          aria-invalid={Boolean(erros.perfil)}
        >
          <option value="">Escolha</option>
          {Object.entries(ROTULO_PERFIL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {!novo && <span className="dica">O perfil não muda depois de criado (RN-179).</span>}
        {erro("perfil")}
      </div>
      {perfil === "CLIENTE" && (
        <div className="campo">
          <label htmlFor="clientId">Cliente</label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={usuario?.clientId ?? travado?.clientId ?? ""}
            disabled={!novo || Boolean(travado)}
            aria-invalid={Boolean(erros.clientId)}
          >
            <option value="">Escolha</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </select>
          {clientes.length === 0 && (
            <span className="dica">
              Nenhum cliente cadastrado ainda (cadastro de clientes: Etapa 3).
            </span>
          )}
          {erro("clientId")}
        </div>
      )}
      <div className="campo">
        <label htmlFor="telefone">Telefone (opcional)</label>
        <input
          id="telefone"
          name="telefone"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
          aria-invalid={Boolean(erros.telefone)}
        />
        {erro("telefone")}
      </div>
      <button
        className="botao"
        type="submit"
        disabled={!pronto || enviando}
        style={{ width: "auto" }}
      >
        {enviando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
