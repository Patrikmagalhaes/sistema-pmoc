/** RN-142 (estado pelas datas) e RN-144 (`CANCELADO` prevalece). */
import { describe, expect, it } from "vitest";
import { estadoDoContrato, estadoPorDatas } from "./estado-contrato";

describe("RN-142: estado derivado das datas", () => {
  it.each([
    ["2026-10-31", "A_INICIAR"],
    ["2026-11-01", "VIGENTE"],
    ["2027-10-31", "VIGENTE"],
    ["2027-11-01", "ENCERRADO"],
  ])("hoje %s → %s", (hoje, estado) => {
    expect(estadoPorDatas("2026-11-01", "2027-10-31", hoje)).toBe(estado);
  });
});

describe("estado do contrato na hora de decidir (RN-017)", () => {
  it("o gravado pode estar desatualizado (o J-02 ainda não rodou): valem as datas", () => {
    expect(estadoDoContrato("VIGENTE", "2026-01-01", "2026-10-31", "2026-11-27")).toBe("ENCERRADO");
    expect(estadoDoContrato("A_INICIAR", "2026-11-01", "2027-10-31", "2026-11-27")).toBe("VIGENTE");
  });

  it("RN-144: CANCELADO prevalece sobre as datas", () => {
    expect(estadoDoContrato("CANCELADO", "2026-11-01", "2027-10-31", "2026-11-27")).toBe(
      "CANCELADO",
    );
  });
});
