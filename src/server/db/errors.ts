/**
 * Nome da restrição violada (SQLSTATE 23505 `UNIQUE`, 23514 `CHECK` ou 23P01 `EXCLUDE`), procurando também em `cause`
 * (o Drizzle embrulha o erro do driver). `null` se o erro não é desse tipo.
 */
export function restricaoViolada(e: unknown): string | null {
  for (
    let x = e as { code?: string; constraint_name?: string; cause?: unknown } | null, i = 0;
    x && i < 5;
    i++
  ) {
    if (["23505", "23514", "23P01"].includes(x.code ?? "") && x.constraint_name)
      return x.constraint_name;
    x = x.cause as typeof x;
  }
  return null;
}

/** SQLSTATE 55P03 `lock_not_available`: `FOR UPDATE NOWAIT` em linha travada por outra transação. */
export function linhaTravada(e: unknown): boolean {
  for (let x = e as { code?: string; cause?: unknown } | null, i = 0; x && i < 5; i++) {
    if (x.code === "55P03") return true;
    x = x.cause as typeof x;
  }
  return false;
}
