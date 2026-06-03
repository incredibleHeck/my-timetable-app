import { test, expect } from "@playwright/test";
import { DEFAULT_DATA } from "../src/utils/constants";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eduscheduler_activated_key", "EDU-TEST-TEST-TEST");
  });
});

const seedProfile = async (page: import("@playwright/test").Page, name = "E2E School", data = DEFAULT_DATA) => {
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
    { profileName: name, data },
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
    await page.getByRole("button", { name: "Auto-Generator" }).click();
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

test.describe("Scheduler", () => {
  test("generates and saves schedule E2E", async ({ page }) => {
    const schedulableData = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 6,
        dayStructure: Array(6).fill({ type: "CLASS", label: "P" }),
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          curriculum: [{ id: "curr1", subjectId: "s1", singles: 4, doubles: 0, assignedTeacherId: "t1", periodsPerWeek: 4 }],
        },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher One",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(6).fill(false)),
        },
      ],
      subjects: [{ id: "s1", name: "Math", color: "#2563eb" }],
      rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
      schedule: {},
    };

    await seedProfile(page, "Schedulable School", schedulableData);

    // Navigate to generator view
    await page.getByRole("button", { name: "Auto-Generator" }).click();
    await expect(page.getByRole("heading", { name: "Auto-Scheduler" })).toBeVisible({ timeout: 15_000 });

    // Click Generate Schedule
    await page.getByRole("button", { name: /generate schedule/i }).click();

    // Wait for the solver to find a perfect schedule
    await expect(page.getByText("Perfect timetable found!")).toBeVisible({ timeout: 15_000 });

    // Click Stop Solver to apply the schedule and stop search
    await page.getByRole("button", { name: "Stop Solver" }).click();

    // Verify stats updates
    await expect(page.getByText("fully placed")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=/Last run:/')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Profile switching E2E", () => {
  test("creates a second profile and switches back and forth", async ({ page }) => {
    await seedProfile(page, "First School");
    await expect(page.locator('strong:has-text("First School")')).toBeVisible({ timeout: 15_000 });

    // Open Profile Wizard via New Profile button
    await page.getByRole("button", { name: "New Profile" }).click();
    await page.getByLabel(/profile name/i).fill("Second School");
    await page.getByRole("button", { name: /save profile/i }).click();

    // Verify switched to Second School
    await expect(page.locator('strong:has-text("Second School")')).toBeVisible({ timeout: 15_000 });

    // Switch back to First School
    await page.getByRole("button", { name: "Switch Profile" }).click();
    await page.locator("div").filter({ hasText: /^First SchoolSwitch$/ }).getByRole("button", { name: "Switch" }).click();
    await expect(page.locator('strong:has-text("First School")')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("JSON Backup Round-trip E2E", () => {
  test("exports data and triggers import file picker", async ({ page }) => {
    await seedProfile(page, "Backup School");
    await expect(page.locator('strong:has-text("Backup School")')).toBeVisible({ timeout: 15_000 });

    // Test Export JSON
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Test Import JSON button click triggers file input click
    await page.getByRole("button", { name: "Import JSON" }).click();
  });
});

test.describe("Undo/Redo E2E", () => {
  test("performs undo and redo on config changes", async ({ page }) => {
    await seedProfile(page, "Undo School");
    await page.getByRole("button", { name: /configuration/i }).click();
    await page.getByRole("tab", { name: "Day structure" }).click();
    const slider = page.locator("#periods-per-day");
    await slider.fill("10");
    await expect(page.getByText("10 Blocks")).toBeVisible();

    // Click Undo button in the header
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    // Verify it reverts to original (which is 8 blocks in seed data)
    await expect(page.getByText("8 Blocks")).toBeVisible();

    // Click Redo button in the header
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByText("10 Blocks")).toBeVisible();
  });
});

test.describe("Operational Views Navigation E2E", () => {
  test("navigates to exams, duty, and rooms views", async ({ page }) => {
    await seedProfile(page, "Nav School");

    // Navigate to Rooms View
    await page.getByRole("button", { name: "Rooms" }).click();
    await expect(page.getByRole("heading", { name: "Room Management" })).toBeVisible({ timeout: 15_000 });

    // Navigate to Exams View
    await page.getByRole("button", { name: "Exam Timetable" }).click();
    await expect(page.getByRole("heading", { name: "Exam Timetable" })).toBeVisible({ timeout: 15_000 });

    // Go back to Dashboard to bring back the sidebar
    await page.getByTitle("Back to Dashboard").click();

    // Navigate to Duty View
    await page.getByRole("button", { name: "Duty Roster", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Duty Roster" })).toBeVisible({ timeout: 15_000 });
  });
});
