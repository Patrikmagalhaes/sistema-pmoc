/**
 * Nome da restrição violada (SQLSTATE 23505 `UNIQUE` ou 23514 `CHECK`), procurando também em `cause`
 * (o Drizzle embrulha o erro do driver). `null` se o erro não é desse tipo.
 */
export function restricaoViolada(e: unknown): string | null {
  for (
    let x = e as { code?: string; constraint_name?: string; cause?: unknown } | null, i = 0;
    x && i < 5;
    i++
  ) {
    if ((x.code === "23505" || x.code === "23514") && x.constraint_name) return x.constraint_name;
    x = x.cause as typeof x;
  }
  return null;
}
