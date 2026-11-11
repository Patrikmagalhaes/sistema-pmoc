"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Conflito } from "@/components/conflito";
import { chamarAcao } from "@/lib/chamar-acao";
import { decimalParaCampo, lerDecimal } from "@/lib/numero";
import { useHidratado } from "@/lib/use-hidratado";
import { atualizarEquipamentoAction, criarEquipamentoAction } from "./actions";

type Erros = Record<string, string | undefined>;

interface Opcao {
  id: string;
  nome: string;
}

export interface TipoParaNovo extends Opcao {
  previaTag: string;
  grupos: Opcao[];
}

export interface EquipamentoEditavel {
  id: string;
  rowVersion: number;
  tag: string;
  tipoNome: string;
  grupoId: string;
  grupos: Opcao[];
  ambiente: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  capacidade: string | null;
  unidade: string | null;
}

/**
 * TL-111 (RF-09; FL-07). Na criação, tipo e grupo vêm só dos `ATIVO` e a TAG aparece como prévia
 * (passo 3); depois de salvar, o tipo fica somente leitura (RN-049) e a TAG não muda (RN-046).
 */
export function EquipamentoForm({
  localId,
  tipos,
  equipamento,
  unidadePadrao,
  unidadeMax,
}: {
  localId: string;
  tipos?: TipoParaNovo[];
  equipamento?: EquipamentoEditavel;
  unidadePadrao: string;
  unidadeMax: number;
}) {
  const novo = !equipamento;
  const router = useRouter();
  const pronto = useHidratado();
  const [tipoId, setTipoId] = useState("");
  const tipo = tipos?.find((t) => t.id === tipoId);
  const grupos = novo ? (tipo?.grupos ?? []) : equipamento.grupos;
  const [erros, setErros] = useState<Erros>({});
  const [geral, setGeral] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [conflito, setConflito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const texto = (k: string) => String(f.get(k) ?? "").trim();
    const dados = {
      grupoId: texto("grupoId"),
      ambiente: texto("ambiente"),
      marca: texto("marca") || null,
      modelo: texto("modelo") || null,
      serie: texto("serie") || null,
      capacidade: texto("capacidade") || null,
      unidade: texto("unidade") || null,
    };
    const e: Erros = {};
    if (novo && !tipoId) e.tipoId = "Escolha o tipo.";
    if (!dados.grupoId) e.grupoId = "Escolha o grupo.";
    if (!dados.ambiente) e.ambiente = "Informe o ambiente."; // CA-09.3
    const capacidade = lerDecimal(dados.capacidade);
    if (capacidade !== null) {
      // E-07.3
      if (Number.isNaN(capacidade))
        e.capacidade = "Capacidade inválida (número com até 2 casas decimais).";
      else if (capacidade <= 0) e.capacidade = "A capacidade deve ser maior que zero.";
      if (!dados.unidade) e.unidade = "Informe a unidade da capacidade.";
      else if (dados.unidade.length > unidadeMax)
        e.unidade = `A unidade tem até ${unidadeMax} caracteres.`;
    }
    setErros(e);
    setGeral(null);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      (form.elements.namedItem(primeiro) as HTMLElement | null)?.focus();
      return;
    }
    setEnviando(true);
    const r = novo
      ? await chamarAcao(criarEquipamentoAction({ localId, tipoId, ...dados }))
      : await chamarAcao(
          atualizarEquipamentoAction({
            id: equipamento.id,
            rowVersion: equipamento.rowVersion,
            ...dados,
          }),
        );
    setEnviando(false);
    if (r.tipo === "conflito") return setConflito(true);
    if (r.tipo === "erro") {
      if (r.campos) setErros(r.campos);
      return setGeral({ tipo: "erro", texto: r.mensagem });
    }
    if (novo && "id" in r.dados) {
      router.push(`/adm/equipamentos/${String(r.dados.id)}?aviso=criado`);
      return;
    }
    setGeral({ tipo: "ok", texto: "Dados salvos." });
    router.refresh();
  }

  if (conflito) return <Conflito />;

  const erro = (k: string) => (erros[k] ? <span className="erro">{erros[k]}</span> : null);

  return (
    <form onSubmit={salvar} noValidate className="formulario" style={{ maxWidth: 720 }}>
      {geral && (
        <div className={`alerta ${geral.tipo}`} role="status">
          {geral.texto}
        </div>
      )}
      <div className="grade">
        <div className="campo">
          <label htmlFor="tag">TAG</label>
          <input
            id="tag"
            value={equipamento?.tag ?? (tipo ? `será gerada ao salvar: ${tipo.previaTag}` : "")}
            readOnly
            placeholder="Escolha o tipo"
          />
          <span className="dica">Gerada pelo sistema; não muda e não é reaproveitada.</span>
        </div>
        <div className="campo">
          <label htmlFor="tipoId">Tipo</label>
          {novo ? (
            <select
              id="tipoId"
              name="tipoId"
              value={tipoId}
              onChange={(ev) => setTipoId(ev.target.value)}
              // Controlado: antes da hidratação a escolha se perderia.
              disabled={!pronto}
              aria-invalid={Boolean(erros.tipoId)}
            >
              <option value="">Escolha…</option>
              {tipos?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input id="tipoId" value={equipamento.tipoNome} readOnly />
              {/* E-07.4 / RN-049 [A VALIDAR]: o tipo compõe a TAG. */}
              <span className="dica">
                O tipo compõe a TAG e não muda. Inative e cadastre outro.
              </span>
            </>
          )}
          {erro("tipoId")}
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="grupoId">Grupo</label>
          <select
            id="grupoId"
            name="grupoId"
            key={novo ? tipoId : equipamento.grupoId}
            defaultValue={novo ? "" : equipamento.grupoId}
            disabled={novo && !tipo}
            aria-invalid={Boolean(erros.grupoId)}
          >
            <option value="">Escolha…</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
          {erro("grupoId")}
        </div>
        <div className="campo">
          <label htmlFor="ambiente">Ambiente / localização interna</label>
          <input
            id="ambiente"
            name="ambiente"
            defaultValue={equipamento?.ambiente}
            placeholder="Ex.: Consultório 03"
            aria-invalid={Boolean(erros.ambiente)}
          />
          {erro("ambiente")}
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="marca">Marca (opcional)</label>
          <input id="marca" name="marca" defaultValue={equipamento?.marca ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="modelo">Modelo (opcional)</label>
          <input id="modelo" name="modelo" defaultValue={equipamento?.modelo ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="serie">Nº de série (opcional)</label>
          <input id="serie" name="serie" defaultValue={equipamento?.serie ?? ""} />
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="capacidade">Capacidade (opcional)</label>
          <input
            id="capacidade"
            name="capacidade"
            inputMode="decimal"
            defaultValue={decimalParaCampo(equipamento?.capacidade)}
            placeholder="Ex.: 12000"
            aria-invalid={Boolean(erros.capacidade)}
          />
          {erro("capacidade")}
        </div>
        <div className="campo">
          <label htmlFor="unidade">Unidade da capacidade</label>
          <input
            id="unidade"
            name="unidade"
            maxLength={unidadeMax}
            defaultValue={equipamento?.unidade ?? unidadePadrao}
            aria-invalid={Boolean(erros.unidade)}
          />
          <span className="dica">Obrigatória quando há capacidade.</span>
          {erro("unidade")}
        </div>
      </div>
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
