import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { runPreflightCheck } from "../src/features/generator/scheduler/validation/preflight";

/**
 * `maxTeachingPeriodsPerWeek` is shown in the Workload screen and was never
 * consulted by anything: pre-flight measured capacity as available slots capped
 * by the *daily* limit, so a teacher could be assigned well past the weekly
 * agreement without a word.
 *
 * It is reported as a warning rather than an error. A curriculum may genuinely
 * demand more than the cap allows, and refusing to generate would trade a
 * warning the school can act on for lessons the students never receive.
 */

const PERIODS = 6;
const DAYS = 5;

function build(over: {
  weeklyCap?: number;
  curriculum?: Array<{
    subjectId: string;
    periodsPerWeek: number;
    singles: number;
    assignedTeacherId?: string;
  }>;
  jointClasses?: unknown[];
  classes?: unknown[];
}): AppData {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: PERIODS,
      daysPerWeek: DAYS,
      dayStructure: Array.from({ length: PERIODS }, (_, i) => ({
        type: "CLASS" as const,
        label: `P${i + 1}`,
      })),
      fixedOccasions: Array.from({ length: DAYS }, () => Array.from({ length: PERIODS }, () => "")),
      maxTeacherPeriodsPerDay: 6,
      maxTeachingPeriodsPerWeek: over.weeklyCap,
    },
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "PE", color: "#0f0" },
    ],
    teachers: [
      {
        id: "t1",
        name: "Aunty Ruth",
        specialtyIds: ["s1", "s2"],
        constraints: Array.from({ length: DAYS }, () =>
          Array.from({ length: PERIODS }, () => false),
        ),
      },
    ],
    classes: over.classes ?? [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: PERIODS,
        curriculum: over.curriculum ?? [],
      },
    ],
    jointClasses: over.jointClasses ?? [],
    rooms: [{ id: "r1", name: "R1", capacity: 100 }],
    schedule: {},
  } as unknown as AppData;
}

const capWarnings = (r: ReturnType<typeof runPreflightCheck>) =>
  r.warnings.filter((w) => w.message.includes("over the"));

describe("weekly teaching cap in pre-flight", () => {
  it("warns without blocking when a teacher is over the cap", () => {
    const result = runPreflightCheck(
      build({
        weeklyCap: 10,
        curriculum: [{ subjectId: "s1", periodsPerWeek: 14, singles: 14, assignedTeacherId: "t1" }],
      }),
    );

    const warned = capWarnings(result);
    expect(warned).toHaveLength(1);
    expect(warned[0].message).toContain("4 over the 10-period limit");
    expect(warned[0].teacherName).toBe("Aunty Ruth");

    // Generation must still be allowed to proceed.
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("says nothing when the teacher is exactly at the cap", () => {
    const result = runPreflightCheck(
      build({
        weeklyCap: 12,
        curriculum: [{ subjectId: "s1", periodsPerWeek: 12, singles: 12, assignedTeacherId: "t1" }],
      }),
    );
    expect(capWarnings(result)).toHaveLength(0);
  });

  it("says nothing when no cap is configured", () => {
    const result = runPreflightCheck(
      build({
        weeklyCap: undefined,
        curriculum: [{ subjectId: "s1", periodsPerWeek: 20, singles: 20, assignedTeacherId: "t1" }],
      }),
    );
    expect(capWarnings(result)).toHaveLength(0);
  });

  it("counts a joint lesson once, not once per partner class", () => {
    // Two classes take PE together, 4 periods a week. That is 4 periods of the
    // teacher's week, not 8 — counting per class would invent a breach.
    const classes = ["2A", "2B"].map((name, i) => ({
      id: `c${i + 1}`,
      name,
      defaultRoomId: "r1",
      periodCount: PERIODS,
      curriculum: [{ subjectId: "s2", periodsPerWeek: 4, singles: 4, assignedTeacherId: "t1" }],
    }));

    const result = runPreflightCheck(
      build({
        weeklyCap: 6,
        classes,
        jointClasses: [
          { id: "jc1", name: "Yr2 PE", subjectId: "s2", classIds: ["c1", "c2"], teacherId: "t1" },
        ],
      }),
    );

    expect(capWarnings(result)).toHaveLength(0);
  });

  it("still errors when the week physically cannot hold the load", () => {
    // 30 slots exist across the week; 40 periods cannot fit however the policy
    // is configured, so this remains a blocking error rather than a warning.
    const result = runPreflightCheck(
      build({
        weeklyCap: 100,
        curriculum: [{ subjectId: "s1", periodsPerWeek: 40, singles: 40, assignedTeacherId: "t1" }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("are available"))).toBe(true);
  });
});
