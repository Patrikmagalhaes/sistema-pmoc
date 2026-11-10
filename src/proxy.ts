import { type NextRequest, NextResponse } from "next/server";

/** Cookie que guarda o token do link de senha depois de tirado da URL (06 SEG-16). */
export const COOKIE_LINK_SENHA = "pmoc_link_senha";
/** Cabeçalho com a rota atual, para o retorno após o login (04 §1.2 `SESSAO_EXPIRADA`). */
export const HEADER_ROTA = "x-pmoc-rota";

/** Validade máxima do link (inicial: 72 h; recuperação: 30 min, conferida no servidor). SEG-15. */
const LINK_MAX_SEGUNDOS = 72 * 60 * 60;

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // SEG-16: no primeiro acesso, troca o token da URL por um cookie e redireciona sem ele,
  // para não vazar pelo Referer nem ficar no histórico.
  if (pathname === "/senha/definir" && searchParams.has("token")) {
    const res = NextResponse.redirect(new URL("/senha/definir", request.url));
    res.cookies.set(COOKIE_LINK_SENHA, searchParams.get("token") ?? "", {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/senha",
      maxAge: LINK_MAX_SEGUNDOS,
    });
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  const headers = new Headers(request.headers);
  headers.set(HEADER_ROTA, pathname + request.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  if (pathname.startsWith("/senha")) res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|brand/).*)"],
};
