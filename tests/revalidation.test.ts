import { describe, it, expect, vi } from "vitest";
import { validateFullSchedule } from "../src/features/generator/scheduler/validation/index";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData, Class, Subject, Teacher } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("Global Re-validation", () => {
  const mockTeacher: Teacher = {
    id: "t1",
    name: "T1",
    specialtyIds: [],
    constraints: [],
  } as any;

  const mockClass: Class = {
    id: "c1",
    name: "10A",
    curriculum: [],
  };

  const mockSubject: Subject = {
    id: "s1",
    name: "Math",
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
          1: { subjectId: "s1", teacherId: "t1", classId: "c1" },
        },
      },
    },
  };

  it("should find no conflicts when limit is 2", () => {
    const data = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxSubjectPeriodsPerDay: 2,
      },
    };
    const state = initializeState(data);
    const conflicts = validateFullSchedule(data, state);
    expect(conflicts).toHaveLength(0);
  });

  it("should find conflicts when limit is reduced to 1", () => {
    const data = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxSubjectPeriodsPerDay: 1,
      },
    };
    const state = initializeState(data);
    const conflicts = validateFullSchedule(data, state);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].reason).toContain("Max 1 periods");
  });
});
