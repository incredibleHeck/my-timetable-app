import { test, expect } from "@playwright/test";
import { DEFAULT_DATA } from "../src/utils/constants";

const seedProfile = async (page: import("@playwright/test").Page, name = "E2E School") => {
  await page.goto("/");
  await page.evaluate(
    ({ profileName, data }) => {
      const profile = {
        id: "e2e-profile",
        name: profileName,
        created: Date.now(),
        lastModified: Date.now(),
        data,
        meta: {},
      };
      localStorage.setItem(
        "profile_manifest",
        JSON.stringify({
          profiles: [{ id: profile.id, name: profile.name, lastModified: profile.lastModified }],
          activeProfileId: profile.id,
        }),
      );
      localStorage.setItem(`profile_data_${profile.id}`, JSON.stringify(profile));
    },
    { profileName: name, data: DEFAULT_DATA },
  );
  await page.reload();
};

test.describe("Profile bootstrap", () => {
  test("shows welcome screen then dashboard after profile creation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to EduScheduler Pro")).toBeVisible();
    await page.getByRole("button", { name: "Create First Profile" }).click();
    await page.getByLabel(/profile name/i).fill("Playwright School");
    await page.getByRole("button", { name: /create profile/i }).click();
    await expect(page.locator('strong:has-text("Playwright School")')).toBeVisible({ timeout: 15_000 });
  });

  test("loads seeded profile to dashboard", async ({ page }) => {
    await seedProfile(page);
    await expect(page.locator('strong:has-text("E2E School")')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
  });

  test("updates periods per day from config view", async ({ page }) => {
    await page.getByRole("button", { name: /configuration/i }).click();
    await page.getByRole("tab", { name: "Day structure" }).click();
    const slider = page.locator("#periods-per-day");
    await slider.fill("10");
    await expect(page.getByText("10 Blocks")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
  });

  test("navigates to subjects and shows library header", async ({ page }) => {
    await page.getByRole("button", { name: /^subjects$/i }).click();
    await expect(page.getByRole("heading", { name: "Subject Library" })).toBeVisible();
  });

  test("navigates to generator view", async ({ page }) => {
    await page.getByRole("button", { name: /generator/i }).click();
    await expect(page.getByRole("heading", { name: "Auto-Scheduler" })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Export", () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
  });

  test("triggers JSON export from sidebar", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save to Device" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});
