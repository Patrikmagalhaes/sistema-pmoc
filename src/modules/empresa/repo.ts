import "server-only";
import { type SQL, sql } from "drizzle-orm";
import type { Endereco } from "@/lib/endereco";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `empresa` que fala com o banco. Sempre dentro de `withTransaction`. */

// ---- endereço (bloco [E]) -----------------------------------------------------------------------

const colunasEndereco = sql.raw(`address_street AS logradouro, address_number AS numero,
  address_without_number AS "semNumero", address_complement AS complemento,
  address_neighborhood AS bairro, address_city AS cidade, address_state AS uf, address_zip AS cep`);

const separarEndereco = <T extends Endereco>(
  l: T,
): Omit<T, keyof Endereco> & { endereco: Endereco } => {
  const { logradouro, numero, semNumero, complemento, bairro, cidade, uf, cep, ...resto } = l;
  return {
    ...resto,
    endereco: { logradouro, numero, semNumero, complemento, bairro, cidade, uf, cep },
  };
};

const setEndereco = (e: Endereco): SQL => sql`address_street = ${e.logradouro},
  address_number = ${e.numero}, address_without_number = ${e.semNumero},
  address_complement = ${e.complemento}, address_neighborhood = ${e.bairro},
  address_city = ${e.cidade}, address_state = ${e.uf}, address_zip = ${e.cep}`;

const valoresEndereco = (e: Endereco): SQL => sql`${e.logradouro}, ${e.numero}, ${e.semNumero},
  ${e.complemento}, ${e.bairro}, ${e.cidade}, ${e.uf}, ${e.cep}`;

const insertEndereco = sql.raw(`address_street, address_number, address_without_number,
  address_complement, address_neighborhood, address_city, address_state, address_zip`);

// ---- empresa executora (registro único, RF-04.1) ------------------------------------------------

export interface DadosEmpresa {
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  crea: string;
  endereco: Endereco;
}

export interface Empresa extends DadosEmpresa {
  id: string;
  rowVersion: number;
  logoId: string;
}

export async function buscarEmpresa(tx: Tx): Promise<Empresa | null> {
  const r =
    await tx.execute(sql`SELECT id, row_version AS "rowVersion", legal_name AS "razaoSocial",
      cnpj, phone AS telefone, crea_registration AS crea, logo_file_id AS "logoId", ${colunasEndereco}
    FROM executor_company WHERE singleton`);
  const e = r[0] as (Omit<Empresa, "endereco"> & Endereco) | undefined;
  return e ? separarEndereco(e) : null;
}

/** O `UNIQUE (singleton)` segura uma segunda linha criada em paralelo (CA-04.1). */
export async function inserirEmpresa(tx: Tx, d: DadosEmpresa, logoId: string): Promise<void> {
  await tx.execute(sql`INSERT INTO executor_company (legal_name, cnpj, phone, crea_registration,
      logo_file_id, ${insertEndereco})
    VALUES (${d.razaoSocial}, ${d.cnpj}, ${d.telefone}, ${d.crea}, ${logoId}, ${valoresEndereco(d.endereco)})`);
}

/** `logoId` `null` mantém o logo atual. */
export async function atualizarEmpresa(
  tx: Tx,
  d: DadosEmpresa,
  logoId: string | null,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE executor_company SET legal_name = ${d.razaoSocial},
      cnpj = ${d.cnpj}, phone = ${d.telefone}, crea_registration = ${d.crea},
      ${logoId ? sql`logo_file_id = ${logoId},` : sql``} ${setEndereco(d.endereco)}
    WHERE singleton AND row_version = ${rowVersion} RETURNING id`);
  return r.length === 1;
}

// ---- responsável técnico (registro único, DEC-14) -----------------------------------------------

export interface DadosRt {
  nome: string;
  titulo: string;
  registro: string;
  telefone: string;
  email: string;
  endereco: Endereco;
}

export interface Rt extends DadosRt {
  id: string;
  rowVersion: number;
}

export async function buscarRt(tx: Tx): Promise<Rt | null> {
  const r = await tx.execute(sql`SELECT id, row_version AS "rowVersion", full_name AS nome,
      professional_title AS titulo, registration_number AS registro, phone AS telefone,
      email::text AS email, ${colunasEndereco}
    FROM technical_responsible WHERE singleton`);
  const e = r[0] as (Omit<Rt, "endereco"> & Endereco) | undefined;
  return e ? separarEndereco(e) : null;
}

export async function inserirRt(tx: Tx, d: DadosRt): Promise<void> {
  await tx.execute(sql`INSERT INTO technical_responsible (full_name, professional_title,
      registration_number, phone, email, ${insertEndereco})
    VALUES (${d.nome}, ${d.titulo}, ${d.registro}, ${d.telefone}, ${d.email}, ${valoresEndereco(d.endereco)})`);
}

export async function atualizarRt(tx: Tx, d: DadosRt, rowVersion: number): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE technical_responsible SET full_name = ${d.nome},
      professional_title = ${d.titulo}, registration_number = ${d.registro}, phone = ${d.telefone},
      email = ${d.email}, ${setEndereco(d.endereco)}
    WHERE singleton AND row_version = ${rowVersion} RETURNING id`);
  return r.length === 1;
}

// ---- certificado do RT (DM-11) ------------------------------------------------------------------

/** Só os dados de exibição: o arquivo e a senha cifrados nunca saem do banco por aqui (RN-121). */
export interface Certificado {
  id: string;
  titular: string;
  serie: string;
  emissor: string | null;
  validoDe: Date;
  validoAte: Date;
  atual: boolean;
  enviadoEm: Date;
  enviadoPor: string | null;
}

const data = (v: string | Date) => new Date(v);

/** TL-103: o atual primeiro, depois o histórico do mais novo ao mais antigo (vivos, EL-5). */
export async function listarCertificados(tx: Tx): Promise<Certificado[]> {
  const r = await tx.execute(sql`SELECT c.id, c.holder_name AS titular, c.serial_number AS serie,
      c.issuer_name AS emissor, c.valid_from AS "validoDe", c.valid_until AS "validoAte",
      c.is_current AS atual, c.created_at AS "enviadoEm", u.name AS "enviadoPor"
    FROM rt_certificate c LEFT JOIN app_user u ON u.id = c.created_by_user_id
    WHERE c.deleted_at IS NULL
    ORDER BY c.is_current DESC, c.created_at DESC, c.id`);
  return (r as unknown as Certificado[]).map((c) => ({
    ...c,
    validoDe: data(c.validoDe),
    validoAte: data(c.validoAte),
    enviadoEm: data(c.enviadoEm),
  }));
}

export interface NovoCertificado {
  rtId: string;
  pkcs12: Buffer;
  senha: Buffer;
  chaveRef: string;
  titular: string;
  serie: string;
  emissor: string | null;
  validoDe: Date;
  validoAte: Date;
  usuarioId: string | null;
}

/** FL-02 passo 5: o anterior deixa de ser o atual e o novo entra como atual, na mesma transação. */
export async function substituirCertificadoAtual(tx: Tx, c: NovoCertificado): Promise<string> {
  await tx.execute(sql`UPDATE rt_certificate SET is_current = false
    WHERE is_current AND deleted_at IS NULL`);
  const r = await tx.execute(sql`INSERT INTO rt_certificate (technical_responsible_id,
      certificate_type, encrypted_pkcs12, encrypted_password, encryption_key_ref, holder_name,
      serial_number, issuer_name, valid_from, valid_until, is_current, created_by_user_id)
    VALUES (${c.rtId}, 'A1', ${c.pkcs12}, ${c.senha}, ${c.chaveRef}, ${c.titular}, ${c.serie},
      ${c.emissor}, ${c.validoDe.toISOString()}, ${c.validoAte.toISOString()}, true, ${c.usuarioId})
    RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** E-02.7: já houve emissão de PMOC (o aviso fixo aparece na TL-102). */
export async function houveEmissao(tx: Tx): Promise<boolean> {
  const r = await tx.execute(sql`SELECT EXISTS (SELECT 1 FROM pmoc
    WHERE first_issued_at IS NOT NULL) AS sim`);
  return Boolean((r[0] as { sim: boolean } | undefined)?.sim);
}
