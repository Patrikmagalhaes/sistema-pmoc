import "server-only";
import { getEnv } from "./env";

/**
 * SEG-29a – CSRF em Route Handlers (`/api/sync/v1/*`, `/api/arquivos/*`): `Origin` igual ao do sistema,
 * `X-App-Version` presente e, quando o corpo é JSON, `Content-Type: application/json`. `null` = passa;
 * senão, a resposta de recusa.
 */
export function recusaSemProtecao(req: Request, o: { json: boolean }): Response | null {
  if (req.headers.get("origin") !== new URL(getEnv().APP_URL).origin) {
    return Response.json({ mensagem: "Origem não permitida." }, { status: 403 });
  }
  if (!req.headers.get("x-app-version")) {
    return Response.json({ mensagem: "Versão do aplicativo ausente." }, { status: 400 });
  }
  if (o.json && !req.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ mensagem: "Envie JSON." }, { status: 415 });
  }
  return null;
}
