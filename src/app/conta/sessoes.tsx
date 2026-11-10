"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { descreverDispositivo, formatarDataHora } from "@/lib/formato";
import { useHidratado } from "@/lib/use-hidratado";
import { encerrarOutrasSessoesAction, encerrarSessaoAction } from "./actions";

interface Sessao {
  id: string;
  criadaEm: string;
  ultimoUso: string;
  userAgent: string | null;
  atual: boolean;
}

/** TL-005 – Sessões ativas (SEG-13, versão simplificada: só as do próprio usuário). */
export function Sessoes({ sessoes }: { sessoes: Sessao[] }) {
  const router = useRouter();
  const pronto = useHidratado();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const outras = sessoes.filter((s) => !s.atual).length;

  async function encerrar(id: string | "outras") {
    setEnviando(id);
    setMsg(null);
    try {
      const r =
        id === "outras"
          ? await encerrarOutrasSessoesAction()
          : await encerrarSessaoAction({ sessaoId: id });
      if (r?.serverError === "SESSAO_EXPIRADA")
        return window.location.assign("/login?voltar=%2Fconta");
      const d = r?.data;
      if (!d)
        return setMsg({ tipo: "erro", texto: r?.serverError ?? "Não foi possível encerrar." });
      if (!d.ok) return setMsg({ tipo: "erro", texto: d.mensagem });
      setMsg({
        tipo: "ok",
        texto: d.encerradas === 1 ? "Sessão encerrada." : `${d.encerradas} sessões encerradas.`,
      });
      router.refresh();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão. Tente novamente." });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="acoes" style={{ maxWidth: 720 }}>
      {msg && (
        <div className={`alerta ${msg.tipo}`} role="status">
          {msg.texto}
        </div>
      )}
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Criada em</th>
              <th>Último uso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessoes.map((s) => (
              <tr key={s.id}>
                <td>
                  {descreverDispositivo(s.userAgent)}{" "}
                  {s.atual && <span className="etiqueta ok">Esta sessão</span>}
                </td>
                <td>{formatarDataHora(new Date(s.criadaEm))}</td>
                <td>{formatarDataHora(new Date(s.ultimoUso))}</td>
                <td>
                  {!s.atual && (
                    <button
                      type="button"
                      className="botao secundario"
                      style={{ width: "auto" }}
                      disabled={!pronto || enviando !== null}
                      onClick={() => encerrar(s.id)}
                    >
                      {enviando === s.id ? "Encerrando…" : "Encerrar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {outras > 0 && (
        <p>
          <button
            type="button"
            className="botao secundario"
            style={{ width: "auto" }}
            disabled={!pronto || enviando !== null}
            onClick={() => encerrar("outras")}
          >
            {enviando === "outras" ? "Encerrando…" : "Encerrar todas as outras"}
          </button>
        </p>
      )}
    </div>
  );
}
