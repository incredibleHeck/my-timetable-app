import { describe, it, expect } from "vitest";
import { resolveSubjectIsCore } from "../src/features/generator/scheduler/logic/subject-core";
import {
  getMaxSubjectPeriodsPerDaySpread,
  getSubjectWeeklyPeriods,
} from "../src/features/generator/scheduler/logic/subject-spread";
import { calculateTeacherWeeklyVariance } from "../src/features/generator/scheduler/logic/scoring";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { DEFAULT_DATA } from "../src/utils/constants";
import { solveSmart } from "../src/features/generator/scheduler/solver/solver";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";

describe("Remaining solver audit fixes", () => {
  it("resolveSubjectIsCore uses only the explicit Subject.isCore flag", () => {
    expect(resolveSubjectIsCore({ name: "Kunst", isCore: true })).toBe(true);
    expect(resolveSubjectIsCore({ name: "Mathematik", isCore: false })).toBe(false);

    // Deliberate change of meaning. This used to infer core status from an
    // English keyword list, so "Mathematik" resolved to true here — a subject
    // given morning priority by its spelling, with the Subject editor's Core
    // checkbox unticked and nothing explaining it. Only the checkbox counts now.
    expect(resolveSubjectIsCore({ name: "Mathematik" })).toBe(false);
    expect(resolveSubjectIsCore({ name: "Kunst" })).toBe(false);
  });

  it("getMaxSubjectPeriodsPerDaySpread uses ceil(N/D)+1", () => {
    expect(getMaxSubjectPeriodsPerDaySpread(5, 5)).toBe(2);
    expect(getMaxSubjectPeriodsPerDaySpread(8, 5)).toBe(3);
  });

  it("enforceSubjectDaySpread limits stacking one subject on a single day", () => {
    const dayStructure = DEFAULT_DATA.settings.dayStructure;
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        enforceSubjectDaySpread: true,
        maxSubjectPeriodsPerDay: 4,
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          periodCount: 8,
          structure: dayStructure,
          curriculum: [{ subjectId: "s-math", singles: 5, doubles: 0 }],
        },
      ],
      rooms: [{ id: "r1", name: "Room", capacity: 30, type: "Classroom" }],
      teachers: [
        {
          id: "t1",
          name: "Teacher",
          specialtyIds: ["s-math"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(8).fill(false)),
        },
      ],
      subjects: [{ id: "s-math", name: "Math", color: "#f00" }],
    };

    const units: AllocationUnit[] = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      subjectId: "s-math",
      subjectName: "Math",
      duration: 1,
      classIds: ["c1"],
      classNames: ["10A"],
      teacherIds: ["t1"],
      teacherNames: ["T1"],
      priority: 10,
      rankLevel: 10,
    }));

    const { state } = solveSmart(units, data);
    const dayCounts = Object.values(state.schedule["c1"] ?? {}).map(
      (day) => Object.values(day ?? {}).filter((slot) => slot?.subjectId === "s-math").length,
    );

    expect(Math.max(...dayCounts)).toBeLessThanOrEqual(2);
  });

  it("calculateTeacherWeeklyVariance penalizes uneven weekly loads", () => {
    const state = initializeState(DEFAULT_DATA);
    state.teacherDailyLoad["t1"] = { 0: 4, 1: 0, 2: 0, 3: 0, 4: 0 };

    const uneven = calculateTeacherWeeklyVariance(state, "t1", 0, 5);
    state.teacherDailyLoad["t1"] = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };
    const even = calculateTeacherWeeklyVariance(state, "t1", 0, 5);

    expect(uneven).toBeLessThan(even);
  });
});
