import { sql } from "drizzle-orm";
import { systemContext } from "../../src/server/context";
import type { Database } from "../../src/server/db";

/**
 * Seed mínimo de desenvolvimento (05 §7.1; 06 LG-06): SÓ dados fictícios. Nunca dados reais.
 * Ids fixos para os testes de integração e de isolamento referenciarem.
 */
export const SEED = {
  admUserId: "00000000-0000-4000-8000-0000000000a1",
  technicianUserId: "00000000-0000-4000-8000-0000000000b1",
  clientAId: "00000000-0000-4000-8000-0000000000c1",
  clientBId: "00000000-0000-4000-8000-0000000000c2",
  clientAUserId: "00000000-0000-4000-8000-0000000000d1",
  clientBUserId: "00000000-0000-4000-8000-0000000000d2",
  siteAId: "00000000-0000-4000-8000-0000000000e1",
  siteBId: "00000000-0000-4000-8000-0000000000e2",
  contractAId: "00000000-0000-4000-8000-0000000000f1",
  contractBId: "00000000-0000-4000-8000-0000000000f2",
  pmocAId: "00000000-0000-4000-8000-000000000101",
  pmocBId: "00000000-0000-4000-8000-000000000102",
  visitAId: "00000000-0000-4000-8000-000000000111",
  visitBId: "00000000-0000-4000-8000-000000000112",
  fileAId: "00000000-0000-4000-8000-000000000121",
  fileBId: "00000000-0000-4000-8000-000000000122",
  logoFileId: "00000000-0000-4000-8000-000000000123",
  equipmentTypeId: "00000000-0000-4000-8000-000000000131",
  equipmentGroupId: "00000000-0000-4000-8000-000000000132",
  equipmentAId: "00000000-0000-4000-8000-000000000141",
  equipmentBId: "00000000-0000-4000-8000-000000000142",
} as const;

const SEED_REQUEST_ID = "00000000-0000-4000-8000-0000000005ee";

/** Idempotente: se o ADM do seed já existe, não faz nada. Devolve `true` se inseriu. */
export async function seedDevelopment(db: Database): Promise<boolean> {
  const ctx = systemContext(SEED_REQUEST_ID, "seed de desenvolvimento");
  const S = SEED;
  return db.withTransaction(ctx, async (tx) => {
    const exists = await tx.execute(sql`SELECT 1 FROM app_user WHERE id = ${S.admUserId}`);
    if (exists.length > 0) return false;

    // auth_user (AF-04) e app_user. Os usuários do seed não têm senha: o login entra na Etapa 2.
    const users = [
      [S.admUserId, "adm@exemplo.test", "Ana Administradora", "ADM", null],
      [S.technicianUserId, "tecnico@exemplo.test", "Tiago Técnico", "TECNICO", null],
      [S.clientAUserId, "cliente-a@exemplo.test", "Carla (Cliente A)", "CLIENTE", S.clientAId],
      [S.clientBUserId, "cliente-b@exemplo.test", "Caio (Cliente B)", "CLIENTE", S.clientBId],
    ] as const;
    // client precisa existir antes do app_user CLIENTE.
    const clients = [
      [S.clientAId, "Clínica Alfa Ltda", "11222333000181"],
      [S.clientBId, "Hospital Beta S.A.", "11444777000161"],
    ] as const;
    for (const [id, name, cnpj] of clients) {
      await tx.execute(sql`INSERT INTO client (id, legal_name, cnpj, address_street, address_number,
        address_city, address_state, address_zip)
        VALUES (${id}, ${name}, ${cnpj}, 'Rua Fictícia', '100', 'São Paulo', 'SP', '01001000')`);
    }
    for (const [id, email, name, role, clientId] of users) {
      await tx.execute(
        sql`INSERT INTO auth_user (id, name, email) VALUES (${`auth-${id}`}, ${name}, ${email})`,
      );
      await tx.execute(sql`INSERT INTO app_user (id, name, email, auth_user_id, role, client_id)
        VALUES (${id}, ${name}, ${email}, ${`auth-${id}`}, ${role}, ${clientId})`);
    }

    // Arquivos (metadados). Logo sem cliente; um arquivo por cliente.
    const files = [
      [S.logoFileId, "LOGO_EMPRESA", null, "logo"],
      [S.fileAId, "PMOC_PDF", S.clientAId, "a"],
      [S.fileBId, "PMOC_PDF", S.clientBId, "b"],
    ] as const;
    for (const [id, kind, clientId, key] of files) {
      await tx.execute(sql`INSERT INTO stored_file (id, kind, client_id, storage_key, mime_type, size_bytes, sha256)
        VALUES (${id}, ${kind}, ${clientId}, ${`seed/${key}`}, 'application/pdf', 1024, ${"0".repeat(64)})`);
    }

    await tx.execute(sql`INSERT INTO executor_company (legal_name, cnpj, phone, crea_registration, logo_file_id,
      address_street, address_number, address_neighborhood, address_city, address_state, address_zip)
      VALUES ('Climatização Exemplo Ltda', '11222333000181', '11999990000', 'CREA-SEED', ${S.logoFileId},
      'Av. Fictícia', '1', 'Centro', 'São Paulo', 'SP', '01001000')`);
    await tx.execute(sql`INSERT INTO technical_responsible (full_name, professional_title, registration_number,
      phone, email, address_street, address_number, address_neighborhood, address_city, address_state, address_zip)
      VALUES ('Rui Responsável', 'Engenheiro Responsável', 'REG-SEED', '11988880000', 'rt@exemplo.test',
      'Av. Fictícia', '2', 'Centro', 'São Paulo', 'SP', '01001000')`);

    const sites = [
      [S.siteAId, S.clientAId, "L001", "Unidade Alfa Centro"],
      [S.siteBId, S.clientBId, "L002", "Unidade Beta Norte"],
    ] as const;
    for (const [id, clientId, code, name] of sites) {
      await tx.execute(sql`INSERT INTO site (id, client_id, code, name, address_street, address_number,
        address_city, address_state, address_zip)
        VALUES (${id}, ${clientId}, ${code}, ${name}, 'Rua Local', '10', 'São Paulo', 'SP', '01001000')`);
    }

    const contracts = [
      [S.contractAId, S.siteAId],
      [S.contractBId, S.siteBId],
    ] as const;
    for (const [id, siteId] of contracts) {
      await tx.execute(sql`INSERT INTO contract (id, site_id, start_date, end_date, art_number, status)
        VALUES (${id}, ${siteId}, '2026-01-01', '2026-12-31', 'ART-SEED', 'VIGENTE')`);
    }
    await tx.execute(
      sql`INSERT INTO pmoc (id, contract_id) VALUES (${S.pmocAId}, ${S.contractAId})`,
    );
    await tx.execute(
      sql`INSERT INTO pmoc (id, contract_id) VALUES (${S.pmocBId}, ${S.contractBId})`,
    );

    // Biblioteca mínima: um tipo, um grupo e uma atividade (valores ilustrativos, sem fonte normativa).
    await tx.execute(
      sql`INSERT INTO equipment_type (id, name, acronym) VALUES (${S.equipmentTypeId}, 'Split', 'SPL')`,
    );
    await tx.execute(sql`INSERT INTO equipment_group (id, equipment_type_id, name)
      VALUES (${S.equipmentGroupId}, ${S.equipmentTypeId}, 'Hi-Wall')`);
    await tx.execute(sql`INSERT INTO activity_template (equipment_type_id, title, default_periodicity, nature, display_order)
      VALUES (${S.equipmentTypeId}, 'Verificar filtros (atividade fictícia)', 'MM', 'VERIFICACAO', 1)`);

    // Equipamentos: o sequencial da TAG vem do contador (03 §2.5).
    const equipments = [
      [S.equipmentAId, S.siteAId, "L001-SPL-001"],
      [S.equipmentBId, S.siteBId, "L002-SPL-001"],
    ] as const;
    for (const [id, siteId, tag] of equipments) {
      await tx.execute(sql`INSERT INTO equipment_tag_counter (site_id, equipment_type_id, last_sequence)
        VALUES (${siteId}, ${S.equipmentTypeId}, 1)`);
      await tx.execute(sql`INSERT INTO equipment (id, site_id, equipment_type_id, equipment_group_id,
        location_description, tag_sequence, tag)
        VALUES (${id}, ${siteId}, ${S.equipmentTypeId}, ${S.equipmentGroupId}, 'Sala de espera', 1, ${tag})`);
    }

    const visits = [
      [S.visitAId, S.pmocAId, S.siteAId, S.clientAId],
      [S.visitBId, S.pmocBId, S.siteBId, S.clientBId],
    ] as const;
    for (const [id, pmocId, siteId, clientId] of visits) {
      await tx.execute(sql`INSERT INTO visit (id, pmoc_id, site_id, client_id, reference_month_index,
        reference_month, origin)
        VALUES (${id}, ${pmocId}, ${siteId}, ${clientId}, 1, '2026-01-01', 'AUTOMATICA')`);
    }
    return true;
  });
}
