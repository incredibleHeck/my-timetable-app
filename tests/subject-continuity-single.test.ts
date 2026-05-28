import { describe, it, expect } from "vitest";
import { checkSlotValidity } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData, Teacher, ClassGroup, Subject } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("Subject Continuity Repro - Single Periods", () => {
  const mockTeacher: Teacher = {
    id: "t1",
    name: "John Doe",
    specialtyIds: ["s1"],
    constraints: Array(5)
      .fill(null)
      .map(() => Array(10).fill(false)),
  };

  const mockClass: ClassGroup = {
    id: "c1",
    name: "10A",
    curriculum: [],
    periodCount: 10,
  };

  const mockSubject: Subject = {
    id: "s1",
    name: "Humanities",
    color: "#ff0000",
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: "CLASS", label: "C" }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      c1: {
        0: {
          // Monday
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" }, // Single Humanities at P0
        },
      },
    },
  };

  it("should NOT flag a stand-alone single period as having a continuity gap", () => {
    const state = initializeState(baseData);
    // Audit P0
    const result = checkSlotValidity(
      baseData,
      0, // day
      0, // period
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 }, // ignore source
      undefined,
      1, // duration 1
      undefined,
      true, // isAuto
    );

    expect(result.valid).toBe(true);
    if (!result.valid) {
      console.log("Error Message:", result.message);
    }
  });

  it("should flag two split single periods as having a gap", () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s1", teacherId: "t1", classId: "c1" },
          },
        },
      },
    };
    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 },
      undefined,
      1,
      undefined,
      true,
    );

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/split by|sandwiched by/i);
    expect(result.message).toContain("at P2"); // Period 1 is index 1, P2 label
  });

  it("should NOT flag two adjacent single periods as having a gap", () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            1: { subjectId: "s1", teacherId: "t1", classId: "c1" },
          },
        },
      },
    };
    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 },
      undefined,
      1,
      undefined,
      true,
    );

    expect(result.valid).toBe(true);
  });

  it("should NOT flag a single period that is part of a Joint Class correctly", () => {
    const data: AppData = {
      ...baseData,
      jointClasses: [{ id: "jc1", subjectId: "s1", classIds: ["c1", "c2"], teacherId: "t1" }],
      schedule: {
        c1: { 0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } } },
        c2: { 0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c2" } } },
      },
    };
    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 },
      undefined,
      1,
      undefined,
      true,
    );

    expect(result.valid).toBe(true);
  });

  it("should NOT flag a double period split by a BREAK as having a gap", () => {
    const data: AppData = {
      ...baseData,
      settings: {
        ...baseData.settings,
        dayStructure: [
          { type: "CLASS", label: "P1" },
          { type: "BREAK", label: "B1" },
          { type: "CLASS", label: "P2" },
        ],
      },
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s1", teacherId: "t1", classId: "c1", isFixed: true },
          },
        },
      },
    };
    const state = initializeState(data);
    // Audit P0 (Head of double)
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 2 },
      undefined,
      2,
      undefined,
      true,
    );

    expect(result.valid).toBe(true);
  });

  it("should NOT flag two different subjects with the same name as a gap", () => {
    const data: AppData = {
      ...baseData,
      subjects: [
        { id: "s1", name: "Humanities", color: "#ff0000" },
        { id: "s2", name: "Humanities", color: "#00ff00" },
      ],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s2", teacherId: "t1", classId: "c1" },
          },
        },
      },
    };
    const state = initializeState(data);
    // Audit P0 (Humanities s1)
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 },
      undefined,
      1,
      undefined,
      true,
    );

    expect(result.valid).toBe(true); // Should be valid because they are different IDs
  });

  it("should flag same subject split across different teachers as a gap", () => {
    const data: AppData = {
      ...baseData,
      teachers: [
        ...baseData.teachers,
        { id: "t2", name: "Other Teacher", specialtyIds: ["s1"], constraints: [] },
      ],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
            2: { subjectId: "s1", teacherId: "t2", classId: "c1" },
          },
        },
      },
    };
    const state = initializeState(data);
    // Audit P0 (Humanities t1)
    const result = checkSlotValidity(
      data,
      0,
      0,
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 },
      undefined,
      1,
      undefined,
      true,
    );

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/split by|sandwiched by/i);
  });

  it("should NOT flag a single period move as a gap if the source is ignored correctly", () => {
    // Scenario: Humanities at P0. Move to P1.
    // Audit P1. ignoreSlot = P0.
    const data: AppData = {
      ...baseData,
      schedule: {
        c1: { 0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } } },
      },
    };
    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // targetDay
      1, // targetPeriod (P1)
      "t1",
      "c1",
      "s1",
      state,
      { day: 0, period: 0, duration: 1 }, // ignore source P0
      undefined,
      1, // duration 1
      undefined,
      true, // isAuto
    );

    expect(result.valid).toBe(true);
  });
});
