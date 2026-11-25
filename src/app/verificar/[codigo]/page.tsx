import type { Metadata } from "next";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { DescriptionList } from "@/components/ui/description-list";
import { formatarDataHora } from "@/lib/formato";
import {
  codigoImpresso,
  type DocumentoVerificado,
  normalizarCodigo,
  ROTULO_SITUACAO_VERIFICADA,
  verificarDocumento,
} from "@/modules/pmoc";
import { origemAtual } from "@/server/auth/sessao";
import { getDatabase } from "@/server/db";
import { CODIGO_INVALIDO, FormularioVerificar } from "../formulario";

export const metadata: Metadata = {
  title: "Verificar documento – Sistema PMOC",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";

/** `%` malformado na URL vira texto como veio (e cai em "código inválido", sem erro 500). */
function decodificar(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Mensagens (UI) da TL-007. */
const NAO_ENCONTRADO =
  "Nenhum documento com este código. Confira o código impresso no rodapé do PDF.";
const LIMITE = "Muitas consultas a partir desta rede. Tente novamente em até 1 hora.";

/**
 * TL-007 – resultado (o link do rodapé do PDF abre aqui direto). Pública, sem login. Mostra só tipo,
 * versão, datas, hash e situação, sem nome de pessoa nem dado do cliente (INT-14; CA-26.2). Cada
 * consulta conta no limite de 30 por hora por IP (AF-09).
 */
export default async function ResultadoVerificacaoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo: bruto } = await params;
  const digitado = decodificar(bruto);
  const { ip } = await origemAtual();
  const r = await verificarDocumento(digitado, ip, { db: getDatabase() });
  const codigo = normalizarCodigo(digitado);

  return (
    <AuthCard
      largo
      titulo="Verificar documento"
      descricao={
        codigo && (
          <>
            Código <span className="font-mono break-all">{codigoImpresso(codigo)}</span>
          </>
        )
      }
    >
      {r.estado === "ENCONTRADO" && <Resultado d={r.documento} />}
      {r.estado === "NAO_ENCONTRADO" && <Alert tom="danger">{NAO_ENCONTRADO}</Alert>}
      {r.estado === "LIMITE" && <Alert tom="warning">{LIMITE}</Alert>}
      <FormularioVerificar
        valor={r.estado === "INVALIDO" ? digitado : undefined}
        erro={r.estado === "INVALIDO" ? CODIGO_INVALIDO : null}
        rotuloBotao={r.estado === "INVALIDO" ? "Verificar" : "Verificar outro código"}
      />
    </AuthCard>
  );
}

function Resultado({ d }: { d: DocumentoVerificado }) {
  const hash = (h: string) => <span className="font-mono text-small break-all">{h}</span>;
  return (
    <>
      <Alert tom="success">Documento emitido por este sistema.</Alert>
      <DescriptionList
        itens={[
          { rotulo: "Tipo de documento", valor: d.tipo },
          { rotulo: "Versão", valor: `v${d.versao}` },
          { rotulo: "Emitido em", valor: formatarDataHora(d.emitidoEm) },
          {
            rotulo: "Assinado pelo cliente em",
            valor: d.assinadoClienteEm
              ? formatarDataHora(d.assinadoClienteEm)
              : "Ainda não assinado",
          },
          { rotulo: "Situação", valor: ROTULO_SITUACAO_VERIFICADA[d.situacao] },
          {
            rotulo: "SHA-256 do PDF",
            valor: hash(d.sha256),
            ajuda: "Confira com o hash do arquivo que você recebeu.",
          },
          ...(d.sha256AssinadoCliente
            ? [
                {
                  rotulo: "SHA-256 do PDF assinado pelo cliente",
                  valor: hash(d.sha256AssinadoCliente),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
