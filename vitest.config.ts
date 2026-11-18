import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // O pacote real lança fora do bundler do Next; nos testes vira um módulo vazio.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts", "tests/isolation/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
      {
        // PDFs (05 §3.11): snapshot de texto com 1, 30 e 200 equipamentos (o de 200 leva dezenas de s).
        resolve: { alias },
        test: {
          name: "pdf",
          include: ["tests/pdf/**/*.test.ts"],
          testTimeout: 300_000,
        },
      },
      {
        // Spikes (05 §10.4): banco próprio, porque alteram esquema (S-04) e carregam volume (S-05).
        resolve: { alias },
        test: {
          name: "spike",
          include: ["tests/spikes/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          testTimeout: 300_000,
          hookTimeout: 600_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
