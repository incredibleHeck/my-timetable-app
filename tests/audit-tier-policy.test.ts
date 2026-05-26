import { describe, it, expect } from "vitest";
import { auditFinalSchedule } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

describe("schedule audit modes", () => {
  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 6,
      maxConsecutivePeriods: 2,
      dayStructure: Array(6).fill({ type: "CLASS", label: "P" }),
    },
    classes: [
      {
        id: "c1",
        name: "10A",
        curriculum: [],
        defaultRoomId: "r1",
      },
    ],
    teachers: [
      {
        id: "t1",
        name: "Teacher",
        specialtyIds: ["s1"],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(6).fill(false)),
      },
    ],
    subjects: [{ id: "s1", name: "Math", color: "#000" }],
    rooms: [{ id: "r1", name: "Room 1", capacity: 30 }],
    schedule: {
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
          2: { subjectId: "s1", teacherId: "t1", classId: "c1" },
        },
      },
    },
  };

  it("generated mode ignores pedagogical layout warnings", () => {
    const generated = auditFinalSchedule(baseData, { mode: "generated" });
    expect(generated.some((c) => c.reason.includes("Class Gap"))).toBe(false);
    expect(generated.some((c) => c.reason.includes("split by"))).toBe(false);
  });

  it("full mode flags pedagogical layout issues after manual edits", () => {
    const state = initializeState(baseData);
    const full = auditFinalSchedule(baseData, { mode: "full" });
    expect(full.length).toBeGreaterThan(0);
    expect(
      full.some(
        (c) =>
          c.reason.includes("Class Gap") ||
          c.reason.includes("split by") ||
          c.reason.includes("sandwiched by"),
      ),
    ).toBe(true);
    expect(state.schedule.c1[0][0]).toBeDefined();
  });
});
