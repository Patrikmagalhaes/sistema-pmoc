import forge from "node-forge";

/** Certificado e-CPF A1 do RT (RF-04.4; RN-153; 04 TL-103, E-02.3 a E-02.6). Sem banco. */

/** RN-153: `A_VENCER` com 30 dias ou menos (prazo confirmado em R2 2.11). */
export const DIAS_A_VENCER = 30;

/** SEG-52 [A VALIDAR]: até 50 KB. */
export const CERTIFICADO_MAX = 50 * 1024;

/** SEG-51: `.pfx` ou `.p12`. */
export const EXTENSOES_CERTIFICADO = [".pfx", ".p12"] as const;

export type EstadoCertificado = "VALIDO" | "A_VENCER" | "VENCIDO";

const DIA = 24 * 60 * 60 * 1000;

/** RN-153 (03 §6): calculado na leitura, nunca gravado (decisão C9). */
export function estadoDoCertificado(validoAte: Date, agora: Date): EstadoCertificado {
  if (validoAte.getTime() < agora.getTime()) return "VENCIDO";
  if (validoAte.getTime() < agora.getTime() + DIAS_A_VENCER * DIA) return "A_VENCER";
  return "VALIDO";
}

/** 04 §1.5: "Vence em {n} dias" (dias inteiros que faltam, arredondados para cima). */
export const diasParaVencer = (validoAte: Date, agora: Date) =>
  Math.max(0, Math.ceil((validoAte.getTime() - agora.getTime()) / DIA));

export const extensaoAceita = (nome: string) =>
  EXTENSOES_CERTIFICADO.some((e) => nome.toLowerCase().endsWith(e));

export class ErroPkcs12 extends Error {
  constructor(
    /** E-02.3 senha errada; E-02.4 arquivo ilegível. */
    readonly codigo: "SENHA" | "INVALIDO",
  ) {
    super(
      codigo === "SENHA" ? "Senha do certificado incorreta." : "Arquivo de certificado inválido.",
    );
  }
}

export interface DadosCertificado {
  /** Nome do titular (o CN do e-CPF ICP-Brasil é "NOME:CPF"; guardamos só o nome). */
  titular: string;
  serie: string;
  emissor: string | null;
  validoDe: Date;
  validoAte: Date;
}

const textoDoCampo = (v: unknown) => {
  if (typeof v !== "string") return null;
  // O node-forge entrega UTF8String como bytes em latin1; decodifica quando for UTF-8 válido.
  try {
    return forge.util.decodeUtf8(v);
  } catch {
    return v;
  }
};

/**
 * FL-02 passo 5: abre o PKCS#12 com a senha e lê o certificado do par com a chave privada (A1).
 * Só em memória; nada daqui vai para log (RN-121).
 */
export function lerPkcs12(bytes: Uint8Array, senha: string): DadosCertificado {
  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(bytes).toString("binary")));
  } catch {
    throw new ErroPkcs12("INVALIDO");
  }
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch (e) {
    throw new ErroPkcs12(/password/i.test(String((e as Error)?.message)) ? "SENHA" : "INVALIDO");
  }
  const { oids } = forge.pki;
  const sacos = (tipo: string) => p12.getBags({ bagType: tipo })[tipo] ?? [];
  const chave = [...sacos(oids.pkcs8ShroudedKeyBag ?? ""), ...sacos(oids.keyBag ?? "")]
    .map((b) => b.key as forge.pki.rsa.PrivateKey | undefined)
    .find(Boolean);
  const certs = sacos(oids.certBag ?? "")
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));
  // A1 sem chave privada não assina (RF-13).
  if (!chave) throw new ErroPkcs12("INVALIDO");
  const cert = certs.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n?.equals(chave.n));
  if (!cert) throw new ErroPkcs12("INVALIDO");
  const cn = textoDoCampo(cert.subject.getField("CN")?.value) ?? "";
  const titular = cn.split(":")[0]?.trim() ?? "";
  if (!titular) throw new ErroPkcs12("INVALIDO");
  return {
    titular,
    serie: cert.serialNumber.toUpperCase(),
    emissor: textoDoCampo(cert.issuer.getField("CN")?.value),
    validoDe: cert.validity.notBefore,
    validoAte: cert.validity.notAfter,
  };
}

const normalizarNome = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

/** E-02.6: o titular é o RT cadastrado (sem acento, caixa e espaços). Divergente só avisa. */
export const titularConfere = (titular: string, nomeRt: string) =>
  normalizarNome(titular) === normalizarNome(nomeRt);
