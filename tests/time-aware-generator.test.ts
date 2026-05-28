import { describe, it, expect } from "vitest";
import { solveSmart } from "../src/features/generator/scheduler/solver/solver";
import { AppData, Teacher, Class, Subject } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("Time-Aware Generator", () => {
  const mockTeacher: Teacher = {
    id: "t1",
    name: "John Doe",
    specialtyIds: ["s1", "s2"],
    constraints: Array(5)
      .fill(null)
      .map(() => Array(10).fill(false)),
  };

  const classA: Class = {
    id: "cA",
    name: "Class A",
    curriculum: [
      {
        id: "curr1",
        subjectId: "s1",
        periodsPerWeek: 1,
        singles: 1,
        doubles: 0,
        assignedTeacherId: "t1",
      },
    ],
    duration: 40, // 08:00 - 08:40, 08:40 - 09:20
    defaultRoomId: "r1",
  };

  const classB: Class = {
    id: "cB",
    name: "Class B",
    curriculum: [
      {
        id: "curr2",
        subjectId: "s2",
        periodsPerWeek: 1,
        singles: 1,
        doubles: 0,
        assignedTeacherId: "t1",
      },
    ],
    duration: 60, // 08:00 - 09:00, 09:00 - 10:00
    defaultRoomId: "r1",
  };

  const subjects: Subject[] = [
    { id: "s1", name: "Math", color: "#ff0000" },
    { id: "s2", name: "English", color: "#00ff00" },
  ];

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 8,
      schoolStartTime: "08:00",
      dayStructure: Array(8)
        .fill(null)
        .map(() => ({ type: "CLASS", label: "C" })),
      fixedOccasions: Array(5)
        .fill(null)
        .map(() => Array(8).fill("")),
    },
    teachers: [mockTeacher],
    classes: [classA, classB],
    subjects: subjects,
    rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "Classroom" }],
  };

  it("should avoid teacher overlap when classes have different durations", () => {
    const units = [
      {
        id: "u1",
        subjectId: "s1",
        subjectName: "Math",
        duration: 1,
        classIds: ["cA"],
        classNames: ["Class A"],
        teacherIds: ["t1"],
        teacherNames: ["John"],
        priority: 10,
        rankLevel: 10,
      },
      {
        id: "u2",
        subjectId: "s2",
        subjectName: "English",
        duration: 1,
        classIds: ["cB"],
        classNames: ["Class B"],
        teacherIds: ["t1"],
        teacherNames: ["John"],
        priority: 5,
        rankLevel: 10,
      },
    ];

    const result = solveSmart(units as any, baseData);

    let slotA = -1;
    let dayA = -1;
    let slotB = -1;
    let dayB = -1;

    for (let d = 0; d < 5; d++) {
      const schedA = result.schedule["cA"]?.[d] || {};
      for (const p in schedA)
        if (schedA[p].subjectId === "s1") {
          slotA = parseInt(p);
          dayA = d;
        }

      const schedB = result.schedule["cB"]?.[d] || {};
      for (const p in schedB)
        if (schedB[p].subjectId === "s2") {
          slotB = parseInt(p);
          dayB = d;
        }
    }

    expect(slotA).not.toBe(-1);
    expect(slotB).not.toBe(-1);

    // If on the same day, verify no overlap
    if (dayA === dayB) {
      // Class A Slot Time Range:
      const startA = 8 * 60 + slotA * 40;
      const endA = startA + 40;

      // Class B Slot Time Range:
      const startB = 8 * 60 + slotB * 60;
      const endB = startB + 60;

      const overlap = startA < endB && startB < endA;
      expect(overlap).toBe(false);
    }
  });
});
