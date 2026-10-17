import { defineConfig } from "@playwright/test";
import crypto from "node:crypto";

// End-to-end tests of the console against the real API and a real MongoDB (no Docker): a throwaway database, the API on one port and
// the web app on another. They use the Edge or Chrome that is already installed (no browser download).
const apiPort = 5181;
const webPort = 3101;
const key = () => crypto.randomBytes(32).toString("base64");
// The hash key is shared with the tests (through the environment) so a test can set a known sign-in code; the API only sees it as its own setting.
process.env.E2E_HASH_KEY ??= key();

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${webPort}`,
    channel: process.env.E2E_BROWSER ?? "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // reset.mjs drops the e2e database first, so every run starts clean.
      command: "node e2e/reset.mjs && dotnet run --project ../Ratable-Backend/src/Api --no-build --no-launch-profile",
      url: `http://localhost:${apiPort}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: "Development",
        ASPNETCORE_URLS: `http://localhost:${apiPort}`,
        Mongo__ConnectionString: "mongodb://localhost:27017",
        Mongo__Database: "ratable_e2e",
        Identity__OtpSender: "console",
        Identity__PhoneEncryptionKey: key(),
        Identity__PhoneHashKey: process.env.E2E_HASH_KEY,
        Verification__StorageKey: key(),
        Verification__StoragePath: "App_Data/e2e-proofs",
        Moderation__BurstThreshold: "1000",
      },
    },
    {
      command: `npx next dev -p ${webPort}`,
      url: `http://localhost:${webPort}/en/console`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { API_URL: `http://localhost:${apiPort}`, API_REVALIDATE_SECONDS: "0" },
    },
  ],
});
