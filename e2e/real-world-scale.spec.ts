import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Scale checks against a real school export.
 *
 * The fixture lives in `scripts/diagnostics/fixtures/local/`, which .gitignore
 * excludes because it holds real staff data. It is deliberately NOT inlined
 * here: this spec is committed, so pasting the data in would publish forty real
 * names to the repository. Instead the file is read at run time and the whole
 * suite skips when it is absent — so it runs on a developer machine that has it
 * and is a no-op in CI, which never will.
 *
 * To run these, drop a profile export at the path below.
 */
const FIXTURE = path.resolve("scripts/diagnostics/fixtures/local/dansoman.json");
const hasFixture = fs.existsSync(FIXTURE);

// Shape only — no personal data is asserted on anywhere in this file.
const EXPECTED = { subjects: 20, teachers: 40, rooms: 18, classes: 14 };

test.describe("Real-world scale", () => {
  test.skip(!hasFixture, `private fixture not present at ${FIXTURE} (gitignored; local-only)`);

  let appData: Record<string, unknown>;

  test.beforeAll(() => {
    if (!hasFixture) return;
    const parsed = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    // Accept either a bare AppData export or a full Profile envelope.
    appData = (parsed.data ?? parsed) as Record<string, unknown>;
  });

  const seedRealSchool = async (page: import("@playwright/test").Page) => {
    await page.goto("/");
    await page.evaluate((data) => {
      localStorage.setItem("eduscheduler_activated_key", "EDU-TEST-TEST-TEST");
      const profile = {
        id: "real-scale",
        name: "Scale School",
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
    }, appData);
    await page.reload();
  };

  test("the fixture still has the shape these tests assume", () => {
    for (const [key, count] of Object.entries(EXPECTED)) {
      expect((appData[key] as unknown[]).length, `${key} count`).toBe(count);
    }
  });

  test("loads a full school without dropping records", async ({ page }) => {
    test.setTimeout(90_000);
    await seedRealSchool(page);

    // The sidebar shows a live count beside each academic-data entry, which is
    // the cheapest end-to-end proof that nothing was lost in parse + migrate.
    await expect(page.getByRole("button", { name: `Teachers ${EXPECTED.teachers}` })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: `Rooms ${EXPECTED.rooms}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Subjects ${EXPECTED.subjects}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Classes ${EXPECTED.classes}` })).toBeVisible();
  });

  test("renders the generator grid for a real timetable", async ({ page }) => {
    test.setTimeout(90_000);
    await seedRealSchool(page);

    await page.getByRole("button", { name: "Auto-Generator" }).click();
    await expect(page.getByTestId("generator-view")).toBeVisible({ timeout: 30_000 });

    // The fixture ships a full schedule, so lessons must render without running
    // the solver at all.
    await expect(page.getByTestId(/^schedule-slot-/).first()).toBeVisible({ timeout: 30_000 });
    const placed = await page.getByTestId(/^schedule-slot-/).count();
    expect(placed).toBeGreaterThan(0);
  });

  test("renders workload analysis across the full faculty", async ({ page }) => {
    test.setTimeout(90_000);
    await seedRealSchool(page);

    await page.getByRole("button", { name: "Workload Analysis" }).click();
    // Every teacher should appear in the analysis, not just the scheduled ones.
    await expect(page.getByText(/Teacher|Faculty|Workload/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("opens the operational views at scale", async ({ page }) => {
    test.setTimeout(90_000);
    await seedRealSchool(page);

    await page.getByRole("button", { name: "Exam Timetable" }).click();
    await expect(page.getByTestId("exams-view")).toBeVisible({ timeout: 30_000 });

    await page.getByTitle("Back to Dashboard").click();
    await page.getByRole("button", { name: "Duty Roster", exact: true }).click();
    await expect(page.getByTestId("duty-view")).toBeVisible({ timeout: 30_000 });
  });
});
