import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./tests/e2e/dados";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // os testes compartilham o banco do servidor de E2E
  timeout: 90_000,
  expect: { timeout: 20_000 }, // `next dev` compila cada rota na primeira visita
  use: { baseURL: process.env.E2E_BASE_URL ?? E2E.baseURL },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Banco embutido + migrações + usuários fictícios + next dev (tests/e2e/server.ts).
        command: "node node_modules/tsx/dist/cli.mjs --conditions=react-server tests/e2e/server.ts",
        url: `${E2E.baseURL}/login`,
        timeout: 300_000,
        reuseExistingServer: false,
      },
});
