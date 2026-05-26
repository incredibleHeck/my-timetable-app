import { describe, it, expect } from "vitest";
import { checkSlotValidity } from "../src/features/generator/scheduler/validation";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { AppData } from "../src/types";

describe("Reproduction: Same-Day Double Swap False Positive", () => {
  const mockData: AppData = {
    settings: {
      periodsPerDay: 8,
      dayStructure: Array(8).fill({ type: 'CLASS', label: 'C' }),
      timeSlots: [],
      maxConsecutivePeriods: 4,
      fixedOccasions: [],
    },
    classes: [
      { id: "c1", name: "Class 1", periodCount: 8, structure: Array(8).fill({ type: 'CLASS', label: 'C' }), curriculum: [] } as any,
    ],
    teachers: [{ id: "t1", name: "Teacher 1", constraints: [] }] as any,
    subjects: [
      { id: "s1", name: "English", isSingleResource: false } as any,
      { id: "s2", name: "Math", isSingleResource: false } as any,
    ],
    rooms: [],
    schedule: {
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", duration: 2, isFixed: false }, // English Part 1
          1: { subjectId: "s1", teacherId: "t1", duration: 2, isFixed: true },  // English Part 2
          2: { subjectId: "s2", teacherId: "t1", duration: 2, isFixed: false }, // Math Part 1
          3: { subjectId: "s2", teacherId: "t1", duration: 2, isFixed: true },  // Math Part 2
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

  it("should allow moving English (P0,1) to Math (P2,3)", () => {
    const state = initializeState(mockData);
    const result = checkSlotValidity(
      mockData,
      0, // Target Day
      2, // Target Period (P2)
      "t1", // Teacher
      "c1", // Class
      "s1", // Subject (English)
      state,
      { day: 0, period: 0, duration: 2 }, // Source (P0)
      undefined,
      2 // Duration
    );

    expect(result.valid).toBe(true);
  });

  it("should allow moving Math (P2,3) to English (P0,1) - The Swap Back", () => {
    const state = initializeState(mockData);
    const result = checkSlotValidity(
      mockData,
      0, 0, "t1", "c1", "s2",
      state,
      { day: 0, period: 2, duration: 2 }, // Source (P2)
      undefined,
      2,
      { day: 0, period: 0, duration: 2 } // Ignore Target (English)
    );

    expect(result.valid).toBe(true);
  });

  it("should NOT trigger consecutive period error when swapping same-day with maxConsecutive=2", () => {
    const dataWithTightConstraint: AppData = {
      ...mockData,
      settings: {
        ...mockData.settings,
        maxConsecutivePeriods: 2,
      },
    };

    const state = initializeState(dataWithTightConstraint);
    const result = checkSlotValidity(
      dataWithTightConstraint,
      0, 2, "t1", "c1", "s1",
      state,
      { day: 0, period: 0, duration: 2 },
      undefined,
      2
    );

    if (!result.valid) {
        console.log("Consecutive check failed:", result.message);
    }
    expect(result.valid).toBe(true);
  });

  it("should fail if there is a 3rd English period (Verification of test)", () => {
    // Add a 3rd English period at P4
    mockData.schedule.c1[0][4] = { subjectId: "s1", teacherId: "t1", duration: 1, isFixed: false };
    
    const state = initializeState(mockData);
    const result = checkSlotValidity(
      mockData,
      0, 2, "t1", "c1", "s1",
      state,
      { day: 0, period: 0, duration: 2 },
      undefined,
      2,
      { day: 0, period: 2, duration: 2 },
      true // isAuto
    );

    // Should detect 2 (Proposed) + 1 (Existing at P4) = 3.
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Max 2 periods");
    
    // Cleanup
    delete mockData.schedule.c1[0][4];
  });
});
