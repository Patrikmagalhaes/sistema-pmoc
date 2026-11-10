import Link from "next/link";

/** Estados padrão de tela (04 §1.2) para `SEM_ACESSO` e `NAO_ENCONTRADO`. */
export function EstadoTela({ tipo }: { tipo: "SEM_ACESSO" | "NAO_ENCONTRADO" }) {
  const texto =
    tipo === "SEM_ACESSO" ? "Você não tem acesso a esta página." : "Não encontrado ou sem acesso."; // RN-162: não revela se existe
  return (
    <main className="centro">
      <div className="cartao">
        <p>{texto}</p>
        {/* "/" leva à tela inicial do perfil (ou ao login). */}
        <Link className="botao" href="/" style={{ display: "block", textAlign: "center" }}>
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
