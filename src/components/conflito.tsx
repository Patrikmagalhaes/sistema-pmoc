"use client";

/** UF-07: o registro mudou desde que a tela abriu; nada é sobrescrito sem recarregar. */
export function Conflito() {
  return (
    <div className="alerta erro" role="status">
      Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual.{" "}
      <button type="button" className="botao secundario" onClick={() => window.location.reload()}>
        Recarregar
      </button>
    </div>
  );
}
