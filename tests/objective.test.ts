import { describe, it, expect } from "vitest";
import {
  scoreSchedule,
  teachingIndicesOf,
  classSchedulablePeriods,
  OBJECTIVE_WEIGHTS,
} from "../src/features/generator/scheduler/logic/objective";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ScheduleResult } from "../src/types";

/** P0 CLASS, P1 BREAK, P2..P5 CLASS — break sits mid-morning, as in a real day. */
const STRUCTURE = [
  { type: "CLASS" as const, label: "P1" },
  { type: "BREAK" as const, label: "Break" },
  { type: "CLASS" as const, label: "P2" },
  { type: "CLASS" as const, label: "P3" },
  { type: "CLASS" as const, label: "P4" },
  { type: "CLASS" as const, label: "P5" },
];

type Lesson = {
  classId: string;
  day: number;
  period: number;
  teacherId: string;
  subjectId: string;
};

function buildData(opts: {
  lessons: Lesson[];
  classes?: AppData["classes"];
  teachers?: AppData["teachers"];
  settings?: Partial<AppData["settings"]>;
}): AppData {
  const schedule: ScheduleResult = {};
  for (const l of opts.lessons) {
    schedule[l.classId] ??= {};
    schedule[l.classId][l.day] ??= {};
    schedule[l.classId][l.day][l.period] = {
      subjectId: l.subjectId,
      teacherId: l.teacherId,
      classId: l.classId,
      duration: 1,
    } as ScheduleResult[string][number][number];
  }

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 6,
      daysPerWeek: 5,
      dayStructure: STRUCTURE,
      ...opts.settings,
    },
    classes: opts.classes ?? [{ id: "c1", name: "10A", curriculum: [] }],
    teachers: opts.teachers ?? [{ id: "t1", name: "T1", subjectIds: [], constraints: {} }],
    subjects: [
      { id: "s1", name: "Math" },
      { id: "s2", name: "PE" },
    ],
    schedule,
  } as AppData;
}

function score(opts: Parameters<typeof buildData>[0], unplaced = 0) {
  const data = buildData(opts);
  return scoreSchedule(data, data.schedule, unplaced);
}

describe("teachingIndicesOf", () => {
  it("keeps only CLASS periods", () => {
    expect([...teachingIndicesOf(STRUCTURE)]).toEqual([0, 2, 3, 4, 5]);
  });

  it("treats a bare string structure and a missing type as teaching time", () => {
    expect([...teachingIndicesOf(["CLASS", "BREAK", "CLASS"])]).toEqual([0, 2]);
    expect([...teachingIndicesOf([{ label: "P1" }] as never)]).toEqual([0]);
  });
});

describe("classSchedulablePeriods", () => {
  it("uses the class's own structure, not the global one", () => {
    const data = buildData({
      lessons: [],
      classes: [
        // Break at index 3 for this class, not index 1.
        {
          id: "c1",
          name: "10A",
          curriculum: [],
          structure: [
            { type: "CLASS" as const, label: "P1" },
            { type: "CLASS" as const, label: "P2" },
            { type: "CLASS" as const, label: "P3" },
            { type: "BREAK" as const, label: "Break" },
          ],
        } as AppData["classes"][number],
      ],
    });
    expect([...classSchedulablePeriods(data, "c1", 0)]).toEqual([0, 1, 2]);
  });

  it("excludes reserved occasions and per-class fixed sessions", () => {
    const data = buildData({
      lessons: [],
      classes: [
        {
          id: "c1",
          name: "10A",
          curriculum: [],
          fixedSessions: { 0: { 3: { label: "Clubs" } } },
        } as unknown as AppData["classes"][number],
      ],
      settings: { fixedOccasions: { 0: { 0: { label: "Worship" } } } as never },
    });
    // P0 taken by Worship, P1 is break, P3 taken by Clubs.
    expect([...classSchedulablePeriods(data, "c1", 0)]).toEqual([2, 4, 5]);
  });
});

describe("scoreSchedule — class gaps", () => {
  it("does not count a break as a gap", () => {
    // Lessons at P0 and P2 straddle the break at index 1. No idle time.
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 0, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.classGapPeriods).toBe(0);
  });

  it("counts a genuine idle teaching period", () => {
    // P2 and P4 busy, P3 idle.
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 4, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.classGapPeriods).toBe(1);
    // The same hole is also an isolated gap for the teacher, and costs both.
    expect(r.softCost).toBe(OBJECTIVE_WEIGHTS.CLASS_GAP + OBJECTIVE_WEIGHTS.FRAGMENTED_TEACHER_GAP);
  });

  it("ignores free time outside the first and last lesson", () => {
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 3, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.classGapPeriods).toBe(0);
  });
});

describe("scoreSchedule — teacher free-time shape", () => {
  it("penalises an isolated single free period", () => {
    // Busy P2, P4 → single free at P3.
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 4, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.fragmentedTeacherGaps).toBe(1);
    expect(r.breakdown.consolidatedTeacherBlocks).toBe(0);
  });

  it("counts but does not penalise a consolidated 2+ block", () => {
    // Busy P2, P5 → free run P3,P4. Real prep time; must not be scored.
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 5, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.fragmentedTeacherGaps).toBe(0);
    expect(r.breakdown.consolidatedTeacherBlocks).toBe(1);
    // Only the two class gaps are charged — the teacher block costs nothing.
    expect(r.softCost).toBe(2 * OBJECTIVE_WEIGHTS.CLASS_GAP);
  });

  it("does not treat the break as splitting a free block into singles", () => {
    // Busy P0 and P3 → free P2 only (P1 is break). One isolated gap, not two.
    const r = score({
      lessons: [
        { classId: "c1", day: 0, period: 0, teacherId: "t1", subjectId: "s1" },
        { classId: "c1", day: 0, period: 3, teacherId: "t1", subjectId: "s1" },
      ],
    });
    expect(r.breakdown.fragmentedTeacherGaps).toBe(1);
  });
});

describe("scoreSchedule — joint classes", () => {
  // One teacher takes 2A and 2B together in a single slot. That is one period
  // on the teacher's timetable, not two, and must not read as an overload.
  const jointLessons: Lesson[] = [
    { classId: "c1", day: 0, period: 0, teacherId: "t1", subjectId: "s2" },
    { classId: "c2", day: 0, period: 0, teacherId: "t1", subjectId: "s2" },
    { classId: "c1", day: 0, period: 2, teacherId: "t1", subjectId: "s2" },
    { classId: "c2", day: 0, period: 2, teacherId: "t1", subjectId: "s2" },
  ];
  const twoClasses = [
    { id: "c1", name: "2A", curriculum: [] },
    { id: "c2", name: "2B", curriculum: [] },
  ] as AppData["classes"];

  it("counts a co-taught slot once against the weekly cap", () => {
    const r = score({
      lessons: jointLessons,
      classes: twoClasses,
      settings: { maxTeachingPeriodsPerWeek: 3 },
    });
    // Four grid cells, but only two occupied teacher periods → under the cap of 3.
    expect(r.breakdown.weeklyCapExcess).toBe(0);
  });

  it("still reports excess once genuinely over the cap", () => {
    const r = score({
      lessons: jointLessons,
      classes: twoClasses,
      settings: { maxTeachingPeriodsPerWeek: 1 },
    });
    expect(r.breakdown.weeklyCapExcess).toBe(1);
  });

  it("counts a co-taught slot once for load imbalance", () => {
    // t1 co-teaches 2 slots; t2 teaches 2 solo slots. Perfectly balanced.
    const r = score({
      lessons: [
        ...jointLessons,
        { classId: "c3", day: 0, period: 0, teacherId: "t2", subjectId: "s1" },
        { classId: "c3", day: 0, period: 2, teacherId: "t2", subjectId: "s1" },
      ],
      classes: [...twoClasses, { id: "c3", name: "3A", curriculum: [] }],
      teachers: [
        { id: "t1", name: "T1", subjectIds: [], constraints: {} },
        { id: "t2", name: "T2", subjectIds: [], constraints: {} },
      ] as AppData["teachers"],
    });
    expect(r.breakdown.loadImbalance).toBe(0);
  });
});

describe("scoreSchedule — curriculum and ranking", () => {
  it("charges for curriculum the grid never delivers", () => {
    const data = buildData({
      lessons: [{ classId: "c1", day: 0, period: 0, teacherId: "t1", subjectId: "s1" }],
      classes: [
        {
          id: "c1",
          name: "10A",
          curriculum: [{ subjectId: "s1", periodsPerWeek: 4, assignedTeacherId: "t1" }],
        } as AppData["classes"][number],
      ],
    });
    const r = scoreSchedule(data, data.schedule);
    expect(r.breakdown.curriculumGapPeriods).toBe(3);
    expect(r.softCost).toBe(3 * OBJECTIVE_WEIGHTS.CURRICULUM_GAP);
  });

  it("reports unplaced separately from soft cost", () => {
    const r = score({ lessons: [] }, 7);
    expect(r.unplacedPeriods).toBe(7);
    expect(r.softCost).toBe(0);
  });

  it("scores an empty schedule at zero soft cost", () => {
    expect(score({ lessons: [] }).softCost).toBe(0);
  });
});
