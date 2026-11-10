"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { chamarAcao } from "@/lib/chamar-acao";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarContratoAction, criarContratoAction } from "../clientes/actions";

type Erros = Record<string, string | undefined>;

export interface ContratoEditavel {
  id: string;
  rowVersion: number;
  inicio: string;
  fim: string;
  meses: number;
  art: string;
  th: string | null;
  revisao: string | null;
}

/**
 * TL-112 – campos do contrato (RF-07; RN-176). Datas somente leitura depois da emissão (E-06.4);
 * tudo somente leitura quando cancelado (E-06.7).
 */
export function ContratoForm({
  localId,
  anteriorId,
  inicioSugerido,
  contrato,
  datasTravadas = false,
  somenteLeitura = false,
}: {
  localId: string;
  /** Renovação (FL-06): contrato anterior do mesmo local. */
  anteriorId?: string;
  /** Renovação: dia seguinte ao fim do anterior (UI). */
  inicioSugerido?: string;
  contrato?: ContratoEditavel;
  datasTravadas?: boolean;
  somenteLeitura?: boolean;
}) {
  const novo = !contrato;
  const router = useRouter();
  const pronto = useHidratado();
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const t = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      inicio: datasTravadas && contrato ? contrato.inicio : t("inicio"),
      fim: datasTravadas && contrato ? contrato.fim : t("fim"),
      art: t("art"),
      th: t("th") || null,
      revisao: t("revisao") || null,
    };
    const e: Erros = {};
    if (!dados.inicio) e.inicio = "Informe a data de início.";
    if (!dados.fim) e.fim = "Informe a data de fim.";
    else if (dados.inicio && dados.fim <= dados.inicio)
      e.fim = "A data de fim deve ser depois da de início."; // E-06.1
    if (!dados.art) e.art = "Informe o nº da ART."; // E-06.3
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarContratoAction({ localId, anteriorId: anteriorId ?? null, ...dados }))
      : await chamarAcao(
          atualizarContratoAction({ id: contrato.id, rowVersion: contrato.rowVersion, ...dados }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/contratos/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    setGeral({ tipo: "ok", texto: "Contrato salvo." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);
  const travaData = somenteLeitura || datasTravadas;

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="grade">
        <div className="campo">
          <label htmlFor="inicio">Data de início</label>
          <input
            id="inicio"
            name="inicio"
            type="date"
            defaultValue={contrato?.inicio ?? inicioSugerido}
            readOnly={travaData}
            aria-invalid={Boolean(erros.inicio)}
          />
          {erro("inicio")}
        </div>
        <div className="campo">
          <label htmlFor="fim">Data de fim</label>
          <input
            id="fim"
            name="fim"
            type="date"
            defaultValue={contrato?.fim}
            readOnly={travaData}
            aria-invalid={Boolean(erros.fim)}
          />
          {erro("fim")}
        </div>
        <div className="campo">
          <label htmlFor="meses">Nº de meses</label>
          <input
            id="meses"
            value={contrato ? String(contrato.meses) : ""}
            readOnly
            placeholder="Calculado ao salvar"
          />
        </div>
      </div>
      {datasTravadas && !somenteLeitura && (
        <p className="dica">
          Datas travadas após a emissão. Para encerrar antes, cancele o contrato.
        </p>
      )}
      <div className="grade">
        <div className="campo">
          <label htmlFor="art">Nº da ART</label>
          <input
            id="art"
            name="art"
            defaultValue={contrato?.art}
            readOnly={somenteLeitura}
            aria-invalid={Boolean(erros.art)}
          />
          {erro("art")}
        </div>
        <div className="campo">
          <label htmlFor="th">Código TH (opcional)</label>
          <input
            id="th"
            name="th"
            maxLength={30}
            defaultValue={contrato?.th ?? ""}
            readOnly={somenteLeitura}
            aria-invalid={Boolean(erros.th)}
          />
          {erro("th")}
        </div>
        <div className="campo">
          <label htmlFor="revisao">Revisão (opcional)</label>
          <input
            id="revisao"
            name="revisao"
            maxLength={10}
            defaultValue={contrato?.revisao ?? ""}
            readOnly={somenteLeitura}
            aria-invalid={Boolean(erros.revisao)}
          />
          {erro("revisao")}
        </div>
      </div>
      {!somenteLeitura && (
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      )}
    </form>
  );
}
