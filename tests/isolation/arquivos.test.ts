/**
 * Isolamento do download `/api/arquivos/:id` (decisão B13; 06 SEG-25; RN-162, RN-163, RN-166, RN-171).
 * Usa os arquivos do seed (`PMOC_PDF` do cliente A e do B, e o logo sem cliente) com um armazenamento em
 * memória: o que se testa é a permissão e a RLS, não o armazenamento.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ArquivosDeps, lerArquivo } from "../../src/modules/arquivos";
import type { Armazenamento } from "../../src/server/storage";
import {
  admCtx,
  appDatabase,
  clientCtx,
  ensureSeed,
  SEED,
  technicianCtx,
} from "../integration/helpers";

const db = appDatabase();
const emMemoria: Armazenamento = {
  urlDeEnvio: async () => {
    throw new Error("não usado");
  },
  ler: async (chave) => Buffer.from(chave),
  gravar: async () => {
    throw new Error("não usado");
  },
};
const deps: ArquivosDeps = { db, armazenamento: emMemoria, segredo: "segredo-de-teste" };

beforeAll(() => ensureSeed(db));
afterAll(() => db.close());

describe("PMOC_PDF: só o ADM e o cliente dono", () => {
  it("CLIENTE A baixa o do A e recebe 404 no do B (e vice-versa)", async () => {
    expect(await lerArquivo(clientCtx("A"), SEED.fileAId, deps)).not.toBeNull();
    expect(await lerArquivo(clientCtx("A"), SEED.fileBId, deps)).toBeNull();
    expect(await lerArquivo(clientCtx("B"), SEED.fileBId, deps)).not.toBeNull();
    expect(await lerArquivo(clientCtx("B"), SEED.fileAId, deps)).toBeNull();
  });

  it("TECNICO não baixa PDF do PMOC (RN-166)", async () => {
    expect(await lerArquivo(technicianCtx(), SEED.fileAId, deps)).toBeNull();
    expect(await lerArquivo(technicianCtx(), SEED.fileBId, deps)).toBeNull();
  });

  it("ADM baixa os dois", async () => {
    expect(await lerArquivo(admCtx(), SEED.fileAId, deps)).not.toBeNull();
    expect(await lerArquivo(admCtx(), SEED.fileBId, deps)).not.toBeNull();
  });
});

describe("arquivo sem cliente e tipos sem regra", () => {
  it("CLIENTE e TECNICO não baixam o logo da empresa", async () => {
    expect(await lerArquivo(clientCtx("A"), SEED.logoFileId, deps)).toBeNull();
    expect(await lerArquivo(technicianCtx(), SEED.logoFileId, deps)).toBeNull();
  });

  it("id inexistente ou malformado dá 404 sem consultar o armazenamento", async () => {
    expect(await lerArquivo(admCtx(), "00000000-0000-4000-8000-000000000000", deps)).toBeNull();
    expect(await lerArquivo(admCtx(), "../seed/a", deps)).toBeNull();
  });
});
