"use client";
import { useEffect, useState } from "react";

/**
 * `true` só depois da hidratação. Botões de envio ficam desabilitados até lá: um clique antes
 * dispararia o envio nativo do formulário (GET), colocando a senha na URL.
 */
export function useHidratado(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto;
}
