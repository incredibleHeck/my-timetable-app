import { describe, it, expect } from "vitest";
import { auditFinalSchedule } from "../src/features/generator/scheduler/validation";
import { collectResourceDoubleBookings } from "../src/features/generator/scheduler/validation/final-conflicts";
import { AppData, ScheduleResult } from "../src/types";

describe("manual placement audit", () => {
  const baseSettings = {
    periodsPerDay: 5,
    dayStructure: Array(5).fill({ type: "CLASS", label: "P" }),
    fixedOccasions: [[], [], [], [], []],
    timeSlots: [],
    maxConsecutivePeriods: 5,
    schoolStartTime: "08:00",
    defaultClassDuration: 40,
    defaultBreakDuration: 15,
    defaultLunchDuration: 45,
  };

  const sharedHomeroomId = "homeroom-shared";

  function buildData(schedule: ScheduleResult): AppData {
    return {
      settings: baseSettings,
      subjects: [
        { id: "s1", name: "Math", color: "blue", type: "CORE" },
        { id: "s2", name: "English", color: "green", type: "CORE" },
      ],
      teachers: [
        {
          id: "t1",
          name: "Mr Smith",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(5).fill(false)),
        },
        {
          id: "t2",
          name: "Ms Jones",
          specialtyIds: ["s2"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(5).fill(false)),
        },
      ],
      rooms: [
        {
          id: sharedHomeroomId,
          name: "Shared Homeroom",
          capacity: 30,
          isHomeRoom: true,
        },
        { id: "lab1", name: "Science Lab", capacity: 24 },
      ],
      classes: [
        {
          id: "c1",
          name: "Class 1A",
          periodCount: 5,
          subjects: [],
          curriculum: [],
          defaultRoomId: sharedHomeroomId,
        },
        {
          id: "c2",
          name: "Class 1B",
          periodCount: 5,
          subjects: [],
          curriculum: [],
          defaultRoomId: sharedHomeroomId,
        },
      ],
      jointClasses: [],
      electives: [],
      exams: [],
      dutyLocations: [],
      dutyAssignments: [],
      schedule,
      conflicts: [],
      lastGenerated: null,
      recentActivity: [],
    };
  }

  it("does not flag homeroom/defaultRoomId overlap for unrelated classes at the same period", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } },
      },
      c2: {
        0: { 0: { subjectId: "s2", teacherId: "t2", classId: "c2" } },
      },
    };

    const conflicts = collectResourceDoubleBookings(buildData(schedule));
    const roomConflicts = conflicts.filter((c) =>
      c.reason.toLowerCase().includes("room"),
    );

    expect(roomConflicts).toHaveLength(0);
  });

  it("does not create false room collisions after manual-style placement with homeroom roomId", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            unitId: "MANUAL-c1-0-0-a",
          },
        },
      },
      c2: {
        0: { 1: { subjectId: "s2", teacherId: "t2", classId: "c2" } },
      },
    };

    const conflicts = auditFinalSchedule(buildData(schedule), {
      mode: "generated",
    });

    expect(
      conflicts.filter((c) => c.reason.toLowerCase().includes("double booking")),
    ).toHaveLength(0);
  });

  it("still flags real specialist room double bookings", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: {
            subjectId: "s1",
            teacherId: "t1",
            classId: "c1",
            roomId: "lab1",
          },
        },
      },
      c2: {
        0: {
          0: {
            subjectId: "s2",
            teacherId: "t2",
            classId: "c2",
            roomId: "lab1",
          },
        },
      },
    };

    const conflicts = collectResourceDoubleBookings(buildData(schedule));
    expect(conflicts.some((c) => c.reason.includes("Double Booking: Room"))).toBe(
      true,
    );
  });
});
