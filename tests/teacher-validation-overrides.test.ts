import { describe, it, expect } from "vitest";
import { checkTeacherLoad } from "../src/features/generator/scheduler/validation/load-checks";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData, Teacher, Class, Subject } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";
import { ValidationContext } from "../src/features/generator/scheduler/validation/types";

function runDailyLoadCheck(data: AppData, proposedPeriod: number, state = initializeState(data)) {
  const structure = Array(10).fill({ type: "CLASS" as const, label: "C" });
  const ctx: ValidationContext = {
    data,
    targetDay: 0,
    targetPeriod: proposedPeriod,
    teacherId: "t1",
    classId: "c1",
    subjectId: "s1",
    duration: 1,
    maxPeriods: 10,
    structure,
    classSchedule: [],
    allClassSchedules: new Map(),
    ignoredSlots: new Set(),
  };
  return checkTeacherLoad(ctx, new Set([proposedPeriod]), new Set(), state);
}

describe("Teacher Daily Limit Overrides", () => {
  const mockTeacher: Teacher = {
    id: "t1",
    name: "John Doe",
    specialtyIds: ["s1"],
    constraints: Array(5)
      .fill(null)
      .map(() => Array(10).fill(false)),
  };

  const mockClass: Class = {
    id: "c1",
    name: "10A",
    curriculum: [],
    studentCount: 30,
    periodCount: 10,
    structure: Array(10).fill({ type: "CLASS", label: "C" }),
    defaultRoomId: "r1",
  };

  const mockSubject: Subject = {
    id: "s1",
    name: "Math",
    color: "#ff0000",
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      maxTeacherPeriodsPerDay: 6,
      maxConsecutivePeriods: 10,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: "CLASS", label: "C" }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [
      mockSubject,
      { id: "s2", name: "S2", color: "#00ff00" },
      { id: "s3", name: "S3", color: "#0000ff" },
      { id: "s4", name: "S4", color: "#ffff00" },
      { id: "s5", name: "S5", color: "#ff00ff" },
    ],
    schedule: {
      c1: {
        0: {
          2: { subjectId: "s2", teacherId: "t1", classId: "c1" },
          3: { subjectId: "s3", teacherId: "t1", classId: "c1" },
          4: { subjectId: "s4", teacherId: "t1", classId: "c1" },
          5: { subjectId: "s5", teacherId: "t1", classId: "c1" },
        },
      },
    },
    recentActivity: [],
  };

  it("should respect a STRICTER teacher-specific limit (e.g. 4 vs global 6)", () => {
    const data: AppData = {
      ...baseData,
      teachers: [{ ...mockTeacher, maxPeriodsPerDay: 4 }],
    };

    const result = runDailyLoadCheck(data, 0);

    expect(result).not.toBeNull();
    expect(result?.message).toContain("Exceeds daily limit");
  });

  it("should respect a MORE LENIENT teacher-specific limit (e.g. 8 vs global 6)", () => {
    const busyData: AppData = {
      ...baseData,
      subjects: [
        ...baseData.subjects,
        { id: "s6", name: "S6", color: "#888888" },
        { id: "s7", name: "S7", color: "#777777" },
      ],
      teachers: [{ ...mockTeacher, maxPeriodsPerDay: 8 }],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            1: { subjectId: "s2", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s3", teacherId: "t1", classId: "c1" },
            3: { subjectId: "s4", teacherId: "t1", classId: "c1" },
            4: { subjectId: "s5", teacherId: "t1", classId: "c1" },
            5: { subjectId: "s6", teacherId: "t1", classId: "c1" },
          },
        },
      },
    };

    const result = runDailyLoadCheck(busyData, 6);

    expect(result).toBeNull();
  });

  it("should fall back to global limit if teacher limit is undefined", () => {
    const busyData: AppData = {
      ...baseData,
      subjects: [
        ...baseData.subjects,
        { id: "s6", name: "S6", color: "#888888" },
        { id: "s7", name: "S7", color: "#777777" },
      ],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            1: { subjectId: "s2", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s3", teacherId: "t1", classId: "c1" },
            3: { subjectId: "s4", teacherId: "t1", classId: "c1" },
            4: { subjectId: "s5", teacherId: "t1", classId: "c1" },
            5: { subjectId: "s6", teacherId: "t1", classId: "c1" },
          },
        },
      },
    };

    const result = runDailyLoadCheck(busyData, 6);

    expect(result).not.toBeNull();
    expect(result?.message).toContain("Exceeds daily limit");
  });
});
