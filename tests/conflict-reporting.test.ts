import { describe, it, expect, vi } from "vitest";
import { generateSchedule } from "../src/features/generator/scheduler/generator";
import { AppData } from "../src/types";

// Mock solveSmart to return a predictable schedule
vi.mock("../src/features/generator/scheduler/solver", () => ({
  solveSmart: vi.fn(() => ({
    schedule: {
      "c1": {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1" }
        }
      },
      "c2": {
        0: {
          0: { subjectId: "s2", teacherId: "t1", classId: "c2" } // Same teacher t1 at P0
        }
      }
    },
    conflicts: [], // No unplaced lessons
    state: {
       // Mock minimal state structure expected by runConflictAudit if it uses it
       classOccupancy: {},
       teacherOccupancy: {},
       roomOccupancy: {},
       singleResourceUsage: {},
       teacherDailyLoad: {},
       classDailySubjects: {},
       classSubjectDuration: {},
       unitPlacements: new Map(),
       classTimeRanges: new Map(),
       lessonNavigation: new Map(),
       schedule: { // State also has schedule usually
            "c1": {
                0: {
                0: { subjectId: "s1", teacherId: "t1", classId: "c1" }
                }
            },
            "c2": {
                0: {
                0: { subjectId: "s2", teacherId: "t1", classId: "c2" }
                }
            }
       }
    },
    iterations: 1
  }))
}));

// Mock audit to return empty legacy stuff
vi.mock("../src/features/generator/scheduler/audit", () => ({
  runConflictAudit: vi.fn(() => ({
    conflicts: [],
    curriculumGaps: [],
    statistics: {}
  }))
}));

// Mock preparation to avoid processing units
vi.mock("../src/features/generator/scheduler/preparation", () => ({
  prepareAllocationUnits: vi.fn(() => [])
}));

describe("generateSchedule Integration", () => {
  const mockSettings = {
    periodsPerDay: 5,
    dayStructure: Array(5).fill({ type: "CLASS", label: "Period" }),
    fixedOccasions: [],
    timeSlots: [],
    maxConsecutivePeriods: 2,
  };

  const mockData: AppData = {
    settings: mockSettings,
    subjects: [
      { id: "s1", name: "Math", color: "blue", type: "CORE" },
      { id: "s2", name: "Science", color: "green", type: "CORE" }
    ],
    teachers: [
      { id: "t1", name: "Mr. Smith", subjects: ["s1", "s2"], constraints: {} }
    ],
    rooms: [],
    classes: [
        { id: "c1", name: "Class 1A", periodCount: 5, subjects: [], curriculum: [] },
        { id: "c2", name: "Class 1B", periodCount: 5, subjects: [], curriculum: [] }
    ],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    dutyAssignments: [],
    schedule: {},
    conflicts: [],
    lastGenerated: null,
    recentActivity: []
  };

  it("should integrate generateFinalReport and detect conflicts in the generated schedule", () => {
    const result = generateSchedule(mockData);

    // Expected:
    // 1. solveSmart returns a schedule with a Teacher Double Booking (t1 at 0-0 for c1 and c2).
    // 2. generateSchedule calls generateFinalReport.
    // 3. generateFinalReport detects the double booking.
    // 4. result.conflicts contains the reported conflict.

    expect(result.conflicts.length).toBeGreaterThan(0);
    const hasDoubleBooking = result.conflicts.some(c => c.reason.includes("Double Booking: Teacher"));
    expect(hasDoubleBooking).toBe(true);
  });
});
