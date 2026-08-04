import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import { optimiseSchedule } from "../src/features/generator/scheduler/logic/optimise";
import { createSeededRng } from "../src/features/generator/scheduler/utils/rng";

/**
 * Reassignment is the only move that changes *who* teaches a lesson, and so the
 * only one that can shift teacher load balance — relocate and swap leave every
 * teacher's weekly total exactly as it was.
 *
 * It is also the only move with consequences outside the software, so it is off
 * unless the school turns it on, never picks a teacher the school has not marked
 * qualified, and moves a class's subject as one block rather than splitting it
 * across two teachers.
 */

const PERIODS = 6;
const DAYS = 2;

function build(over: { allow?: boolean; specialists?: Record<string, string[]> } = {}): AppData {
  const free = () =>
    Array.from({ length: DAYS }, () => Array.from({ length: PERIODS }, () => false));
  const specialists = over.specialists ?? {
    t1: ["s1", "s2", "s3"],
    t2: ["s1", "s2", "s3"],
    t3: [],
  };

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: PERIODS,
      daysPerWeek: DAYS,
      dayStructure: Array.from({ length: PERIODS }, (_, i) => ({
        type: "CLASS" as const,
        label: `P${i + 1}`,
      })),
      fixedOccasions: Array.from({ length: DAYS }, () => Array.from({ length: PERIODS }, () => "")),
      maxSubjectPeriodsPerDay: 8,
      maxTeacherPeriodsPerDay: 8,
      enforceSubjectDaySpread: false,
      allowTeacherReassignment: over.allow,
    },
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "English", color: "#0f0" },
      { id: "s3", name: "Science", color: "#00f" },
    ],
    teachers: Object.entries(specialists).map(([id, specialtyIds]) => ({
      id,
      name: id.toUpperCase(),
      specialtyIds,
      constraints: free(),
    })),
    classes: [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: PERIODS,
        // The curriculum records who the school assigned. That set is the
        // denominator for load balance, so a teacher emptied by reassignment
        // still counts — otherwise concentrating work would score as balance.
        curriculum: [
          { subjectId: "s1", periodsPerWeek: 4, singles: 4, assignedTeacherId: "t1" },
          { subjectId: "s2", periodsPerWeek: 4, singles: 4, assignedTeacherId: "t1" },
          { subjectId: "s3", periodsPerWeek: 2, singles: 2, assignedTeacherId: "t2" },
        ],
      },
    ],
    rooms: [{ id: "r1", name: "R1", capacity: 100 }],
    schedule: {},
  } as unknown as AppData;
}

function unit(id: string, subjectId: string, teacherId: string): AllocationUnit {
  return {
    id,
    subjectId,
    subjectName: subjectId,
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: [teacherId],
    teacherNames: [teacherId.toUpperCase()],
    priority: 10,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

/**
 * t1 carries eight periods across two subjects while t2 carries two, an
 * imbalance no relocation can touch because neither changes who teaches.
 *
 * Both teachers already teach: the objective measures balance across staff who
 * do, so a fixture where one of them taught nothing would score as perfectly
 * balanced no matter how lopsided it looked.
 */
function seedImbalanced(data: AppData) {
  const state = initializeState(data);
  const gangMap = new Map<string, AllocationUnit[]>();
  const leaders: AllocationUnit[] = [];

  const layout: Array<[string, string, number]> = [
    ["s1", "t1", 4],
    ["s2", "t1", 4],
    ["s3", "t2", 2],
  ];

  let i = 0;
  for (const [subjectId, teacherId, count] of layout) {
    for (let n = 0; n < count; n++) {
      const u = unit(`u${i}`, subjectId, teacherId);
      gangMap.set(u.id, [u]);
      leaders.push(u);
      applyGangToState(
        state,
        [u],
        { d: Math.floor(i / PERIODS), p: i % PERIODS, p2: -1, rooms: { [u.id]: "r1" } },
        data,
      );
      i++;
    }
  }
  return { state, gangMap, leaders };
}

function run(data: AppData, seedValue = 7) {
  const { state, gangMap, leaders } = seedImbalanced(data);
  const maps = {
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };
  const report = optimiseSchedule(state, data, leaders, gangMap, maps, {
    deadlineMs: Date.now() + 3000,
    rng: createSeededRng(seedValue),
  });
  return { state, gangMap, leaders, report };
}

const teacherOf = (gangMap: Map<string, AllocationUnit[]>, id: string) =>
  gangMap.get(id)![0].teacherIds[0];

describe("teacher reassignment", () => {
  it("does nothing unless the school turns it on", () => {
    const { gangMap, report } = run(build({ allow: undefined }));

    expect(report.reassignments).toBe(0);
    // t1 keeps both of its subjects; nothing moved to the idle t2.
    expect([...gangMap.values()].filter((g) => g[0].teacherIds[0] === "t1")).toHaveLength(8);
  });

  it("balances load by moving a subject to another qualified teacher", () => {
    const { gangMap, report } = run(build({ allow: true }));

    expect(report.reassignments).toBeGreaterThan(0);
    expect(report.after.breakdown.loadImbalance).toBeLessThan(
      report.before.breakdown.loadImbalance,
    );

    const counts = new Map<string, number>();
    for (const id of gangMap.keys()) {
      const t = teacherOf(gangMap, id);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    // Eight against two becomes something closer to even.
    expect(Math.max(...counts.values())).toBeLessThan(8);
  });

  it("moves a class's subject as one block, never splitting it", () => {
    const { gangMap, report } = run(build({ allow: true }));
    expect(report.reassignments).toBeGreaterThan(0);

    const bySubject = new Map<string, Set<string>>();
    for (const [id, gang] of gangMap) {
      const subject = gang[0].subjectId;
      if (!bySubject.has(subject)) bySubject.set(subject, new Set());
      bySubject.get(subject)!.add(teacherOf(gangMap, id));
    }
    // Each subject ends up with exactly one teacher for this class.
    for (const teachers of bySubject.values()) {
      expect(teachers.size).toBe(1);
    }
  });

  it("never hands a subject to a teacher who is not qualified", () => {
    // t3 is qualified for nothing and completely free — the most tempting
    // candidate for load balance, and the one that must never be chosen.
    const { gangMap } = run(
      build({ allow: true, specialists: { t1: ["s1", "s2", "s3"], t2: [], t3: [] } }),
    );

    for (const id of gangMap.keys()) {
      expect(teacherOf(gangMap, id)).not.toBe("t3");
    }
  });

  it("keeps every lesson placed and the grid legal", () => {
    const { state, gangMap, leaders } = run(build({ allow: true }));

    expect(state.unitPlacements.size).toBe(leaders.length);

    // No teacher double-booked, no class double-booked.
    const seen = new Set<string>();
    for (const [unitId, pl] of state.unitPlacements) {
      const u = gangMap.get(unitId)![0];
      for (const key of [
        `T${u.teacherIds[0]}-${pl.d}-${pl.p}`,
        `C${u.classIds[0]}-${pl.d}-${pl.p}`,
      ]) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("leaves teacher assignments untouched when it rejects every candidate", () => {
    // One teacher qualified for the subjects means nothing to move to.
    const data = build({ allow: true, specialists: { t1: ["s1", "s2", "s3"], t2: [] } });
    const { gangMap, report } = run(data);

    expect(report.reassignments).toBe(0);
    // Every lesson keeps the teacher it started with, names included.
    for (const [id, gang] of gangMap) {
      const expected = gang[0].subjectId === "s3" ? "t2" : "t1";
      expect(teacherOf(gangMap, id)).toBe(expected);
      expect(gang[0].teacherNames[0]).toBe(expected.toUpperCase());
    }
  });
});
