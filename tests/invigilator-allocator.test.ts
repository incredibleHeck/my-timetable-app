import { describe, it, expect } from "vitest";
import { allocateInvigilators } from "../src/features/exams/logic/invigilatorAllocator";

const defaultConfig = { minInvigilators: 2, maxInvigilators: 2 };
import { DEFAULT_DATA } from "../src/utils/constants";
import { ExamSession } from "../src/types";

describe("allocateInvigilators", () => {
  const teachers = [
    {
      id: "t1",
      name: "Alice",
      subjects: [],
      constraints: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    },
    {
      id: "t2",
      name: "Bob",
      subjects: [],
      constraints: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    },
    {
      id: "t3",
      name: "Carol",
      subjects: [],
      constraints: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    },
    {
      id: "t4",
      name: "Dan",
      subjects: [],
      constraints: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    },
  ];

  const baseExams: ExamSession[] = [
    {
      id: "e1",
      subjectId: "s1",
      classIds: ["c1", "c2"],
      date: "2026-06-03",
      startTime: "09:00",
      duration: 120,
      paperNumber: 1,
      status: "DRAFT",
    },
  ];

  const data = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      examGrid: {
        sessionsPerDay: 2,
        session1DefaultTime: "09:00",
        session2DefaultTime: "14:00",
        sessionCutoff: "12:00",
      },
      timeSlots: [
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
      ],
    },
    teachers,
    classes: [
      { id: "c1", name: "10A", level: "10", defaultRoomId: "r1", curriculum: [] },
      { id: "c2", name: "10B", level: "10", defaultRoomId: "r1", curriculum: [] },
    ],
    exams: baseExams,
  };

  it("splits multi-class exams into per-class rows", () => {
    const { exams } = allocateInvigilators(data, defaultConfig);

    expect(exams).toHaveLength(2);
    expect(exams.every((e) => e.classIds.length === 1)).toBe(true);
    expect(exams.map((e) => e.classIds[0]).sort()).toEqual(["c1", "c2"]);
    expect(exams.map((e) => e.id).sort()).toEqual(["e1__c1", "e1__c2"]);
  });

  it("assigns two invigilators per stream for the full day", () => {
    const { exams } = allocateInvigilators(data, defaultConfig);

    exams.forEach((e) => {
      expect(e.invigilatorIds?.length).toBe(2);
    });
  });

  it("gives each parallel stream its own pair of invigilators", () => {
    const { exams } = allocateInvigilators(data, defaultConfig);

    const c1Team = exams.find((e) => e.id === "e1__c1")?.invigilatorIds?.sort();
    const c2Team = exams.find((e) => e.id === "e1__c2")?.invigilatorIds?.sort();

    expect(c1Team?.length).toBe(2);
    expect(c2Team?.length).toBe(2);
    expect(c1Team?.join(",")).not.toBe(c2Team?.join(","));
  });

  it("uses the same pair for session 1 and session 2 on the same day", () => {
    const splitData = {
      ...data,
      classes: [{ id: "c1", name: "10A", level: "10", defaultRoomId: "r1", curriculum: [] }],
      exams: [
        {
          id: "e1",
          subjectId: "s1",
          classIds: ["c1"],
          date: "2026-06-03",
          startTime: "09:00",
          duration: 120,
          paperNumber: 1,
          status: "DRAFT" as const,
        },
        {
          id: "e2",
          subjectId: "s2",
          classIds: ["c1"],
          date: "2026-06-03",
          startTime: "14:00",
          duration: 120,
          paperNumber: 1,
          status: "DRAFT" as const,
        },
      ],
    };

    const { exams } = allocateInvigilators(splitData, defaultConfig);

    const session1 = exams.find((e) => e.id === "e1__c1");
    const session2 = exams.find((e) => e.id === "e2__c1");

    expect(session1?.invigilatorIds?.sort()).toEqual(session2?.invigilatorIds?.sort());
    expect(session1?.invigilatorIds?.length).toBe(2);
  });

  it("preserves locked exams without splitting", () => {
    const lockedExam: ExamSession = {
      ...baseExams[0],
      id: "locked1",
      locked: true,
      invigilatorIds: ["t1", "t2"],
    };

    const { exams } = allocateInvigilators({ ...data, exams: [lockedExam] }, defaultConfig);

    expect(exams).toHaveLength(1);
    expect(exams[0].id).toBe("locked1");
    expect(exams[0].classIds).toEqual(["c1", "c2"]);
    expect(exams[0].invigilatorIds).toEqual(["t1", "t2"]);
  });

  it("excludes teachers from allocation", () => {
    const { exams, warnings } = allocateInvigilators(data, {
      ...defaultConfig,
      excludedTeacherIds: ["t1", "t2", "t3", "t4"],
    });

    expect(warnings.length).toBeGreaterThan(0);
    exams.forEach((e) => expect(e.invigilatorIds?.length ?? 0).toBe(0));
  });

  it("warns when understaffed", () => {
    const { warnings } = allocateInvigilators({ ...data, teachers: [teachers[0]] }, defaultConfig);

    expect(warnings.some((w) => w.includes("Under-staffed"))).toBe(true);
  });

  it("does not apply teacher constraints on weekend exam dates", () => {
    const weekendExam: ExamSession = {
      ...baseExams[0],
      id: "we1",
      classIds: ["c1"],
      date: "2026-06-07",
      startTime: "09:00",
    };

    const blockedTeacher = {
      id: "t9",
      name: "Blocked",
      subjects: [],
      constraints: [
        [true, true],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    };

    const { exams, warnings } = allocateInvigilators(
      {
        ...data,
        teachers: [blockedTeacher, ...teachers],
        exams: [weekendExam],
      },
      defaultConfig,
    );

    const assigned = exams.find((e) => e.classIds.includes("c1"));
    expect(assigned?.invigilatorIds?.length).toBeGreaterThan(0);
    expect(warnings.filter((w) => w.includes("No invigilators")).length).toBe(0);
  });

  it("does not assign the same teacher to two classes of the same stream in one calendar week", () => {
    const sameWeekExams: ExamSession[] = [
      {
        id: "a1",
        subjectId: "s1",
        classIds: ["c1"],
        date: "2026-06-03",
        startTime: "09:00",
        duration: 60,
        paperNumber: 1,
        status: "DRAFT",
      },
      {
        id: "a2",
        subjectId: "s1",
        classIds: ["c2"],
        date: "2026-06-04",
        startTime: "09:00",
        duration: 60,
        paperNumber: 1,
        status: "DRAFT",
      },
    ];

    const { exams } = allocateInvigilators(
      {
        ...data,
        classes: [
          { id: "c1", name: "10A", level: "10", defaultRoomId: "r1", curriculum: [] },
          { id: "c2", name: "10B", level: "10", defaultRoomId: "r1", curriculum: [] },
        ],
        exams: sameWeekExams,
      },
      defaultConfig,
    );

    const c1Team = new Set(exams.find((e) => e.id === "a1__c1")?.invigilatorIds);
    const c2Team = new Set(exams.find((e) => e.id === "a2__c2")?.invigilatorIds);
    const overlap = [...c1Team].filter((id) => c2Team.has(id));
    expect(overlap.length).toBe(0);
  });

  it("can assign three invigilators when min and max are 3", () => {
    const { exams } = allocateInvigilators(
      {
        ...data,
        classes: [{ id: "c1", name: "10A", level: "10", defaultRoomId: "r1", curriculum: [] }],
        exams: [
          {
            ...baseExams[0],
            classIds: ["c1"],
          },
        ],
      },
      { minInvigilators: 3, maxInvigilators: 3 },
    );

    expect(exams[0]?.invigilatorIds?.length).toBe(3);
  });

  it("does not exclude teachers who appear on the class timetable during exam time", () => {
    const exam: ExamSession = {
      id: "ex1",
      subjectId: "s1",
      classIds: ["c1"],
      date: "2026-06-01",
      startTime: "09:00",
      duration: 60,
      paperNumber: 1,
      status: "DRAFT",
    };

    const scheduleData = {
      ...data,
      teachers: [teachers[0], teachers[1]],
      classes: [{ id: "c1", name: "10A", level: "10", defaultRoomId: "r1", curriculum: [] }],
      exams: [exam],
      schedule: {
        c1: {
          0: {
            1: {
              subjectId: "s2",
              teacherId: "t1",
              classId: "c1",
            },
          },
        },
      },
    };

    const { exams } = allocateInvigilators(scheduleData, defaultConfig);

    expect(exams[0]?.invigilatorIds).toContain("t1");
    expect(exams[0]?.invigilatorIds?.length).toBe(2);
  });
});
