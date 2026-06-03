import { describe, it, expect, vi, afterEach } from "vitest";
import {
  countScheduledForSubject,
  detectCurriculumGaps,
} from "../src/features/generator/scheduler/validation/final-conflicts";
import { auditFinalSchedule } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ScheduleResult } from "../src/types";

describe("detectCurriculumGaps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseSettings = {
    ...DEFAULT_DATA.settings,
    periodsPerDay: 6,
    dayStructure: [
      { type: "CLASS" as const, label: "P1" },
      { type: "BREAK" as const, label: "Break" },
      { type: "CLASS" as const, label: "P2" },
      { type: "CLASS" as const, label: "P3" },
      { type: "CLASS" as const, label: "P4" },
      { type: "CLASS" as const, label: "P5" },
    ],
  };

  function buildData(
    schedule: ScheduleResult,
    curriculum: AppData["classes"][0]["curriculum"],
  ): AppData {
    return {
      ...DEFAULT_DATA,
      settings: baseSettings,
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          curriculum,
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
      schedule,
    };
  }

  it("reports no gaps when the grid satisfies singles and doubles", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u1",
            duration: 2,
            isFixed: false,
          },
          2: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u1",
            duration: 2,
            isFixed: true,
          },
          3: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u2",
            duration: 1,
            isFixed: false,
          },
        },
      },
    };

    const data = buildData(schedule, [
      { id: "cur1", subjectId: "s1", singles: 1, doubles: 1, periodsPerWeek: 3 },
    ]);

    expect(countScheduledForSubject(data, "c1", "s1")).toBe(3);
    expect(detectCurriculumGaps(data)).toHaveLength(0);
  });

  it("counts double periods across a break using duration and bridge navigation", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "double-1",
            duration: 2,
            isFixed: false,
          },
          2: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "double-1",
            duration: 2,
            isFixed: true,
          },
        },
      },
    };

    const data = buildData(schedule, [
      { id: "cur1", subjectId: "s1", singles: 0, doubles: 1, periodsPerWeek: 2 },
    ]);

    expect(countScheduledForSubject(data, "c1", "s1")).toBe(2);
    expect(detectCurriculumGaps(data)).toHaveLength(0);
  });

  it("uses periodsPerWeek when singles and doubles are unset", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            duration: 1,
          },
          3: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            duration: 1,
          },
        },
      },
    };

    const data = buildData(schedule, [
      { id: "cur1", subjectId: "s1", singles: 0, doubles: 0, periodsPerWeek: 2 },
    ]);

    expect(detectCurriculumGaps(data)).toHaveLength(0);
  });

  it("does not log diagnostic output when a gap is detected", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const data = buildData({}, [
      { id: "cur1", subjectId: "s1", singles: 2, doubles: 0, periodsPerWeek: 2 },
    ]);

    const gaps = detectCurriculumGaps(data);
    expect(gaps).toHaveLength(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("aligns auditFinalSchedule with a complete solver-style grid", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u1",
            duration: 2,
            isFixed: false,
          },
          2: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u1",
            duration: 2,
            isFixed: true,
          },
        },
        1: {
          3: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "u2",
            duration: 1,
            isFixed: false,
          },
        },
      },
    };

    const data = buildData(schedule, [
      { id: "cur1", subjectId: "s1", singles: 1, doubles: 1, periodsPerWeek: 3 },
    ]);

    const state = initializeState(data);
    const conflicts = auditFinalSchedule(data, { mode: "generated" });

    expect(state.classSubjectDuration.c1?.s1).toBe(3);
    expect(conflicts.filter((c) => c.reason.toLowerCase().includes("curriculum gap"))).toHaveLength(
      0,
    );
  });
});
