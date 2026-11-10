import Link from "next/link";

/** Abas por `?aba=` (04 TL-109, TL-110): cada aba é um link, a página renderiza só a ativa. */
export function Abas({
  base,
  ativa,
  abas,
}: {
  base: string;
  ativa: string;
  abas: { id: string; rotulo: string }[];
}) {
  return (
    <nav className="abas" aria-label="Seções">
      {abas.map((a) => (
        <Link
          key={a.id}
          href={`${base}?aba=${a.id}`}
          aria-current={a.id === ativa ? "page" : undefined}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
