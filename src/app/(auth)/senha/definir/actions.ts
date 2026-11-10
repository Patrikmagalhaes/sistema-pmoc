"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { definirSenha } from "@/modules/acesso";
import { COOKIE_LINK_SENHA } from "@/proxy";
import { actionClient } from "@/server/action";
import { getAuth } from "@/server/auth";

/** TL-003 – "Salvar senha" (FL-01 passo 4). O token vem do cookie HttpOnly, nunca do navegador (SEG-16). */
export const definirSenhaAction = actionClient
  .inputSchema(z.object({ senha: z.string().max(1024) }))
  .action(async ({ parsedInput }) => {
    const jar = await cookies();
    const token = jar.get(COOKIE_LINK_SENHA)?.value;
    if (!token) return { ok: false as const, erro: "LINK_INVALIDO" as const };
    const r = await definirSenha(token, parsedInput.senha, getAuth().deps);
    if (r.ok || r.erro === "LINK_INVALIDO") jar.delete({ name: COOKIE_LINK_SENHA, path: "/senha" });
    return r;
  });
