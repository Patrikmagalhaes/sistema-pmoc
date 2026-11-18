/**
 * Spike S-02 (docs/05 §10.4): o código da assinatura PAdES foi promovido para
 * `src/server/pdf/assinar.ts` (Etapa 4). Este arquivo só reexporta, para o spike e o passo manual do
 * ITI (`assinar.ts`) conferirem o código de produção.
 */
export {
  assinarPades,
  type CertificadoA1,
  lerCertificadoA1 as lerPkcs12,
  OID,
  SUBFILTER_PADES,
  TAMANHO_ASSINATURA,
} from "../../../src/server/pdf/assinar";
