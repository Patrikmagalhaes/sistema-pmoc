import { z } from "zod";
import { ErroArquivos, FINALIDADES, type Finalidade, prepararEnvio } from "@/modules/arquivos";
import { arquivosDeps } from "@/server/arquivos";
import { sessaoAtual } from "@/server/auth/sessao";
import { recusaSemProtecao } from "@/server/rota";

export const runtime = "nodejs";

const pedido = z.object({
  finalidade: z.enum(Object.keys(FINALIDADES) as [Finalidade, ...Finalidade[]]),
  nome: z.string().nullish(),
  mime: z.string(),
  tamanho: z.number().int(),
  sha256: z.string(),
});

/**
 * `POST /api/arquivos` (05 §3.1, §3.7; SEG-50): o servidor confere o envio declarado, decide a chave e
 * devolve a URL de envio assinada e o comprovante que a tela entrega ao salvar (SEG-53).
 */
export async function POST(req: Request) {
  const recusa = recusaSemProtecao(req, { json: true }); // SEG-29a
  if (recusa) return recusa;
  const s = await sessaoAtual();
  if (s.estado !== "OK") return Response.json({ codigo: "SESSAO_EXPIRADA" }, { status: 401 });
  const v = pedido.safeParse(await req.json().catch(() => null));
  if (!v.success) return Response.json({ mensagem: "Pedido de envio inválido." }, { status: 400 });
  try {
    return Response.json(
      await prepararEnvio(s.ctx, { ...v.data, nome: v.data.nome ?? null }, arquivosDeps()),
    );
  } catch (e) {
    if (!(e instanceof ErroArquivos)) throw e;
    return Response.json(
      { codigo: e.codigo, mensagem: e.message },
      { status: e.codigo === "SEM_PERMISSAO" ? 403 : 422 },
    );
  }
}
