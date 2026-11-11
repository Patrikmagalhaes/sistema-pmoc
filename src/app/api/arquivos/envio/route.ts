import { recusaSemProtecao } from "@/server/rota";
import { ehLocal, getArmazenamento } from "@/server/storage";

export const runtime = "nodejs";

/** Até 2 MB (logo, SEG-52) mais folga; o limite de cada envio está no token. */
const CORPO_MAX = 3 * 1024 * 1024;

const MENSAGEM = {
  INVALIDO: [403, "Link de envio inválido."],
  EXPIRADO: [403, "O link de envio expirou. Tente de novo."],
  JA_ENVIADO: [409, "Este link de envio já foi usado."],
  TAMANHO: [413, "Arquivo maior que o permitido."],
  TIPO: [415, "Tipo de arquivo diferente do informado."],
} as const;

/**
 * Recebe o PUT da URL de envio assinada do armazenamento **local** (05 §3.7; SEG-50). O token é a
 * autorização (como a URL assinada do Supabase). Com o Storage de produção, esta rota não existe (404).
 */
export async function PUT(req: Request) {
  const a = getArmazenamento();
  if (!ehLocal(a)) return new Response(null, { status: 404 });
  const recusa = recusaSemProtecao(req, { json: false }); // SEG-29a (o corpo é o próprio arquivo)
  if (recusa) return recusa;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > CORPO_MAX) return Response.json({ mensagem: MENSAGEM.TAMANHO[1] }, { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > CORPO_MAX)
    return Response.json({ mensagem: MENSAGEM.TAMANHO[1] }, { status: 413 });
  const r = await a.receber(token, bytes, req.headers.get("content-type") ?? "");
  if (r === "OK") return new Response(null, { status: 204 });
  const [status, mensagem] = MENSAGEM[r];
  return Response.json({ mensagem }, { status });
}
