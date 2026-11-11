/** Módulo `empresa` (RF-04): empresa executora, RT e certificado e-CPF A1 (FL-02; TL-102, TL-103). */
export {
  CERTIFICADO_MAX,
  DIAS_A_VENCER,
  type EstadoCertificado,
  EXTENSOES_CERTIFICADO,
} from "./domain/certificado";
export type { Certificado, Empresa, Rt } from "./repo";
export type { EnviarCertificadoInput, SalvarEmpresaInput, SalvarRtInput } from "./schemas";
export {
  type CertificadoExibido,
  type Configuracao,
  type EmpresaDeps,
  ErroEmpresa,
  enviarCertificado,
  obterConfiguracao,
  salvarEmpresa,
  salvarRt,
} from "./service";
