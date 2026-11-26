/** "Hoje" no fuso de negócio (America/Sao_Paulo), a partir do instante recebido (MOD-06). */
export function hojeEmSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}
