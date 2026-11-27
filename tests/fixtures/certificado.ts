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
  /** A chave privada é de outro par, que não o do certificado (E-02.4). */
  chaveDeOutroPar?: boolean;
  /** CN gravado como está, sem o ":CPF" e sem codificar em UTF-8 (casos de borda). */
  cnBruto?: string;
  /** Emissor sem CN. */
  semEmissor?: boolean;
}): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "0a1b2c3d";
  cert.validity.notBefore = o.validoDe;
  cert.validity.notAfter = o.validoAte;
  const cn = o.cnBruto ?? forge.util.encodeUtf8(`${o.nome}:00000000000`);
  cert.setSubject([{ name: "commonName", value: cn }]);
  cert.setIssuer(
    o.semEmissor
      ? [{ name: "organizationName", value: "AC Teste PMOC" }]
      : [{ name: "commonName", value: "AC Teste PMOC" }],
  );
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const chave = o.semChave
    ? null
    : o.chaveDeOutroPar
      ? forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 }).privateKey
      : chaves.privateKey;
  const p12 = forge.pkcs12.toPkcs12Asn1(chave, [cert], o.senha, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

/** DER válido que não é PKCS#12 (um certificado X.509 solto): E-02.4, não E-02.3. */
export function gerarCertificadoSolto(): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "01";
  cert.setSubject([{ name: "commonName", value: "Solto" }]);
  cert.setIssuer([{ name: "commonName", value: "Solto" }]);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
}
