import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { getMaxPeriodsPerDay } from "../src/features/generator/scheduler/utils/utils";
import { SCORING_WEIGHTS } from "../src/features/generator/scheduler/constants";

/**
 * The solver's slot scans stopped at a hardcoded 15 "as per UI limits", which
 * was wrong in both directions: shorter schools paid to test columns that cannot
 * exist, and a school with more than 15 periods a day would have had lessons
 * silently refused a home with no constraint able to explain why.
 */

function withClasses(classes: unknown[], settings: Partial<AppData["settings"]> = {}): AppData {
  return {
    ...DEFAULT_DATA,
    settings: { ...DEFAULT_DATA.settings, ...settings },
    classes,
  } as unknown as AppData;
}

describe("getMaxPeriodsPerDay", () => {
  it("uses the global period count when no class overrides it", () => {
    const data = withClasses([{ id: "c1", name: "A", curriculum: [] }], {
      periodsPerDay: 8,
      dayStructure: Array.from({ length: 8 }, () => ({ type: "CLASS" as const, label: "P" })),
    });
    expect(getMaxPeriodsPerDay(data)).toBe(8);
  });

  it("does not invent slots beyond the school's day", () => {
    const data = withClasses([{ id: "c1", name: "A", curriculum: [], periodCount: 6 }], {
      periodsPerDay: 6,
      dayStructure: Array.from({ length: 6 }, () => ({ type: "CLASS" as const, label: "P" })),
    });
    // The old ceiling would have scanned 15.
    expect(getMaxPeriodsPerDay(data)).toBe(6);
  });

  it("follows the longest class day, not the global default", () => {
    const data = withClasses(
      [
        { id: "c1", name: "A", curriculum: [], periodCount: 6 },
        { id: "c2", name: "B", curriculum: [], periodCount: 11 },
      ],
      {
        periodsPerDay: 6,
        dayStructure: Array.from({ length: 6 }, () => ({ type: "CLASS" as const, label: "P" })),
      },
    );
    expect(getMaxPeriodsPerDay(data)).toBe(11);
  });

  it("reaches past 15 for a school with a longer day", () => {
    const data = withClasses([{ id: "c1", name: "A", curriculum: [], periodCount: 18 }], {
      periodsPerDay: 18,
      dayStructure: Array.from({ length: 18 }, () => ({ type: "CLASS" as const, label: "P" })),
    });
    expect(getMaxPeriodsPerDay(data)).toBe(18);
    expect(getMaxPeriodsPerDay(data)).toBeGreaterThan(15);
  });

  it("counts a class structure longer than its declared period count", () => {
    const data = withClasses(
      [
        {
          id: "c1",
          name: "A",
          curriculum: [],
          structure: Array.from({ length: 10 }, () => ({ type: "CLASS" as const, label: "P" })),
        },
      ],
      { periodsPerDay: 6 },
    );
    expect(getMaxPeriodsPerDay(data)).toBe(10);
  });
});

describe("SCORING_WEIGHTS", () => {
  it("carries no weight the scorer never reads", () => {
    // Calibration perturbs every key here across runs; an inert entry spends
    // self-tuning budget on a number that cannot change the outcome.
    for (const dead of [
      "TEACHER_CONTINUITY",
      "LUNCH_PROTECTION",
      "TEACHER_WINDOW",
      "ROOM_CHANGE",
    ]) {
      expect(SCORING_WEIGHTS).not.toHaveProperty(dead);
    }
  });
});
