import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page-header";
import {
  obterTipo,
  ROTULO_NATUREZA,
  ROTULO_PERIODICIDADE,
  SEM_EXCLUIR_TIPO_FILHOS,
  UNIDADE_MAX,
} from "@/modules/biblioteca";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { TipoForm } from "../tipo-form";
import { AcoesItem } from "./acoes-item";
import { Atividades } from "./atividades";
import { Grupos } from "./grupos";

export const metadata = { title: "Tipo de equipamento – Sistema PMOC" };

/**
 * TL-105 – Tipo de equipamento: dados, grupos e atividades padrão (FL-03; RF-08). Tela de gestão em
 * seções (doc 08 §5.11): Dados do tipo, Grupos permitidos e Atividades padrão, cada uma em Card.
 */
export default async function TipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await obterTipo(s.ctx, id, { db: getDatabase() });
  if (!r) notFound();
  const { tipo, grupos, atividades } = r;

  return (
    <Page>
      <PageHeader
        migalhas={[{ rotulo: "Tipos de equipamento", href: "/adm/tipos" }, { rotulo: tipo.nome }]}
        titulo={`${tipo.nome} (${tipo.sigla})`}
        estado={<StatusBadge tipo="situacao" valor={tipo.situacao} tamanho="lg" />}
        meta={
          tipo.emUso
            ? "Este tipo já foi usado (PMOC ou equipamento): só pode ser inativado."
            : undefined
        }
        acoes={
          <AcoesItem
            alvo="tipo"
            id={tipo.id}
            rowVersion={tipo.rowVersion}
            nome={tipo.nome}
            situacao={tipo.situacao}
            emUso={tipo.emUso}
            aoExcluir="/adm/tipos"
            motivoSemExcluir={tipo.filhosVivos ? SEM_EXCLUIR_TIPO_FILHOS : undefined}
          />
        }
      />
      {sp.aviso === "criado" && (
        <Alert tom="success">Tipo criado. Agora inclua as atividades padrão.</Alert>
      )}
      <Alert tom="info">
        A biblioteca é o padrão: alterações aqui não mudam PMOCs já criados (RF-08.5).
      </Alert>

      <TipoForm key={tipo.rowVersion} tipo={tipo} />

      <Card
        id="grupos"
        titulo="Grupos permitidos"
        descricao="O tipo ativo mantém ao menos um grupo ativo."
      >
        <Grupos tipoId={tipo.id} grupos={grupos} />
      </Card>

      <Card
        id="atividades"
        titulo="Atividades padrão"
        descricao="Ordenadas por periodicidade e depois pela ordem de exibição."
      >
        <Atividades
          tipoId={tipo.id}
          atividades={atividades}
          rotulos={{
            periodicidade: ROTULO_PERIODICIDADE,
            natureza: ROTULO_NATUREZA,
            unidadeMax: UNIDADE_MAX,
          }}
        />
      </Card>
    </Page>
  );
}
