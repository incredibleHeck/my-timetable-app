# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Scheduler >> generates and saves schedule E2E
- Location: e2e\app.spec.ts:92:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Auto-Generator' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"../../components/ui\" from \"src/features/activation/components/ActivationScreen.tsx\". Does the file exist?"
  - generic [ref=e5]: C:/my-timetable-app/src/features/activation/components/ActivationScreen.tsx:3:23
  - generic [ref=e6]: "18 | import React, { useState } from \"react\"; 19 | import { Lock, KeyRound, AlertCircle } from \"lucide-react\"; 20 | import { Button } from \"../../components/ui\"; | ^ 21 | export const ActivationScreen = ({ 22 | onActivate,"
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:29019:43) at TransformPluginContext.error (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:29016:14) at normalizeUrl (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:27139:18) at process.processTicksAndRejections (node:internal/process/task_queues:104:5) at async file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:27197:32 at async Promise.all (index 5) at async TransformPluginContext.transform (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:27165:4) at async EnvironmentPluginContainer.transform (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:28817:14) at async loadAndTransform (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:22686:26) at async viteTransformMiddleware (file:///C:/my-timetable-app/node_modules/vite/dist/node/chunks/config.js:24562:20)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```

# Test source

```ts
  26  |   );
  27  |   await page.reload();
  28  | };
  29  | 
  30  | test.describe("Profile bootstrap", () => {
  31  |   test("shows welcome screen then dashboard after profile creation", async ({ page }) => {
  32  |     await page.goto("/");
  33  |     await expect(page.getByText("Welcome to EduScheduler Pro")).toBeVisible();
  34  |     await page.getByRole("button", { name: "Create First Profile" }).click();
  35  |     await page.getByLabel(/profile name/i).fill("Playwright School");
  36  |     await page.getByRole("button", { name: /create profile/i }).click();
  37  |     await expect(page.locator('strong:has-text("Playwright School")')).toBeVisible({ timeout: 15_000 });
  38  |   });
  39  | 
  40  |   test("loads seeded profile to dashboard", async ({ page }) => {
  41  |     await seedProfile(page);
  42  |     await expect(page.locator('strong:has-text("E2E School")')).toBeVisible({ timeout: 15_000 });
  43  |   });
  44  | });
  45  | 
  46  | test.describe("Configuration", () => {
  47  |   test.beforeEach(async ({ page }) => {
  48  |     await seedProfile(page);
  49  |   });
  50  | 
  51  |   test("updates periods per day from config view", async ({ page }) => {
  52  |     await page.getByRole("button", { name: /configuration/i }).click();
  53  |     await page.getByRole("tab", { name: "Day structure" }).click();
  54  |     const slider = page.locator("#periods-per-day");
  55  |     await slider.fill("10");
  56  |     await expect(page.getByText("10 Blocks")).toBeVisible();
  57  |   });
  58  | });
  59  | 
  60  | test.describe("Navigation", () => {
  61  |   test.beforeEach(async ({ page }) => {
  62  |     await seedProfile(page);
  63  |   });
  64  | 
  65  |   test("navigates to subjects and shows library header", async ({ page }) => {
  66  |     await page.getByRole("button", { name: /^subjects$/i }).click();
  67  |     await expect(page.getByRole("heading", { name: "Subject Library" })).toBeVisible();
  68  |   });
  69  | 
  70  |   test("navigates to generator view", async ({ page }) => {
  71  |     await page.getByRole("button", { name: "Auto-Generator" }).click();
  72  |     await expect(page.getByRole("heading", { name: "Auto-Scheduler" })).toBeVisible({
  73  |       timeout: 15_000,
  74  |     });
  75  |   });
  76  | });
  77  | 
  78  | test.describe("Export", () => {
  79  |   test.beforeEach(async ({ page }) => {
  80  |     await seedProfile(page);
  81  |   });
  82  | 
  83  |   test("triggers JSON export from sidebar", async ({ page }) => {
  84  |     const downloadPromise = page.waitForEvent("download");
  85  |     await page.getByRole("button", { name: "Save to Device" }).click();
  86  |     const download = await downloadPromise;
  87  |     expect(download.suggestedFilename()).toMatch(/\.json$/);
  88  |   });
  89  | });
  90  | 
  91  | test.describe("Scheduler", () => {
  92  |   test("generates and saves schedule E2E", async ({ page }) => {
  93  |     const schedulableData = {
  94  |       ...DEFAULT_DATA,
  95  |       settings: {
  96  |         ...DEFAULT_DATA.settings,
  97  |         periodsPerDay: 6,
  98  |         dayStructure: Array(6).fill({ type: "CLASS", label: "P" }),
  99  |       },
  100 |       classes: [
  101 |         {
  102 |           id: "c1",
  103 |           name: "10A",
  104 |           defaultRoomId: "r1",
  105 |           curriculum: [{ id: "curr1", subjectId: "s1", singles: 4, doubles: 0, assignedTeacherId: "t1", periodsPerWeek: 4 }],
  106 |         },
  107 |       ],
  108 |       teachers: [
  109 |         {
  110 |           id: "t1",
  111 |           name: "Teacher One",
  112 |           specialtyIds: ["s1"],
  113 |           constraints: Array(5)
  114 |             .fill(null)
  115 |             .map(() => Array(6).fill(false)),
  116 |         },
  117 |       ],
  118 |       subjects: [{ id: "s1", name: "Math", color: "#2563eb" }],
  119 |       rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
  120 |       schedule: {},
  121 |     };
  122 | 
  123 |     await seedProfile(page, "Schedulable School", schedulableData);
  124 | 
  125 |     // Navigate to generator view
> 126 |     await page.getByRole("button", { name: "Auto-Generator" }).click();
      |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  127 |     await expect(page.getByRole("heading", { name: "Auto-Scheduler" })).toBeVisible({ timeout: 15_000 });
  128 | 
  129 |     // Click Generate Schedule
  130 |     await page.getByRole("button", { name: /generate schedule/i }).click();
  131 | 
  132 |     // Wait for the solver to find a perfect schedule
  133 |     await expect(page.getByText("Perfect timetable found!")).toBeVisible({ timeout: 15_000 });
  134 | 
  135 |     // Click Stop Solver to apply the schedule and stop search
  136 |     await page.getByRole("button", { name: "Stop Solver" }).click();
  137 | 
  138 |     // Verify stats updates
  139 |     await expect(page.getByText("fully placed")).toBeVisible({ timeout: 15_000 });
  140 |     await expect(page.locator('text=/Last run:/')).toBeVisible({ timeout: 15_000 });
  141 |   });
  142 | });
  143 | 
```