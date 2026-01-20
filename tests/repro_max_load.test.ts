import { describe, it, expect } from "vitest";
import { checkSlotValidity } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData } from "../src/types";

describe("Repro: Max Daily Load Hardcoded Limit", () => {
  const mockData: AppData = {
    settings: {
      periodsPerDay: 8,
      dayStructure: [],
      timeSlots: [],
      maxConsecutivePeriods: 8, // Allow full day
      fixedOccasions: [],
      maxTeacherPeriodsPerDay: 8, // ADDED: Allow full load for this test
    },
    classes: [
      { id: "c1", name: "Class 1", periodCount: 8, structure: [] } as any,
    ],
    teachers: [{ id: "t1", name: "Teacher 1", constraints: [] }] as any,
    subjects: [
        { id: "s1", name: "S1" },
        { id: "s2", name: "S2" },
        { id: "s3", name: "S3" },
        { id: "s4", name: "S4" },
        { id: "s5", name: "S5" },
        { id: "s6", name: "S6" },
        { id: "s7", name: "S7" },
        { id: "s8", name: "S8" },
    ] as any,
    rooms: [],
    schedule: {
      c1: {
        0: {
          // 7 Periods occupied with DIFFERENT subjects
          0: { subjectId: "s1", teacherId: "t1", duration: 1 },
          1: { subjectId: "s2", teacherId: "t1", duration: 1 },
          2: { subjectId: "s3", teacherId: "t1", duration: 1 },
          3: { subjectId: "s4", teacherId: "t1", duration: 1 },
          4: { subjectId: "s5", teacherId: "t1", duration: 1 },
          5: { subjectId: "s6", teacherId: "t1", duration: 1 },
          6: { subjectId: "s7", teacherId: "t1", duration: 1 },
          // 7 is empty
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

  it("should pass moving P0 to P7 if max load is dynamic", () => {
    const state = initializeState(mockData);
    const result = checkSlotValidity(
      mockData,
      0, // Target Day
      7, // Target Period (P7)
      "t1", // Teacher
      "c1", // Class
      "s1", // Subject
      state,
      { day: 0, period: 0 }, // Ignore Slot (Source P0)
      undefined, // Room
      1 // Duration
    );

    if (!result.valid) {
        console.log("Validation Failed:", result.message);
    }

    // We expect this to PASS now
    expect(result.valid).toBe(true); 
  });
});
