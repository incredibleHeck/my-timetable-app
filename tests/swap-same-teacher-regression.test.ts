import { describe, it, expect } from "vitest";
import { checkSlotValidity } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData, ClassGroup, Teacher, Subject } from "../src/types";

describe("Debug Repro: Single Swap Same Teacher", () => {
  const mockData: AppData = {
    settings: {
      periodsPerDay: 8,
      dayStructure: [],
      timeSlots: [],
      maxConsecutivePeriods: 4, 
      fixedOccasions: [],
    },
    classes: [
      { id: "c1", name: "Class 1", periodCount: 8, structure: [] } as any,
    ],
    teachers: [{ id: "t1", name: "Teacher 1", constraints: [] }] as any,
    subjects: [
        { id: "s1", name: "Math", isSingleResource: false } as any,
        { id: "s2", name: "Science", isSingleResource: false } as any,
    ],
    rooms: [],
    schedule: {
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", duration: 1, isFixed: false }, // P0: Math
          1: { subjectId: "s2", teacherId: "t1", duration: 1, isFixed: false }, // P1: Science
        },
      },
    },
    conflicts: [],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    dutyAssignments: [],
    lastGenerated: null,
    recentActivity: [],
  };

  it("should validly move P0 (Math) to P1 (Science) - Swap", () => {
    const state = initializeState(mockData);
    const result = checkSlotValidity(
      mockData,
      0, // Target Day
      1, // Target Period (P1)
      "t1", // Teacher
      "c1", // Class
      "s1", // Subject
      state,
      { day: 0, period: 0 }, // Ignore Slot (Source P0)
      undefined, // Room
      1 // Duration (Single)
    );

    if (!result.valid) {
        console.log("Validation Failed:", result.message);
    }

    expect(result.valid).toBe(true);
  });
});
