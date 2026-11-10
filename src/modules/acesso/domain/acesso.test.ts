import { describe, expect, it } from "vitest";
import { BLOQUEIO, bloqueadaAte, type TentativaLogin } from "./bloqueio";
import { validarSenha } from "./senha";
import { avaliarSessao, LIMITES_SESSAO, type SessaoAvaliada } from "./sessao";

const T0 = new Date("2026-11-10T12:00:00Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const h = (n: number) => min(n * 60);

const base = (o: Partial<SessaoAvaliada> = {}): SessaoAvaliada => ({
  perfil: "CLIENTE",
  situacao: "ATIVO",
  criadaEm: T0,
  ultimoUso: T0,
  segundoFatorAtivo: false,
  agora: min(1),
  ...o,
});

describe("avaliarSessao – SEG-10 (AF-08), RN-141, RN-194", () => {
  it("RN-141: INATIVO nunca passa, em qualquer perfil", () => {
    for (const perfil of ["ADM", "TECNICO", "CLIENTE"] as const) {
      expect(avaliarSessao(base({ perfil, situacao: "INATIVO", segundoFatorAtivo: true }))).toEqual(
        { ok: false, motivo: "INATIVO" },
      );
    }
  });

  it("SEG-10: web expira com 12 h sem uso", () => {
    expect(avaliarSessao(base({ ultimoUso: T0, agora: h(11.9) })).ok).toBe(true);
    expect(avaliarSessao(base({ ultimoUso: T0, agora: h(12) }))).toEqual({
      ok: false,
      motivo: "SEM_USO",
    });
  });

  it("SEG-10: web tem limite absoluto de 7 dias, mesmo com uso contínuo", () => {
    const agora = h(7 * 24);
    expect(avaliarSessao(base({ ultimoUso: min(7 * 24 * 60 - 1), agora }))).toEqual({
      ok: false,
      motivo: "LIMITE_ABSOLUTO",
    });
  });

  it("SEG-10: TECNICO (PWA) não tem o limite web; vale a renovação de 30 dias da biblioteca", () => {
    const s = base({ perfil: "TECNICO", ultimoUso: T0, agora: h(20 * 24) });
    expect(avaliarSessao(s)).toEqual({ ok: true, somenteConfigurarSegundoFator: false });
    expect(LIMITES_SESSAO.renovavelMs).toBe(30 * 24 * 3600 * 1000);
  });

  it("RN-194: ADM sem segundo fator só acessa a tela de configurá-lo; com ele, acesso normal", () => {
    expect(avaliarSessao(base({ perfil: "ADM" }))).toEqual({
      ok: true,
      somenteConfigurarSegundoFator: true,
    });
    expect(avaliarSessao(base({ perfil: "ADM", segundoFatorAtivo: true }))).toEqual({
      ok: true,
      somenteConfigurarSegundoFator: false,
    });
  });

  it("RN-194: TECNICO e CLIENTE não têm segundo fator no MVP", () => {
    expect(avaliarSessao(base({ perfil: "TECNICO" }))).toMatchObject({
      somenteConfigurarSegundoFator: false,
    });
  });
});

describe("validarSenha – SEG-01, SEG-02, RN-180", () => {
  const email = "carla.souza@cliente.test";
  it("mínimo 8 e máximo 128 caracteres", () => {
    expect(validarSenha("1234567", email)).toBe("CURTA");
    expect(validarSenha("12345678", email)).toBeNull();
    expect(validarSenha("a".repeat(129), email)).toBe("LONGA");
  });
  it("sem exigência de maiúscula, número ou símbolo (frase-senha)", () => {
    expect(validarSenha("cavalo bateria grampo", email)).toBeNull();
  });
  it("recusa senha óbvia: e-mail, parte local do e-mail, nome do sistema", () => {
    expect(validarSenha(email, email)).toBe("OBVIA");
    expect(validarSenha("Carla.Souza2026", email)).toBe("OBVIA");
    expect(validarSenha("minhasenhapmoc", email)).toBe("OBVIA");
  });
});

describe("bloqueadaAte – SEG-07 (DFT-20)", () => {
  const falha = (m: number): TentativaLogin => ({ tipo: "LOGIN_FALHA", em: min(m) });
  const ok = (m: number): TentativaLogin => ({ tipo: "LOGIN_OK", em: min(m) });

  it("4 falhas não bloqueiam; a 5ª seguida bloqueia por 15 min", () => {
    expect(bloqueadaAte([1, 2, 3, 4].map(falha), min(5))).toBeNull();
    expect(bloqueadaAte([1, 2, 3, 4, 5].map(falha), min(6))).toEqual(min(5 + 15));
    expect(bloqueadaAte([1, 2, 3, 4, 5].map(falha), min(20))).toBeNull();
  });

  it("login certo zera a contagem", () => {
    expect(
      bloqueadaAte([falha(1), falha(2), falha(3), falha(4), ok(5), falha(6)], min(7)),
    ).toBeNull();
  });

  it("depois do bloqueio, a contagem recomeça do zero", () => {
    const seq = [1, 2, 3, 4, 5, 21].map(falha);
    expect(bloqueadaAte(seq, min(22))).toBeNull();
  });

  it("tentativas durante o bloqueio não estendem nem recontam", () => {
    const seq = [...[1, 2, 3, 4, 5].map(falha), falha(10), falha(11)];
    expect(bloqueadaAte(seq, min(12))).toEqual(min(5 + BLOQUEIO.duracaoMs / 60_000));
  });
});
