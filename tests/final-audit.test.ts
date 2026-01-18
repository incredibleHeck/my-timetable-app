import { describe, it, expect } from "vitest";
import { generateFinalReport } from "../src/features/generator/scheduler/validation/final-audit";
import { AppData, ScheduleResult } from "../src/types";

describe("generateFinalReport", () => {
  const mockSettings = {
    periodsPerDay: 5,
    dayStructure: Array(5).fill({ type: "CLASS", label: "Period" }),
    fixedOccasions: [],
    timeSlots: [],
    maxConsecutivePeriods: 2,
  };

  const createMockData = (schedule: ScheduleResult): AppData => ({
    settings: mockSettings,
    subjects: [
      { id: "s1", name: "Math", color: "blue", type: "CORE" },
      { id: "s2", name: "Science", color: "green", type: "CORE" }
    ],
    teachers: [
      { id: "t1", name: "Mr. Smith", subjects: ["s1"], constraints: {} },
      { id: "t2", name: "Ms. Jones", subjects: ["s2"], constraints: {} }
    ],
    rooms: [
      { id: "r1", name: "Room 101", capacity: 30 },
      { id: "r2", name: "Lab 1", capacity: 20 }
    ],
    classes: [
        { id: "c1", name: "Class 1A", periodCount: 5, subjects: [], curriculum: [] },
        { id: "c2", name: "Class 1B", periodCount: 5, subjects: [], curriculum: [] }
    ],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    dutyAssignments: [],
    schedule: schedule,
    conflicts: [],
    lastGenerated: null,
    recentActivity: []
  });

  it("should detect teacher double bookings", () => {
    // Teacher t1 is assigned to c1 and c2 at the same time (Day 0, Period 0)
    const schedule: ScheduleResult = {
      "c1": {
        0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } }
      },
      "c2": {
        0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c2" } }
      }
    };

    const data = createMockData(schedule);
    const conflicts = generateFinalReport(data);

    expect(conflicts).toHaveLength(2); // Should report for both classes involved
    expect(conflicts.find(c => c.classId === "c1")).toBeDefined();
    expect(conflicts.find(c => c.classId === "c2")).toBeDefined();
    expect(conflicts[0].reason).toContain("Double Booking: Teacher");
  });

  it("should detect room double bookings", () => {
    // Room r1 is assigned to c1 and c2 at the same time (Day 0, Period 1)
    const schedule: ScheduleResult = {
      "c1": {
        0: { 1: { subjectId: "s1", teacherId: "t1", classId: "c1", roomId: "r1" } }
      },
      "c2": {
        0: { 1: { subjectId: "s2", teacherId: "t2", classId: "c2", roomId: "r1" } }
      }
    };

    const data = createMockData(schedule);
    const conflicts = generateFinalReport(data);

    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].reason).toContain("Double Booking: Room");
  });

  it("should ignore double bookings for different periods", () => {
    const schedule: ScheduleResult = {
      "c1": {
        0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } }
      },
      "c2": {
        0: { 1: { subjectId: "s1", teacherId: "t1", classId: "c2" } }
      }
    };

    const data = createMockData(schedule);
    const conflicts = generateFinalReport(data);

    expect(conflicts).toHaveLength(0);
  });

  it("should detect class gaps", () => {
    // Class c1 has Period 0 and Period 2 occupied, but Period 1 is empty (and is a CLASS period)
    const schedule: ScheduleResult = {
      "c1": {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
          2: { subjectId: "s1", teacherId: "t1", classId: "c1" }
        }
      }
    };
    // Mock period 1 as CLASS type
    const data = createMockData(schedule);
    const conflicts = generateFinalReport(data);

    // This creates both a Class Gap AND a Subject Continuity error (s1 split by gap)
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some(c => c.reason.includes("Class Gap"))).toBe(true);
  });

  it("should detect subject continuity issues", () => {
    // Class c1 has Math at P0, Science at P1, Math at P2 (Sandwich)
    const schedule: ScheduleResult = {
      "c1": {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" }, // Math
          1: { subjectId: "s2", teacherId: "t2", classId: "c1" }, // Science
          2: { subjectId: "s1", teacherId: "t1", classId: "c1" }  // Math
        }
      }
    };
    const data = createMockData(schedule);
    const conflicts = generateFinalReport(data);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toContain("Subject Continuity");
  });
});