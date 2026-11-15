import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout (Playwright) — voir e2e/README.md.
// ⚠️ La base locale est celle de la PRODUCTION : chaque exécution marque ses données « E2E-… »
// et les supprime à la fin (e2e/global-teardown.ts). Lancer le serveur avec EMAIL_DISABLED=true.
try {
  process.loadEnvFile(".env");
} catch {
  // .env absent : variables déjà dans l'environnement.
}

export default defineConfig({
  testDir: "./e2e",
  // Un seul navigateur à la fois : les scénarios s'enchaînent (rôles → budget → dépense…).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    timezoneId: "Africa/Porto-Novo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  // Navigateur : Chromium de Playwright, ou le Chrome installé sur le poste avec
  // E2E_BROWSER_CHANNEL=chrome (utile si `npx playwright install` ne peut pas télécharger).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) },
    },
  ],
});
