import { describe, expect, it } from "vitest";
import { buildContext, systemContext } from "@/server/context";
import { ACTIONS, type Action, can } from "./index";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REQ = "99999999-9999-4999-8999-999999999999";

const adm = buildContext({ userId: U1, role: "ADM", requestId: REQ, source: "WEB_ADM" });
const tec = buildContext({ userId: U1, role: "TECNICO", requestId: REQ, source: "PWA_TECNICO" });
const cli = buildContext({
  userId: U2,
  role: "CLIENTE",
  clientId: C1,
  requestId: REQ,
  source: "PORTAL_CLIENTE",
});

describe("can – matriz de permissões (PRD §3.2, RN-160 a RN-168)", () => {
  it("nega por padrão: ação desconhecida (SEG-20)", () => {
    expect(can(adm, "acao.inventada" as Action)).toBe(false);
  });

  it("SISTEMA não tem permissões na Etapa 1", () => {
    const sys = systemContext(REQ);
    for (const a of ACTIONS) expect(can(sys, a)).toBe(false);
  });

  it("ADM pode o que a matriz marca, mas nunca assina (RN-133, RN-160)", () => {
    expect(can(adm, "pmoc.emitir")).toBe(true);
    expect(can(adm, "auditoria.ler")).toBe(true);
    expect(can(adm, "pmoc.assinar", { clientId: C1 })).toBe(false);
    expect(can(adm, "relatorio.assinar", { clientId: C1 })).toBe(false);
  });

  it("CLIENTE só lê e assina o que é do seu cliente (RN-161, RN-162)", () => {
    expect(can(cli, "pmoc.ler", { clientId: C1 })).toBe(true);
    expect(can(cli, "pmoc.ler", { clientId: C2 })).toBe(false);
    expect(can(cli, "pmoc.ler")).toBe(false); // recurso sem dono = negado
    expect(can(cli, "pmoc.assinar", { clientId: C1 })).toBe(true);
    expect(can(cli, "pmoc.assinar", { clientId: C2 })).toBe(false);
    expect(can(cli, "cadastro.escrever", { clientId: C1 })).toBe(false);
    expect(can(cli, "visita.gerenciar", { clientId: C1 })).toBe(false);
    expect(can(cli, "notificacao.receber")).toBe(true);
  });

  it("TECNICO não vê PMOC, contrato nem auditoria (RN-166, decisão B1)", () => {
    expect(can(tec, "pmoc.ler", { assignedTechnicianUserId: U1 })).toBe(false);
    expect(can(tec, "cadastro.ler")).toBe(false);
    expect(can(tec, "auditoria.ler")).toBe(false);
    expect(can(tec, "pendencia.resolver")).toBe(false);
  });

  it("TECNICO lê visita atribuída a ele ou finalizada por ele (RN-165)", () => {
    expect(can(tec, "visita.ler", { assignedTechnicianUserId: U1 })).toBe(true);
    expect(can(tec, "visita.ler", { finalizedByUserId: U1 })).toBe(true);
    expect(can(tec, "visita.ler", { assignedTechnicianUserId: U2 })).toBe(false);
  });

  it("TECNICO só grava em visita sua EM_ANDAMENTO (RN-164, decisão B11)", () => {
    const own = { assignedTechnicianUserId: U1 };
    expect(can(tec, "execucao.registrar", { ...own, visitStatus: "EM_ANDAMENTO" })).toBe(true);
    expect(can(tec, "execucao.registrar", { ...own, visitStatus: "AGENDADA" })).toBe(false);
    expect(
      can(tec, "execucao.registrar", { assignedTechnicianUserId: U2, visitStatus: "EM_ANDAMENTO" }),
    ).toBe(false);
  });

  it("TECNICO escreve relatório só das visitas que finalizou (RN-167)", () => {
    expect(can(tec, "relatorio.escrever", { finalizedByUserId: U1 })).toBe(true);
    expect(can(tec, "relatorio.escrever", { finalizedByUserId: U2 })).toBe(false);
    expect(can(tec, "relatorio.escrever", { assignedTechnicianUserId: U1 })).toBe(false);
  });
});

describe("buildContext", () => {
  it("exige clientId só para CLIENTE (RN-169)", () => {
    expect(() =>
      buildContext({ userId: U2, role: "CLIENTE", requestId: REQ, source: "PORTAL_CLIENTE" }),
    ).toThrow();
    expect(() =>
      buildContext({ userId: U1, role: "ADM", clientId: C1, requestId: REQ, source: "WEB_ADM" }),
    ).toThrow();
  });

  it("recusa canal incompatível com o perfil", () => {
    expect(() =>
      buildContext({ userId: U1, role: "ADM", requestId: REQ, source: "PORTAL_CLIENTE" }),
    ).toThrow();
  });
});
