"use client";
import { authClient } from "@/lib/auth-client";

export function BotaoSair() {
  return (
    <button
      type="button"
      className="botao secundario"
      style={{ width: "auto" }}
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/login");
      }}
    >
      Sair
    </button>
  );
}
