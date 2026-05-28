import { describe, it, expect } from "vitest";
import { generateSchedule } from "../src/features/generator/scheduler/core/generator";
import { validateFullSchedule } from "../src/features/generator/scheduler/validation/index";
import { initializeState } from "../src/features/generator/scheduler/core/state";

describe("Generator - Class Structure Fixed Slots", () => {
  const mockSettings: Settings = {
    periodsPerDay: 8,
    dayStructure: [
      { type: "CLASS", label: "P1" },
      { type: "CLASS", label: "P2" },
      { type: "CLASS", label: "P3" },
      { type: "CLASS", label: "P4" },
      { type: "CLASS", label: "P5" },
      { type: "CLASS", label: "P6" },
      { type: "CLASS", label: "P7" },
      { type: "CLASS", label: "P8" },
    ],
    fixedOccasions: [[], [], [], [], []],
    timeSlots: Array(8).fill({ start: "08:00", end: "08:40" }),
    maxConsecutivePeriods: 8,
    schoolStartTime: "08:00",
    defaultClassDuration: 40,
    defaultBreakDuration: 20,
    defaultLunchDuration: 60,
    maxTeacherPeriodsPerDay: 8,
    maxSubjectPeriodsPerDay: 8,
  };

  const mockData: AppData = {
    settings: mockSettings,
    classes: [
      {
        id: "class-1",
        name: "Class 1",
        periodCount: 8,
        curriculum: [{ subjectId: "math", singles: 5, doubles: 0, assignedTeacherId: "t1" }],
        // Class structure overrides: P0 is BREAK, P1 is LUNCH
        structure: [
          { type: "BREAK", label: "B1" },
          { type: "LUNCH", label: "L1" },
          { type: "CLASS", label: "C1" },
          { type: "CLASS", label: "C2" },
          { type: "CLASS", label: "C3" },
          { type: "CLASS", label: "C4" },
          { type: "CLASS", label: "C5" },
          { type: "CLASS", label: "C6" },
        ],
        fixedSessions: {},
        defaultRoomId: "room-1",
      },
    ],
    teachers: [{ id: "t1", name: "Teacher 1", constraints: [] }],
    subjects: [{ id: "math", name: "Math" }],
    rooms: [{ id: "room-1", name: "Room 1", capacity: 30, type: "Standard" }],
    schedule: {},
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    conflicts: [],
    lastGenerated: null,
    recentActivity: [],
  };

  it("should NOT schedule classes during class-specific break and lunch times", () => {
    const { schedule, conflicts } = generateSchedule(mockData);

    // Check Class 1, Day 0
    const day0 = schedule["class-1"]?.[0] || {};

    // Period 0 and 1 are BREAK/LUNCH in the class override.
    // They should be empty in the schedule.
    const p0 = day0[0];
    const p1 = day0[1];

    expect(p0, "Period 0 should be empty (BREAK override)").toBeUndefined();
    expect(p1, "Period 1 should be empty (LUNCH override)").toBeUndefined();

    // Ensure math was actually scheduled somewhere else
    const mathSlots = Object.values(day0).filter((s) => s.subjectId === "math");
    expect(mathSlots.length).toBeGreaterThan(0);
  });

  it("should enforce total curriculum subject limits", () => {
    // Create data where math is over-scheduled manually to see if validator catches it
    const dataWithOverload: AppData = {
      ...mockData,
      schedule: {
        "class-1": {
          0: {
            2: {
              unitId: "u1",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            },
            3: {
              unitId: "u2",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            },
            4: {
              unitId: "u3",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            },
            5: {
              unitId: "u4",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            },
            6: {
              unitId: "u5",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            },
            7: {
              unitId: "u6",
              subjectId: "math",
              teacherId: "t1",
              classId: "class-1",
              roomId: "room-1",
              isFixed: false,
            }, // 6th period, but limit is 5
          },
        },
      },
    };

    const state = initializeState(dataWithOverload);
    const conflicts = validateFullSchedule(dataWithOverload, state);

    const overloadConflict = conflicts.find((c: any) =>
      c.reason.includes("Curriculum Over-Allocation"),
    );
    expect(overloadConflict).toBeDefined();
  });
});
