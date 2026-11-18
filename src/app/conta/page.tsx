import { KeyRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Area } from "@/components/area";
import { AdmShell } from "@/components/layout/adm-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarData, ROTULO_PERFIL } from "@/lib/formato";
import { minhaConta, minhasSessoes, segundoFatorAtivoDesde } from "@/modules/acesso";
import { listarClientesParaSelecao } from "@/modules/clientes";
import { getAuth } from "@/server/auth";
import { exigirArea } from "@/server/auth/sessao";
import { getEnv } from "@/server/env";
import { DadosForm } from "./dados-form";
import { SenhaForm } from "./senha-form";
import { Sessoes } from "./sessoes";

export const runtime = "nodejs";
export const metadata = { title: "Minha conta – Sistema PMOC" };

/**
 * TL-005 – Minha conta (todos os perfis; 04 §4.5). ADM sem segundo fator vai antes para TL-004.
 * Template T-FORM com seções Dados · Senha · Sessões · Meus dados (LGPD) (doc 08 §7.4), dentro da
 * moldura da área do perfil (aberta pelo menu do usuário).
 */
export default async function MinhaContaPage() {
  const s = await exigirArea(["ADM", "TECNICO", "CLIENTE"]);
  const deps = getAuth().deps;
  const [u, sessoes, desde, clientes] = await Promise.all([
    minhaConta(s.ctx, deps),
    minhasSessoes(s.ctx, s.sessaoId, deps),
    s.usuario.perfil === "ADM" ? segundoFatorAtivoDesde(s.ctx, deps) : Promise.resolve(null),
    s.usuario.perfil === "CLIENTE" ? listarClientesParaSelecao(s.ctx, deps) : Promise.resolve([]),
  ]);
  const cliente = clientes.find((c) => c.id === u.clientId)?.razaoSocial;
  const canal = getEnv().PRIVACIDADE_EMAIL;
  const perfil = ROTULO_PERFIL[u.perfil];

  const conteudo = (
    <Page largura="form">
      <PageHeader titulo="Minha conta" meta={cliente ? `${perfil} · ${cliente}` : perfil} />
      <DadosForm
        rowVersion={u.rowVersion}
        nome={u.nome}
        email={u.email}
        telefone={u.telefone}
        vinculo={cliente ? `${perfil} · ${cliente}` : perfil}
      />
      <SenhaForm />
      <Sessoes
        sessoes={sessoes.map((x) => ({
          ...x,
          criadaEm: x.criadaEm.toISOString(),
          ultimoUso: x.ultimoUso.toISOString(),
        }))}
      />

      {u.perfil === "ADM" && (
        <Card
          titulo="Segundo fator"
          descricao={`Ativo${desde ? ` desde ${formatarData(desde)}` : ""}.`}
          acao={
            <Link href="/conta/segundo-fator" className={buttonClasses({ variant: "secondary" })}>
              <KeyRound size={20} aria-hidden="true" />
              Gerar novos códigos de recuperação
            </Link>
          }
        />
      )}

      <Card titulo="Seus dados (LGPD)">
        <div className="flex max-w-prose flex-col gap-3 text-body text-text">
          <p>
            Você pode pedir a confirmação e o acesso aos seus dados, a correção, a anonimização, o
            bloqueio ou a eliminação do que não for necessário, a portabilidade e informações sobre
            com quem os dados são compartilhados. Nome e telefone você corrige aqui mesmo.
          </p>
          <p>
            Para os demais pedidos,{" "}
            {canal ? (
              <>
                escreva para <a href={`mailto:${canal}`}>{canal}</a>.
              </>
            ) : (
              "fale com o administrador do sistema."
            )}
          </p>
        </div>
      </Card>
    </Page>
  );

  return (
    <Moldura perfil={u.perfil} nome={u.nome}>
      {conteudo}
    </Moldura>
  );
}

function Moldura({
  perfil,
  nome,
  children,
}: {
  perfil: keyof typeof ROTULO_PERFIL;
  nome: string;
  children: ReactNode;
}) {
  if (perfil === "ADM")
    return (
      <AdmShell nome={nome} perfil={ROTULO_PERFIL.ADM}>
        {children}
      </AdmShell>
    );
  return (
    <Area
      titulo={perfil === "CLIENTE" ? "Portal do cliente" : "Visitas"}
      nome={nome}
      perfil={ROTULO_PERFIL[perfil]}
      largura={perfil === "CLIENTE" ? "portal" : "pwa"}
    >
      {children}
    </Area>
  );
}
