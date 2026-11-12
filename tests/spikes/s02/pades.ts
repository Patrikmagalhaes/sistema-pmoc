/**
 * Spike S-02 (docs/05 §10.4): assinatura PAdES (perfil B-B, ETSI EN 319 142-1) com o A1 do RT.
 *
 * O `@signpdf/signpdf` só cuida do ByteRange e do /Contents; o CMS é montado aqui. O PKCS#7 do
 * node-forge não serve: só sabe gravar contentType, messageDigest e signingTime, e o PAdES exige o
 * atributo `signing-certificate-v2` e proíbe o `signing-time` (a hora vai no /M do dicionário).
 */
import { createHash, sign as rsaSign } from "node:crypto";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { Signer, SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";

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
/** Bytes reservados no /Contents. Cadeia ICP-Brasil (titular + 2 ACs) passa de 6 KB; 8 KB (padrão) é justo. */
export const TAMANHO_ASSINATURA = 16_384;

const oid = (o: string) => asn1.create(U, asn1.Type.OID, false, asn1.oidToDer(o).getBytes());
const seq = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SEQUENCE, true, v);
const set = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SET, true, v);
const octets = (b: string) => asn1.create(U, asn1.Type.OCTETSTRING, false, b);
const int = (b: string) => asn1.create(U, asn1.Type.INTEGER, false, b);
const algSha256 = () => seq([oid(OID.sha256)]);
const atributo = (tipo: string, valor: forge.asn1.Asn1) => seq([oid(tipo), set([valor])]);
const der = (a: forge.asn1.Asn1) => Buffer.from(asn1.toDer(a).getBytes(), "binary");

export type CertificadoA1 = { chave: forge.pki.rsa.PrivateKey; cadeia: forge.pki.Certificate[] };

/** Lê o PKCS#12; o primeiro certificado da cadeia é o do titular (o que casa com a chave). */
export function lerPkcs12(p12: Buffer, senha: string): CertificadoA1 {
  const pfx = forge.pkcs12.pkcs12FromAsn1(asn1.fromDer(p12.toString("binary")), senha);
  const keyBag = forge.pki.oids.pkcs8ShroudedKeyBag as string;
  const certBag = forge.pki.oids.certBag as string;
  const chave = pfx.getBags({ bagType: keyBag })[keyBag]?.[0]?.key as
    | forge.pki.rsa.PrivateKey
    | undefined;
  const certs = (pfx.getBags({ bagType: certBag })[certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  if (!chave || certs.length === 0) throw new Error("PKCS#12 sem chave ou sem certificado");
  const titular = certs.find((c) => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub.n.equals(chave.n);
  });
  if (!titular) throw new Error("Nenhum certificado casa com a chave");
  return { chave, cadeia: [titular, ...certs.filter((c) => c !== titular)] };
}

class SignerPades extends Signer {
  constructor(private readonly a1: CertificadoA1) {
    super();
  }

  async sign(conteudo: Buffer): Promise<Buffer> {
    const [titular] = this.a1.cadeia;
    if (!titular) throw new Error("Cadeia vazia");
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

export async function assinarPades(
  pdf: Buffer,
  a1: CertificadoA1,
  o: { nome: string; motivo: string; local: string; quando: Date },
): Promise<Buffer> {
  const comCampo = plainAddPlaceholder({
    pdfBuffer: pdf,
    name: o.nome,
    reason: o.motivo,
    location: o.local,
    contactInfo: "",
    signingTime: o.quando,
    signatureLength: TAMANHO_ASSINATURA,
    subFilter: SUBFILTER_PADES,
    appName: "Sistema PMOC",
  });
  return new SignPdf().sign(comCampo, new SignerPades(a1));
}
