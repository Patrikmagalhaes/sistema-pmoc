import "server-only";
import { type SQL, sql } from "drizzle-orm";
import type { Endereco } from "@/lib/endereco";
import type { Tx } from "@/server/db";

/** MOD-03: único arquivo do módulo `clientes` que fala com o banco. Sempre dentro de `withTransaction`. */

export interface ClienteResumo {
  id: string;
  razaoSocial: string;
}

/** Clientes vivos (EL-5), por razão social. A RLS restringe o CLIENTE ao próprio (05 §4.2). */
export async function listarResumo(tx: Tx): Promise<ClienteResumo[]> {
  const r = await tx.execute(sql`SELECT id, legal_name AS "razaoSocial" FROM client
    WHERE deleted_at IS NULL ORDER BY legal_name, id`);
  return r as unknown as ClienteResumo[];
}

// ---- endereço (bloco [E]) -----------------------------------------------------------------------

const colunasEndereco = (t: string) =>
  sql.raw(`${t}.address_street AS logradouro, ${t}.address_number AS numero,
  ${t}.address_without_number AS "semNumero", ${t}.address_complement AS complemento,
  ${t}.address_neighborhood AS bairro, ${t}.address_city AS cidade, ${t}.address_state AS uf,
  ${t}.address_zip AS cep`);

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

// ---- cliente ------------------------------------------------------------------------------------

export interface LinhaCliente {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  cidade: string;
  uf: string;
  locais: number;
}

/** Escapa `\`, `%` e `_` para o `ILIKE` (busca literal, "contém"). */
const like = (v: string) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** TL-108: busca por razão social, nome fantasia ou CNPJ (cru), paginada no servidor (UL-01). */
export async function listarClientes(
  tx: Tx,
  f: { busca: string | null; cnpjBusca: string | null; pagina: number; porPagina: number },
): Promise<{ linhas: LinhaCliente[]; total: number }> {
  const conds = [sql`c.deleted_at IS NULL`];
  if (f.busca) {
    const porCnpj = f.cnpjBusca ? sql` OR c.cnpj LIKE ${like(f.cnpjBusca)}` : sql``;
    conds.push(
      sql`(c.legal_name ILIKE ${like(f.busca)} OR c.trade_name ILIKE ${like(f.busca)}${porCnpj})`,
    );
  }
  const where = sql.join(conds, sql` AND `);
  const total = (
    (await tx.execute(sql`SELECT count(*)::int AS n FROM client c WHERE ${where}`))[0] as {
      n: number;
    }
  ).n;
  const r = await tx.execute(sql`SELECT c.id, c.legal_name AS "razaoSocial",
      c.trade_name AS "nomeFantasia", c.cnpj, c.address_city AS cidade, c.address_state AS uf,
      (SELECT count(*)::int FROM site s WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS locais
    FROM client c WHERE ${where}
    ORDER BY lower(c.legal_name), c.id
    LIMIT ${f.porPagina} OFFSET ${(f.pagina - 1) * f.porPagina}`);
  return { linhas: r as unknown as LinhaCliente[], total };
}

export interface Cliente {
  id: string;
  rowVersion: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  telefone1: string | null;
  telefone2: string | null;
  endereco: Endereco;
  /** E-04.7: local vivo bloqueia a exclusão. */
  temLocalVivo: boolean;
}

export async function buscarCliente(tx: Tx, id: string): Promise<Cliente | null> {
  const r = await tx.execute(sql`SELECT c.id, c.row_version AS "rowVersion",
      c.legal_name AS "razaoSocial", c.trade_name AS "nomeFantasia", c.cnpj,
      c.phone_1 AS telefone1, c.phone_2 AS telefone2, ${colunasEndereco("c")},
      EXISTS (SELECT 1 FROM site s WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS "temLocalVivo"
    FROM client c WHERE c.id = ${id} AND c.deleted_at IS NULL`);
  const l = r[0] as (Omit<Cliente, "endereco"> & Endereco) | undefined;
  return l ? separarEndereco(l) : null;
}

/** E-04.2: cliente vivo com o CNPJ. */
export async function buscarPorCnpj(
  tx: Tx,
  cnpj: string,
): Promise<{ id: string; razaoSocial: string } | null> {
  const r = await tx.execute(sql`SELECT id, legal_name AS "razaoSocial" FROM client
    WHERE cnpj = ${cnpj} AND deleted_at IS NULL`);
  return (r[0] as { id: string; razaoSocial: string } | undefined) ?? null;
}

export interface DadosCliente {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  telefone1: string | null;
  telefone2: string | null;
  endereco: Endereco;
}

export async function inserirCliente(tx: Tx, c: DadosCliente): Promise<string> {
  const e = c.endereco;
  const r = await tx.execute(sql`INSERT INTO client (legal_name, trade_name, cnpj, phone_1, phone_2,
      address_street, address_number, address_without_number, address_complement,
      address_neighborhood, address_city, address_state, address_zip)
    VALUES (${c.razaoSocial}, ${c.nomeFantasia}, ${c.cnpj}, ${c.telefone1}, ${c.telefone2},
      ${e.logradouro}, ${e.numero}, ${e.semNumero}, ${e.complemento}, ${e.bairro}, ${e.cidade},
      ${e.uf}, ${e.cep})
    RETURNING id`);
  return (r[0] as { id: string }).id;
}

/** `UPDATE` com `row_version` esperado. Devolve `false` se outra pessoa alterou antes (UF-07). */
export async function atualizarCliente(
  tx: Tx,
  id: string,
  c: DadosCliente,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE client SET legal_name = ${c.razaoSocial},
      trade_name = ${c.nomeFantasia}, cnpj = ${c.cnpj}, phone_1 = ${c.telefone1},
      phone_2 = ${c.telefone2}, ${setEndereco(c.endereco)}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

type Tabela = "client" | "site";

/** Exclusão lógica (EL-2), com motivo opcional (UF-10). */
export async function excluirLogico(
  tx: Tx,
  tabela: Tabela,
  id: string,
  usuarioId: string | null,
  motivo: string | null,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE ${sql.identifier(tabela)}
    SET deleted_at = now(), deleted_by_user_id = ${usuarioId}, deletion_reason = ${motivo}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}

/** Trava a linha do cliente: incluir local e excluir o cliente não correm juntos (EL-7). */
export async function travarCliente(tx: Tx, id: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM client WHERE id = ${id} FOR UPDATE`);
}

// ---- local --------------------------------------------------------------------------------------

export interface LinhaLocal {
  id: string;
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  /** TL-109: fim do contrato `VIGENTE` do local, se houver. */
  vigenteAte: string | null;
  /** TL-109: estado do PMOC do contrato mais recente (texto do enum). */
  estadoPmoc: string | null;
}

/** TL-109 aba Locais. */
export async function listarLocais(tx: Tx, clienteId: string): Promise<LinhaLocal[]> {
  const r = await tx.execute(sql`SELECT s.id, s.code AS codigo, s.name AS nome,
      s.address_city AS cidade, s.address_state AS uf,
      (SELECT to_char(c.end_date, 'YYYY-MM-DD') FROM contract c
        WHERE c.site_id = s.id AND c.deleted_at IS NULL AND c.status = 'VIGENTE'
        ORDER BY c.start_date DESC LIMIT 1) AS "vigenteAte",
      (SELECT p.status FROM contract c JOIN pmoc p ON p.contract_id = c.id
        WHERE c.site_id = s.id AND c.deleted_at IS NULL
        ORDER BY c.start_date DESC LIMIT 1) AS "estadoPmoc"
    FROM site s WHERE s.client_id = ${clienteId} AND s.deleted_at IS NULL
    ORDER BY s.code`);
  return r as unknown as LinhaLocal[];
}

export interface Local {
  id: string;
  rowVersion: number;
  clienteId: string;
  clienteRazaoSocial: string;
  codigo: string;
  nome: string;
  telefone: string | null;
  endereco: Endereco;
  /** E-04.7: contrato ou equipamento vivo bloqueia a exclusão. */
  temContratoVivo: boolean;
  temEquipamentoVivo: boolean;
}

export async function buscarLocal(tx: Tx, id: string): Promise<Local | null> {
  const r =
    await tx.execute(sql`SELECT s.id, s.row_version AS "rowVersion", s.client_id AS "clienteId",
      c.legal_name AS "clienteRazaoSocial", s.code AS codigo, s.name AS nome, s.phone AS telefone,
      ${colunasEndereco("s")},
      EXISTS (SELECT 1 FROM contract k WHERE k.site_id = s.id AND k.deleted_at IS NULL) AS "temContratoVivo",
      EXISTS (SELECT 1 FROM equipment e WHERE e.site_id = s.id AND e.deleted_at IS NULL) AS "temEquipamentoVivo"
    FROM site s JOIN client c ON c.id = s.client_id
    WHERE s.id = ${id} AND s.deleted_at IS NULL AND c.deleted_at IS NULL`);
  const l = r[0] as (Omit<Local, "endereco"> & Endereco) | undefined;
  return l ? separarEndereco(l) : null;
}

export interface DadosLocal {
  nome: string;
  telefone: string | null;
  endereco: Endereco;
}

/** O código vem do trigger `site_code` (DM-19), nunca do navegador. */
export async function inserirLocal(
  tx: Tx,
  clienteId: string,
  l: DadosLocal,
): Promise<{ id: string; codigo: string }> {
  const e = l.endereco;
  const r = await tx.execute(sql`INSERT INTO site (client_id, name, phone, address_street,
      address_number, address_without_number, address_complement, address_neighborhood,
      address_city, address_state, address_zip)
    VALUES (${clienteId}, ${l.nome}, ${l.telefone}, ${e.logradouro}, ${e.numero}, ${e.semNumero},
      ${e.complemento}, ${e.bairro}, ${e.cidade}, ${e.uf}, ${e.cep})
    RETURNING id, code AS codigo`);
  return r[0] as { id: string; codigo: string };
}

export async function atualizarLocal(
  tx: Tx,
  id: string,
  l: DadosLocal,
  rowVersion: number,
): Promise<boolean> {
  const r = await tx.execute(sql`UPDATE site SET name = ${l.nome}, phone = ${l.telefone},
      ${setEndereco(l.endereco)}
    WHERE id = ${id} AND row_version = ${rowVersion} AND deleted_at IS NULL RETURNING id`);
  return r.length === 1;
}
