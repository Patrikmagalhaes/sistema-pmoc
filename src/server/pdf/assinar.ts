import "server-only";
import { createHash, sign as rsaSign } from "node:crypto";
import { Signer, SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";
import { APP_NAME } from "@/lib/brand";
import { adicionarCampoDeAssinatura } from "./campo-assinatura";

/**
 * Assinatura PAdES (perfil B-B, ETSI EN 319 142-1) do PDF com o e-CPF A1 do RT (RF-13, RN-120,
 * RN-190; ADR-07). Promovida do spike S-02.
 *
 * O campo de assinatura é criado por `campo-assinatura.ts` (código próprio); o `@signpdf/signpdf` só
 * preenche o ByteRange e o /Contents; o CMS é montado aqui. O PKCS#7 do
 * node-forge não serve: só grava contentType, messageDigest e signingTime, e o PAdES exige o atributo
 * `signing-certificate-v2` e proíbe o `signing-time` (a hora vai no /M do dicionário).
 *
 * RN-121: o PKCS#12, a senha e a chave só existem em memória, dentro da requisição; nada daqui vai
 * para log, e as mensagens de erro nunca carregam dados do certificado.
 */

const { asn1 } = forge;
const U = asn1.Class.UNIVERSAL;
const C = asn1.Class.CONTEXT_SPECIFIC;

export const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsaEncryption: "1.2.840.113549.1.1.1",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
} as const;

export const SUBFILTER_PADES = "ETSI.CAdES.detached";
/** Bytes reservados no /Contents. Cadeia ICP-Brasil (titular + 2 ACs) passa de 6 KB (S-02). */
export const TAMANHO_ASSINATURA = 16_384;

/** E-08.6: a emissão desfaz tudo; o código diz o motivo sem expor o certificado. */
export class ErroAssinatura extends Error {
  constructor(readonly codigo: "SENHA" | "CERTIFICADO_INVALIDO" | "FORA_DA_VALIDADE" | "FALHA") {
    super(
      {
        SENHA: "A senha guardada não abre o certificado do RT.",
        CERTIFICADO_INVALIDO: "O certificado do RT não pôde ser lido.",
        FORA_DA_VALIDADE: "O certificado do RT está fora da validade.",
        FALHA: "Não foi possível assinar o PDF.",
      }[codigo],
    );
  }
}

const oid = (o: string) => asn1.create(U, asn1.Type.OID, false, asn1.oidToDer(o).getBytes());
const seq = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SEQUENCE, true, v);
const set = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SET, true, v);
const octets = (b: string) => asn1.create(U, asn1.Type.OCTETSTRING, false, b);
const int = (b: string) => asn1.create(U, asn1.Type.INTEGER, false, b);
const algSha256 = () => seq([oid(OID.sha256)]);
const atributo = (tipo: string, valor: forge.asn1.Asn1) => seq([oid(tipo), set([valor])]);
const der = (a: forge.asn1.Asn1) => Buffer.from(asn1.toDer(a).getBytes(), "binary");

export interface CertificadoA1 {
  chave: forge.pki.rsa.PrivateKey;
  /** O primeiro é o do titular (o que casa com a chave); depois, as ACs que vierem no arquivo. */
  cadeia: forge.pki.Certificate[];
}

/** Abre o PKCS#12 (A1) com a senha, como na leitura do envio (módulo `empresa`, FL-02 passo 5). */
export function lerCertificadoA1(p12: Uint8Array, senha: string): CertificadoA1 {
  let a: forge.asn1.Asn1;
  try {
    a = asn1.fromDer(forge.util.createBuffer(Buffer.from(p12).toString("binary")));
  } catch {
    throw new ErroAssinatura("CERTIFICADO_INVALIDO");
  }
  let pfx: forge.pkcs12.Pkcs12Pfx;
  try {
    pfx = forge.pkcs12.pkcs12FromAsn1(a, false, senha);
  } catch (e) {
    throw new ErroAssinatura(
      /password/i.test(String((e as Error)?.message)) ? "SENHA" : "CERTIFICADO_INVALIDO",
    );
  }
  const { oids } = forge.pki;
  const sacos = (tipo: string) => pfx.getBags({ bagType: tipo })[tipo] ?? [];
  const chave = [...sacos(oids.pkcs8ShroudedKeyBag ?? ""), ...sacos(oids.keyBag ?? "")]
    .map((b) => b.key as forge.pki.rsa.PrivateKey | undefined)
    .find(Boolean);
  const certs = sacos(oids.certBag ?? "")
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));
  if (!chave) throw new ErroAssinatura("CERTIFICADO_INVALIDO");
  const titular = certs.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n?.equals(chave.n));
  if (!titular) throw new ErroAssinatura("CERTIFICADO_INVALIDO");
  return { chave, cadeia: [titular, ...certs.filter((c) => c !== titular)] };
}

class SignerPades extends Signer {
  constructor(private readonly a1: CertificadoA1) {
    super();
  }

  async sign(conteudo: Buffer): Promise<Buffer> {
    const [titular] = this.a1.cadeia;
    if (!titular) throw new ErroAssinatura("CERTIFICADO_INVALIDO");
    const certDer = asn1.toDer(forge.pki.certificateToAsn1(titular)).getBytes();
    const emissor = forge.pki.distinguishedNameToAsn1(titular.issuer);
    const serial = int(forge.util.hexToBytes(titular.serialNumber));

    // ESSCertIDv2 com hashAlgorithm omitido (DEFAULT sha256) e issuerSerial (RFC 5035).
    const issuerSerial = seq([seq([asn1.create(C, 4, true, [emissor])]), serial]);
    const certHash = createHash("sha256").update(Buffer.from(certDer, "binary")).digest("binary");
    const attrs = [
      atributo(OID.contentType, oid(OID.data)),
      atributo(OID.messageDigest, octets(createHash("sha256").update(conteudo).digest("binary"))),
      atributo(OID.signingCertificateV2, seq([seq([seq([octets(certHash), issuerSerial])])])),
    ];
    // A assinatura cobre o DER do SET OF (DER ordena os elementos; o forge não, então ordenamos aqui).
    attrs.sort((a, b) => Buffer.compare(der(a), der(b)));
    const chavePem = forge.pki.privateKeyToPem(this.a1.chave);
    const assinatura = rsaSign("sha256", der(set(attrs)), chavePem).toString("binary");

    const signerInfo = seq([
      int(String.fromCharCode(1)),
      seq([emissor, serial]),
      algSha256(),
      asn1.create(C, 0, true, attrs),
      seq([oid(OID.rsaEncryption), asn1.create(U, asn1.Type.NULL, false, "")]),
      octets(assinatura),
    ]);
    const signedData = seq([
      int(String.fromCharCode(1)),
      set([algSha256()]),
      seq([oid(OID.data)]),
      asn1.create(
        C,
        0,
        true,
        this.a1.cadeia.map((c) => forge.pki.certificateToAsn1(c)),
      ),
      set([signerInfo]),
    ]);
    return der(seq([oid(OID.signedData), asn1.create(C, 0, true, [signedData])]));
  }
}

export interface OpcoesAssinatura {
  /** Nome no campo de assinatura (o RT). */
  nome: string;
  motivo: string;
  local: string;
  /** Hora da assinatura (/M). Também a referência para conferir a validade. */
  quando: Date;
}

/** Assina com um A1 já aberto. Certificado fora da validade em `quando` é recusado (RN-008). */
export async function assinarPades(
  pdf: Buffer,
  a1: CertificadoA1,
  o: OpcoesAssinatura,
): Promise<Buffer> {
  const titular = a1.cadeia[0];
  if (!titular) throw new ErroAssinatura("CERTIFICADO_INVALIDO");
  const t = o.quando.getTime();
  if (t < titular.validity.notBefore.getTime() || t > titular.validity.notAfter.getTime()) {
    throw new ErroAssinatura("FORA_DA_VALIDADE");
  }
  try {
    const comCampo = adicionarCampoDeAssinatura(pdf, {
      nome: o.nome,
      motivo: o.motivo,
      local: o.local,
      quando: o.quando,
      subFilter: SUBFILTER_PADES,
      tamanhoAssinatura: TAMANHO_ASSINATURA,
      aplicativo: APP_NAME,
    });
    return await new SignPdf().sign(comCampo, new SignerPades(a1));
  } catch (e) {
    if (e instanceof ErroAssinatura) throw e;
    // Sem `cause`: a mensagem da biblioteca pode citar dados do certificado (RN-121).
    throw new ErroAssinatura("FALHA");
  }
}

/** RN-120: abre o A1 guardado (PKCS#12 e senha já decifrados pelo módulo `empresa`) e assina. */
export async function assinarPdfComA1(
  pdf: Buffer,
  certificado: { pkcs12: Buffer; senha: string },
  o: OpcoesAssinatura,
): Promise<Buffer> {
  // `async`: certificado que não abre vira promessa rejeitada, como a falha da assinatura.
  return assinarPades(pdf, lerCertificadoA1(certificado.pkcs12, certificado.senha), o);
}
