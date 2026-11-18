import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Page, PageHeader } from "@/components/ui/page-header";
import { formatarData } from "@/lib/formato";
import { obterEquipamento, UNIDADE_MAX, UNIDADE_PADRAO } from "@/modules/equipamentos";
import { exigirArea } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { Excluir } from "../../clientes/excluir";
import { EquipamentoForm } from "../equipamento-form";
import { SituacaoEquipamento } from "./situacao";

export const metadata = { title: "Equipamento – Sistema PMOC" };

/**
 * TL-111 – Equipamento (RF-09; FL-07). Template T-FORM com o estado no cabeçalho (doc 08 §7.3). Com
 * PMOC em rascunho, as mudanças valem na hora (RN-006). Os diálogos de impacto do PMOC emitido
 * (RN-067, RN-068) chegam com o recálculo pós-emissão; até lá, local com PMOC emitido não inclui,
 * inativa, reativa nem exclui equipamento.
 */
export default async function EquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await exigirArea(["ADM"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const e = await obterEquipamento(s.ctx, id, { db: getDatabase() });
  if (!e) notFound();

  return (
    <Page largura="form">
      <PageHeader
        migalhas={[
          { rotulo: "Clientes", href: "/adm/clientes" },
          {
            rotulo: `${e.localNome} (${e.localCodigo})`,
            href: `/adm/locais/${e.localId}?aba=equipamentos`,
          },
          { rotulo: e.tag },
        ]}
        titulo={<span className="font-mono">{e.tag}</span>}
        estado={<StatusBadge tipo="situacao" valor={e.situacao} tamanho="lg" />}
        meta={
          e.situacao === "INATIVO"
            ? `Inativo desde ${formatarData(e.inativadoEm)}.`
            : `${e.tipoNome} · ${e.ambiente}`
        }
        acoes={
          <>
            <SituacaoEquipamento
              id={e.id}
              rowVersion={e.rowVersion}
              situacao={e.situacao}
              bloqueio={e.bloqueio}
            />
            {/* E-07.5: com registro, só "Inativar". */}
            {e.podeExcluir && (
              <Excluir
                alvo="equipamento"
                id={e.id}
                rowVersion={e.rowVersion}
                nome={e.tag}
                bloqueio={e.bloqueio}
                depois={`/adm/locais/${e.localId}?aba=equipamentos`}
              />
            )}
          </>
        }
      />
      {sp.aviso === "criado" && <Alert tom="success">Equipamento criado com a TAG {e.tag}.</Alert>}

      <EquipamentoForm
        key={e.rowVersion}
        localId={e.localId}
        equipamento={e}
        unidadePadrao={UNIDADE_PADRAO}
        unidadeMax={UNIDADE_MAX}
      />
    </Page>
  );
}
