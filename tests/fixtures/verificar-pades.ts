/**
 * Verificação local do S-02, independente do signer: lê o ByteRange e o /Contents do PDF assinado e
 * confere o CMS com `node:crypto`. Não substitui o validador oficial do ITI (CA-13.1), que também checa
 * a cadeia ICP-Brasil e a política de assinatura.
 */
import { createHash, verify, X509Certificate } from "node:crypto";
import forge from "node-forge";
import { OID } from "../../src/server/pdf/assinar";

const { asn1 } = forge;

export type ResultadoVerificacao = {
  subFilter: string | undefined;
  temM: boolean;
  byteRangeCobreTudo: boolean;
  digestConfere: boolean;
  assinaturaConfere: boolean;
  certHashConfere: boolean;
  temSigningTime: boolean;
  titular: string;
  certificadosNaCadeia: number;
};

const oidDe = (a: forge.asn1.Asn1) => asn1.derToOid(a.value as string);
const filhos = (a: forge.asn1.Asn1 | undefined) => (a?.value ?? []) as forge.asn1.Asn1[];

/** O /Contents vem completado com zeros; corta no tamanho declarado no cabeçalho DER do CMS. */
function semPreenchimento(bin: string): string {
  const primeiro = bin.charCodeAt(1);
  if (primeiro < 0x80) return bin.slice(0, 2 + primeiro);
  const n = primeiro & 0x7f;
  let tam = 0;
  for (let i = 0; i < n; i++) tam = tam * 256 + bin.charCodeAt(2 + i);
  return bin.slice(0, 2 + n + tam);
}

export function verificarPades(pdf: Buffer): ResultadoVerificacao {
  const latin = pdf.toString("latin1");
  const br = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(latin);
  if (!br) throw new Error("PDF sem /ByteRange");
  const [a, b, c, d] = br.slice(1).map(Number) as [number, number, number, number];
  const assinado = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)]);
  const hex = latin.slice(a + b + 1, c - 1);
  const cms = asn1.fromDer(semPreenchimento(forge.util.hexToBytes(hex)));

  const signedData = filhos(filhos(filhos(cms)[1])[0]);
  const certs = filhos(signedData[3]).map(
    (x) => new X509Certificate(Buffer.from(asn1.toDer(x).getBytes(), "binary")),
  );
  const signerInfo = filhos(filhos(signedData.at(-1))[0]);
  const attrsTag = signerInfo[3];
  if (!attrsTag) throw new Error("SignerInfo sem atributos assinados");
  const attrs = filhos(attrsTag);
  const valor = (o: string) =>
    filhos(filhos(attrs.find((x) => oidDe(filhos(x)[0] as forge.asn1.Asn1) === o))[1])[0];

  const titular = certs[0];
  if (!titular) throw new Error("CMS sem certificado");
  const digest = valor(OID.messageDigest)?.value as string | undefined;
  const sigCertV2 = valor(OID.signingCertificateV2);
  const certHash = filhos(filhos(filhos(sigCertV2)[0])[0])[0]?.value as string | undefined;

  // A assinatura cobre os atributos codificados como SET (tag 0x31), não como [0] IMPLICIT (0xA0).
  const attrsDer = Buffer.from(asn1.toDer(attrsTag).getBytes(), "binary");
  attrsDer[0] = 0x31;
  const assinatura = Buffer.from(signerInfo[5]?.value as string, "binary");

  return {
    subFilter: /\/SubFilter\s*\/([\w.]+)/.exec(latin)?.[1],
    temM: /\/M\s*\(D:\d{14}/.test(latin),
    byteRangeCobreTudo: a === 0 && c + d === pdf.length && hex.length === c - b - 2 - a,
    digestConfere: digest === createHash("sha256").update(assinado).digest("binary"),
    assinaturaConfere: verify("sha256", attrsDer, titular.publicKey, assinatura),
    certHashConfere: certHash === createHash("sha256").update(titular.raw).digest("binary"),
    temSigningTime: attrs.some((x) => oidDe(filhos(x)[0] as forge.asn1.Asn1) === OID.signingTime),
    titular: titular.subject,
    certificadosNaCadeia: certs.length,
  };
}
