# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Configuration >> updates periods per day from config view
- Location: e2e\app.spec.ts:57:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { DEFAULT_DATA } from "../src/utils/constants";
  3   | 
  4   | test.beforeEach(async ({ page }) => {
  5   |   await page.addInitScript(() => {
  6   |     localStorage.setItem("eduscheduler_activated_key", "EDU-TEST-TEST-TEST");
  7   |   });
  8   | });
  9   | 
  10  | const seedProfile = async (page: import("@playwright/test").Page, name = "E2E School", data = DEFAULT_DATA) => {
> 11  |   await page.goto("/");
      |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  12  |   await page.evaluate(
  13  |     ({ profileName, data }) => {
  14  |       const profile = {
  15  |         id: "e2e-profile",
  16  |         name: profileName,
  17  |         created: Date.now(),
  18  |         lastModified: Date.now(),
  19  |         data,
  20  |         meta: {},
  21  |       };
  22  |       localStorage.setItem(
  23  |         "profile_manifest",
  24  |         JSON.stringify({
  25  |           profiles: [{ id: profile.id, name: profile.name, lastModified: profile.lastModified }],
  26  |           activeProfileId: profile.id,
  27  |         }),
  28  |       );
  29  |       localStorage.setItem(`profile_data_${profile.id}`, JSON.stringify(profile));
  30  |     },
  31  |     { profileName: name, data },
  32  |   );
  33  |   await page.reload();
  34  | };
  35  | 
  36  | test.describe("Profile bootstrap", () => {
  37  |   test("shows welcome screen then dashboard after profile creation", async ({ page }) => {
  38  |     await page.goto("/");
  39  |     await expect(page.getByText("Welcome to EduScheduler Pro")).toBeVisible();
  40  |     await page.getByRole("button", { name: "Create First Profile" }).click();
  41  |     await page.getByLabel(/profile name/i).fill("Playwright School");
  42  |     await page.getByRole("button", { name: /create profile/i }).click();
  43  |     await expect(page.locator('strong:has-text("Playwright School")')).toBeVisible({ timeout: 15_000 });
  44  |   });
  45  | 
  46  |   test("loads seeded profile to dashboard", async ({ page }) => {
  47  |     await seedProfile(page);
  48  |     await expect(page.locator('strong:has-text("E2E School")')).toBeVisible({ timeout: 15_000 });
  49  |   });
  50  | });
  51  | 
  52  | test.describe("Configuration", () => {
  53  |   test.beforeEach(async ({ page }) => {
  54  |     await seedProfile(page);
  55  |   });
  56  | 
  57  |   test("updates periods per day from config view", async ({ page }) => {
  58  |     await page.getByRole("button", { name: /configuration/i }).click();
  59  |     await page.getByRole("tab", { name: "Day structure" }).click();
  60  |     const slider = page.locator("#periods-per-day");
  61  |     await slider.fill("10");
  62  |     await expect(page.getByText("10 Blocks")).toBeVisible();
  63  |   });
  64  | });
  65  | 
  66  | test.describe("Navigation", () => {
  67  |   test.beforeEach(async ({ page }) => {
  68  |     await seedProfile(page);
  69  |   });
  70  | 
  71  |   test("navigates to subjects and shows library header", async ({ page }) => {
  72  |     await page.getByRole("button", { name: /^subjects$/i }).click();
  73  |     await expect(page.getByRole("heading", { name: "Subject Library" })).toBeVisible();
  74  |   });
  75  | 
  76  |   test("navigates to generator view", async ({ page }) => {
  77  |     await page.getByRole("button", { name: "Auto-Generator" }).click();
  78  |     await expect(page.getByRole("heading", { name: "Auto-Scheduler" })).toBeVisible({
  79  |       timeout: 15_000,
  80  |     });
  81  |   });
  82  | });
  83  | 
  84  | test.describe("Export", () => {
  85  |   test.beforeEach(async ({ page }) => {
  86  |     await seedProfile(page);
  87  |   });
  88  | 
  89  |   test("triggers JSON export from sidebar", async ({ page }) => {
  90  |     const downloadPromise = page.waitForEvent("download");
  91  |     await page.getByRole("button", { name: "Save to Device" }).click();
  92  |     const download = await downloadPromise;
  93  |     expect(download.suggestedFilename()).toMatch(/\.json$/);
  94  |   });
  95  | });
  96  | 
  97  | test.describe("Scheduler", () => {
  98  |   test("generates and saves schedule E2E", async ({ page }) => {
  99  |     const schedulableData = {
  100 |       ...DEFAULT_DATA,
  101 |       settings: {
  102 |         ...DEFAULT_DATA.settings,
  103 |         periodsPerDay: 6,
  104 |         dayStructure: Array(6).fill({ type: "CLASS", label: "P" }),
  105 |       },
  106 |       classes: [
  107 |         {
  108 |           id: "c1",
  109 |           name: "10A",
  110 |           defaultRoomId: "r1",
  111 |           curriculum: [{ id: "curr1", subjectId: "s1", singles: 4, doubles: 0, assignedTeacherId: "t1", periodsPerWeek: 4 }],
```