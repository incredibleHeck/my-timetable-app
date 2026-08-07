import { test, expect } from "@playwright/test";
import { DEFAULT_DATA } from "../src/utils/constants";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eduscheduler_activated_key", "EDU-TEST-TEST-TEST");
  });
});

/**
 * Scope a query to the sidebar. Several labels ("Configuration", "New Profile",
 * "Generate Schedule") appear both in the sidebar/toolbar and again in dashboard
 * shortcuts, which trips Playwright's strict mode.
 */
const nav = (page: import("@playwright/test").Page) => page.getByLabel("Main navigation");

const seedProfile = async (
  page: import("@playwright/test").Page,
  name = "E2E School",
  data = DEFAULT_DATA,
) => {
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
    await expect(page.locator('strong:has-text("Playwright School")')).toBeVisible({
      timeout: 15_000,
    });
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
    await nav(page).getByRole("button", { name: "Configuration", exact: true }).click();
    await page.getByRole("tab", { name: "Day structure" }).click();
    const periods = page.locator("#periods-per-day");
    await periods.fill("10");
    await periods.blur();
    await expect(page.getByRole("textbox", { name: "Period 10 name" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Auto-Generator" })).toBeVisible({
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
  // The solver runs to a 60s budget, so this one needs more than the 30s default.
  test("generates and saves schedule E2E", async ({ page }) => {
    test.setTimeout(120_000);

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
          curriculum: [
            {
              id: "curr1",
              subjectId: "s1",
              singles: 4,
              doubles: 0,
              assignedTeacherId: "t1",
              periodsPerWeek: 4,
            },
          ],
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
    await expect(page.getByRole("heading", { name: "Auto-Generator" })).toBeVisible({
      timeout: 15_000,
    });

    // Click Generate Schedule
    await page
      .getByRole("button", { name: /generate schedule/i })
      .first()
      .click();

    // The solver searches for its full budget (60s by default) and only writes
    // its result into the grid when stopped. Stopping before it has found a
    // solution applies nothing, which leaves the grid empty — so wait for the
    // solution signal first, then stop.
    await expect(page.getByText("Conflict-free timetable found")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Stop Solver" }).click();

    // Assert a timetable was produced — not that it was a *perfect* one. The
    // solver is stochastic and time-boxed, so asserting perfection makes this a
    // coin flip even when the scheduler is working correctly. The grid's own
    // anchors are the stable evidence that lessons landed.
    await expect(page.getByTestId(/^schedule-slot-/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Last run/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Profile switching E2E", () => {
  test("creates a second profile and switches back and forth", async ({ page }) => {
    await seedProfile(page, "First School");
    await expect(page.locator('strong:has-text("First School")')).toBeVisible({ timeout: 15_000 });

    // Open Profile Wizard via New Profile button
    await nav(page).getByRole("button", { name: "New Profile" }).click();
    await page.getByLabel(/profile name/i).fill("Second School");
    // The wizard's confirm button is labelled "Create Profile" (never "Save Profile").
    await page.getByRole("button", { name: /create profile/i }).click();

    // Verify switched to Second School
    await expect(page.locator('strong:has-text("Second School")')).toBeVisible({ timeout: 15_000 });

    // Switch back to First School
    await page.getByRole("button", { name: "Switch Profile" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^First SchoolSwitch$/ })
      .getByRole("button", { name: "Switch" })
      .click();
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
    await nav(page).getByRole("button", { name: "Configuration", exact: true }).click();
    await page.getByRole("tab", { name: "Day structure" }).click();
    const periods = page.locator("#periods-per-day");
    await periods.fill("10");
    await periods.blur();
    await expect(periods).toHaveValue("10");

    // Click Undo button in the header
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    // Verify it reverts to original (which is 8 periods in seed data)
    await expect(periods).toHaveValue("8");

    // Click Redo button in the header
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(periods).toHaveValue("10");
  });
});

test.describe("Operational Views Navigation E2E", () => {
  test("navigates to exams, duty, and rooms views", async ({ page }) => {
    await seedProfile(page, "Nav School");

    // Anchor on data-testid, not on headings. The full-width workspace screens
    // deliberately do not title themselves (see GeneratorToolbar), so asserting
    // on a heading breaks every time the chrome is tidied.
    await page.getByRole("button", { name: "Rooms" }).click();
    await expect(page.getByTestId("rooms-view")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Exam Timetable" }).click();
    await expect(page.getByTestId("exams-view")).toBeVisible({ timeout: 15_000 });

    // Go back to Dashboard to bring back the sidebar
    await page.getByTitle("Back to Dashboard").click();

    await page.getByRole("button", { name: "Duty Roster", exact: true }).click();
    await expect(page.getByTestId("duty-view")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Legacy Profile Migration E2E", () => {
  test("seeds un-versioned v0 profile and verifies smooth migration on load", async ({ page }) => {
    await page.goto("/");
    // The fixture must differ from a current profile in exactly one way: no
    // schemaVersion. Hand-rolling `data` instead of using DEFAULT_DATA makes the
    // profile fail schema validation for unrelated reasons (missing
    // dayStructure / maxConsecutivePeriods), so it is dropped before the
    // migration chain is ever reached and the test proves nothing.
    await page.evaluate((data) => {
      const v0Profile = {
        id: "legacy-v0-profile",
        name: "Legacy V0 School",
        created: Date.now(),
        lastModified: Date.now(),
        data,
        meta: {},
        // note: no schemaVersion — this is what makes it v0
      };
      localStorage.setItem(
        "profile_manifest",
        JSON.stringify({
          profiles: [
            { id: v0Profile.id, name: v0Profile.name, lastModified: v0Profile.lastModified },
          ],
          activeProfileId: v0Profile.id,
        }),
      );
      localStorage.setItem(`profile_data_${v0Profile.id}`, JSON.stringify(v0Profile));
    }, DEFAULT_DATA);
    await page.reload();

    await expect(page.locator('strong:has-text("Legacy V0 School")')).toBeVisible({
      timeout: 15_000,
    });

    // Loading it is necessary but not sufficient — assert the chain actually ran
    // and stamped the profile, otherwise this passes even if migration is skipped.
    const storedVersion = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("eduscheduler");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return await new Promise<unknown>((resolve, reject) => {
        const req = db
          .transaction("profiles", "readonly")
          .objectStore("profiles")
          .get("legacy-v0-profile");
        req.onsuccess = () => resolve((req.result as { schemaVersion?: unknown })?.schemaVersion);
        req.onerror = () => reject(req.error);
      });
    });
    expect(storedVersion).toBe(1);
  });
});

test.describe("Operational Views Deep E2E", () => {
  test("Exam roster: create, auto-assign, and export", async ({ page }) => {
    // DEFAULT_DATA is an empty school. The auto-schedule modal derives its
    // selection from data.subjects / data.classes, so with the default fixture
    // "Generate Schedule" is disabled forever and this test cannot pass.
    const examinableData = {
      ...DEFAULT_DATA,
      subjects: [
        { id: "s1", name: "Math", color: "#2563eb", isExaminable: true, examPaperCount: 1 },
        { id: "s2", name: "English", color: "#16a34a", isExaminable: true, examPaperCount: 1 },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher One",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(8).fill(false)),
        },
        {
          id: "t2",
          name: "Teacher Two",
          specialtyIds: ["s2"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(8).fill(false)),
        },
      ],
      rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          studentCount: 25,
          // The exam scheduler derives its class/subject pairs from the
          // curriculum. With an empty curriculum it places nothing, the roster
          // stays at "0 sessions", and every later step has nothing to act on.
          curriculum: [
            {
              id: "cu1",
              subjectId: "s1",
              singles: 2,
              doubles: 0,
              assignedTeacherId: "t1",
              periodsPerWeek: 2,
            },
            {
              id: "cu2",
              subjectId: "s2",
              singles: 2,
              doubles: 0,
              assignedTeacherId: "t2",
              periodsPerWeek: 2,
            },
          ],
        },
      ],
    };

    await seedProfile(page, "Exam School", examinableData);
    await page.getByRole("button", { name: "Exam Timetable" }).click();
    await expect(page.getByTestId("exams-view")).toBeVisible({ timeout: 15_000 });

    // A "Standard Timetable" roster already exists, and Auto Schedule creates
    // the exam day itself — no need to add either by hand.
    await page.getByRole("button", { name: "Auto Schedule" }).click();
    const autoDialog = page.getByRole("dialog");
    await expect(autoDialog).toBeVisible({ timeout: 15_000 });
    await autoDialog.getByRole("button", { name: "Generate Schedule" }).click();

    // Placement is the precondition for everything below it.
    await expect(page.getByText("2 sessions")).toBeVisible({ timeout: 15_000 });

    // Auto Assign. Scope the confirm to the dialog rather than using .nth(1) —
    // the toolbar button and the modal's confirm both match "Assign staff", and
    // their DOM order is an implementation detail of where the modal portals to.
    await page.getByTitle(/Assign staff/).click();
    const assignDialog = page.getByRole("dialog");
    await expect(assignDialog).toBeVisible({ timeout: 15_000 });
    await assignDialog.getByRole("button", { name: "Assign staff", exact: true }).click();

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByTitle("Export to Excel").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("Duty roster: create, auto-assign, and export", async ({ page }) => {
    await seedProfile(page, "Duty School");
    await page.getByRole("button", { name: "Duty Roster", exact: true }).click();

    // In DutyView, we need to click Auto-Generate.
    await page.getByRole("button", { name: "Auto-Generate" }).click();
    await page.getByRole("button", { name: "Generate Roster" }).click();

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByTitle("Export to Excel").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe("Scheduler Drag-Edit E2E", () => {
  test("Drag-edit: assert the grid actually changed", async ({ page }) => {
    const schedulableData = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 4,
        dayStructure: Array(4).fill({ type: "CLASS", label: "P" }),
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          curriculum: [
            {
              id: "curr1",
              subjectId: "s1",
              singles: 1,
              doubles: 0,
              assignedTeacherId: "t1",
              periodsPerWeek: 1,
            },
          ],
        },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher One",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(4).fill(false)),
        },
      ],
      subjects: [{ id: "s1", name: "Math", color: "#2563eb" }],
      rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", roomId: "r1", isLocked: false, classId: "c1" },
          },
        },
      },
    };

    await seedProfile(page, "Drag Edit School", schedulableData);

    // Navigate to generator view
    await page.getByRole("button", { name: "Auto-Generator" }).click();
    await expect(page.getByTestId("generator-view")).toBeVisible({ timeout: 15_000 });

    // The seeded lesson starts at day 0, period 0.
    const source = page.getByTestId("schedule-slot-0-0");
    const target = page.getByTestId("schedule-cell-0-1");
    await expect(source).toBeVisible({ timeout: 15_000 });

    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("grid cells are not laid out");

    // dnd-kit's PointerSensor needs a real press-move-release with intermediate
    // moves; Playwright's dragTo() fires too coarsely to trip the activation
    // constraint.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    });
    await page.mouse.up();

    // Assert the grid actually changed: the lesson is now in period 1 and gone
    // from period 0. Asserting only that "Math" is still on screen passes even
    // when the drop does nothing.
    await expect(page.getByTestId("schedule-slot-0-1")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("schedule-slot-0-0")).toHaveCount(0);
  });
});
