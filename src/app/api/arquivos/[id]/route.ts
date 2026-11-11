import { lerArquivo } from "@/modules/arquivos";
import { arquivosDeps } from "@/server/arquivos";
import { sessaoAtual } from "@/server/auth/sessao";

export const runtime = "nodejs";

/**
 * `/api/arquivos/:id` (05 §3.7; RN-171): confere sessão e permissão e entrega o arquivo. Sem acesso ou
 * inexistente: 404 (RN-162). No armazenamento local entrega os bytes; com o Supabase, vai redirecionar
 * para a URL assinada de 5 minutos [A VALIDAR].
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessaoAtual();
  if (s.estado !== "OK") return new Response(null, { status: 401 });
  const a = await lerArquivo(s.ctx, (await params).id, arquivosDeps());
  if (!a) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(a.bytes), {
    headers: {
      "content-type": a.mime,
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
