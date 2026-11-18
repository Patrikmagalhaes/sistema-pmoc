"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tag } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { avisar } from "@/components/ui/toaster";
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
  const outras = sessoes.filter((s) => !s.atual).length;

  async function encerrar(id: string | "outras") {
    setEnviando(id);
    try {
      const r =
        id === "outras"
          ? await encerrarOutrasSessoesAction()
          : await encerrarSessaoAction({ sessaoId: id });
      if (r?.serverError === "SESSAO_EXPIRADA")
        return window.location.assign("/login?voltar=%2Fconta");
      const d = r?.data;
      if (!d) return avisar.erro(r?.serverError ?? "Não foi possível encerrar.");
      if (!d.ok) return avisar.erro(d.mensagem);
      avisar.sucesso(
        d.encerradas === 1 ? "Sessão encerrada." : `${d.encerradas} sessões encerradas.`,
      );
      router.refresh();
    } catch {
      avisar.erro("Não foi possível encerrar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Card
      titulo="Sessões ativas"
      descricao="Aparelhos em que sua conta está aberta."
      acao={
        outras > 0 && (
          <Button
            icon={<LogOut size={20} aria-hidden="true" />}
            disabled={!pronto || enviando !== null}
            loading={enviando === "outras"}
            onClick={() => encerrar("outras")}
          >
            {enviando === "outras" ? "Encerrando…" : "Encerrar todas as outras"}
          </Button>
        )
      }
    >
      <DataTable
        embutida
        rotulo="Sessões ativas"
        linhas={sessoes}
        chave={(s) => s.id}
        colunas={[
          {
            titulo: "Dispositivo",
            celula: (s) => (
              <span className="inline-flex flex-wrap items-center gap-2">
                {descreverDispositivo(s.userAgent)}
                {s.atual && <Tag>Esta sessão</Tag>}
              </span>
            ),
          },
          {
            titulo: "Criada em",
            celula: (s) => formatarDataHora(new Date(s.criadaEm)),
            numerico: true,
          },
          {
            titulo: "Último uso",
            celula: (s) => formatarDataHora(new Date(s.ultimoUso)),
            numerico: true,
          },
        ]}
        acao={{
          titulo: "Ações",
          celula: (s) =>
            !s.atual && (
              <Button
                size="sm"
                variant="tertiary"
                disabled={!pronto || enviando !== null}
                loading={enviando === s.id}
                onClick={() => encerrar(s.id)}
              >
                {enviando === s.id ? "Encerrando…" : "Encerrar"}
              </Button>
            ),
        }}
      />
    </Card>
  );
}
