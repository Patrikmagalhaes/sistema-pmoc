/** Regras puras de arquivo enviado (06 SEG-50 a SEG-53). Sem banco nem Storage. */

interface TipoAceito {
  ext: string;
  /** SEG-53: primeiros bytes do formato. */
  assinatura: readonly number[];
}

interface RegraFinalidade {
  /** SEG-51: tipos aceitos (SVG proibido). */
  tipos: Readonly<Record<string, TipoAceito>>;
  /** SEG-52 [A VALIDAR]. */
  tamanhoMax: number;
  /** Mensagem do tipo ou tamanho não aceito. */
  mensagem: string;
}

const PNG: TipoAceito = { ext: "png", assinatura: [0x89, 0x50, 0x4e, 0x47] };
const JPEG: TipoAceito = { ext: "jpg", assinatura: [0xff, 0xd8, 0xff] };

/** Finalidades com envio pelo navegador. As demais (foto, PDF manual) entram com as etapas delas. */
export const FINALIDADES = {
  LOGO_EMPRESA: {
    tipos: { "image/png": PNG, "image/jpeg": JPEG },
    tamanhoMax: 2 * 1024 * 1024,
    mensagem: "Envie uma imagem PNG ou JPEG de até 2 MB.", // E-02.2
  },
} as const satisfies Record<string, RegraFinalidade>;

export type Finalidade = keyof typeof FINALIDADES;

/** Prazo da URL de envio [A VALIDAR] (05 §3.7 não fixa; o de leitura é 5 min). */
export const PRAZO_ENVIO_S = 10 * 60;

export const SHA256 = /^[0-9a-f]{64}$/;

/** SEG-51 / SEG-52: `null` se aceito; senão a mensagem. */
export function conferirEnvio(f: Finalidade, mime: string, tamanho: number): string | null {
  const r: RegraFinalidade = FINALIDADES[f];
  return r.tipos[mime] && tamanho > 0 && tamanho <= r.tamanhoMax ? null : r.mensagem;
}

/** SEG-50: `{kind}/{yyyy}/{mm}/{uuid}.{ext}`; o nome original nunca entra na chave. */
export function chaveDoObjeto(f: Finalidade, mime: string, agora: Date, uuid: string): string {
  const r: RegraFinalidade = FINALIDADES[f];
  const ext = r.tipos[mime]?.ext;
  if (!ext) throw new Error("Tipo de arquivo não aceito.");
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${f.toLowerCase()}/${agora.getUTCFullYear()}/${mes}/${uuid}.${ext}`;
}

/** SEG-53: os primeiros bytes conferem com o formato declarado. */
export function assinaturaConfere(f: Finalidade, mime: string, bytes: Uint8Array): boolean {
  const r: RegraFinalidade = FINALIDADES[f];
  const a = r.tipos[mime]?.assinatura;
  return Boolean(a) && (a ?? []).every((b, i) => bytes[i] === b);
}
