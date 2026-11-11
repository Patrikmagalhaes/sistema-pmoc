import forge from "node-forge";

/**
 * Certificado A1 fictício para testes (autoassinado, sem cadeia ICP-Brasil): PKCS#12 com chave RSA e
 * CN no formato do e-CPF ("NOME:CPF"). Nunca use dados reais aqui.
 */
export function gerarPkcs12(o: {
  nome: string;
  senha: string;
  validoDe: Date;
  validoAte: Date;
  /** Sem a chave privada (E-02.4). */
  semChave?: boolean;
}): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "0a1b2c3d";
  cert.validity.notBefore = o.validoDe;
  cert.validity.notAfter = o.validoAte;
  const sujeito = [{ name: "commonName", value: forge.util.encodeUtf8(`${o.nome}:00000000000`) }];
  cert.setSubject(sujeito);
  cert.setIssuer([{ name: "commonName", value: "AC Teste PMOC" }]);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(o.semChave ? null : chaves.privateKey, [cert], o.senha, {
    algorithm: "3des",
  });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}
