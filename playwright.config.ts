import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Serial everywhere: all specs share one Vite dev server, and parallel workers
  // intermittently time out on page.reload() under that contention. The suite
  // runs in ~60s serially, so determinism is worth more than the parallelism.
  workers: 1,
  reporter: "list",
  use: {
    // Must match server.host/port in vite.config.ts (127.0.0.1:5180, strictPort).
    // "localhost" can resolve to ::1 on Windows and miss Vite's IPv4 bind.
    baseURL: "http://127.0.0.1:5180",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
