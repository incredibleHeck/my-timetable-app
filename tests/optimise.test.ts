import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import { optimiseSchedule } from "../src/features/generator/scheduler/logic/optimise";
import { scoreSchedule } from "../src/features/generator/scheduler/logic/objective";
import { createSeededRng } from "../src/features/generator/scheduler/utils/rng";

/**
 * The optimisation phase runs on a schedule the school could already use. Its
 * contract is therefore narrow and absolute: never lose a lesson, never make the
 * objective worse. These tests assert both directly rather than trusting that
 * the moves happen to behave.
 */

const allFree = (days: number, periods: number) =>
  Array.from({ length: days }, () => Array.from({ length: periods }, () => false));

function build(periods = 6, days = 5) {
  const dayStructure = Array.from({ length: periods }, (_, i) => ({
    type: "CLASS" as const,
    label: `P${i + 1}`,
  }));

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: periods,
      daysPerWeek: days,
      dayStructure,
      fixedOccasions: Array.from({ length: days }, () => Array.from({ length: periods }, () => "")),
      maxSubjectPeriodsPerDay: 4,
      maxTeacherPeriodsPerDay: 8,
      enforceSubjectDaySpread: false,
    },
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "English", color: "#0f0" },
    ],
    teachers: [
      { id: "t1", name: "T1", specialtyIds: ["s1"], constraints: allFree(days, periods) },
      { id: "t2", name: "T2", specialtyIds: ["s2"], constraints: allFree(days, periods) },
    ],
    classes: [
      { id: "c1", name: "10A", curriculum: [], defaultRoomId: "r1", periodCount: periods },
      { id: "c2", name: "10B", curriculum: [], defaultRoomId: "r2", periodCount: periods },
    ],
    rooms: [
      { id: "r1", name: "R1", capacity: 100 },
      { id: "r2", name: "R2", capacity: 100 },
    ],
    schedule: {},
  } as unknown as AppData;
}

function mapsFor(data: AppData) {
  return {
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };
}

function unit(id: string, classId: string, teacherId: string, subjectId: string): AllocationUnit {
  return {
    id,
    subjectId,
    subjectName: subjectId,
    duration: 1,
    classIds: [classId],
    classNames: [classId],
    teacherIds: [teacherId],
    teacherNames: [teacherId],
    priority: 10,
    rankLevel: 10,
    defaultRoomId: classId === "c1" ? "r1" : "r2",
  };
}

/**
 * Places lessons so each class has a deliberate hole mid-day — a shape the
 * objective charges for and a relocation can fix.
 */
function seedGappySchedule(data: AppData) {
  const state = initializeState(data);
  const gangMap = new Map<string, AllocationUnit[]>();
  const leaders: AllocationUnit[] = [];

  const layout: Array<[string, string, string, number, number]> = [
    ["c1", "t1", "s1", 0, 0],
    ["c1", "t1", "s1", 0, 4], // gap at P2/P3
    ["c2", "t2", "s2", 0, 0],
    ["c2", "t2", "s2", 0, 5], // wider gap
    ["c1", "t1", "s1", 1, 0],
    ["c1", "t1", "s1", 1, 3],
    ["c2", "t2", "s2", 1, 1],
    ["c2", "t2", "s2", 1, 4],
  ];

  layout.forEach(([classId, teacherId, subjectId, d, p], i) => {
    const u = unit(`u${i}`, classId, teacherId, subjectId);
    gangMap.set(u.id, [u]);
    leaders.push(u);
    applyGangToState(state, [u], { d, p, p2: -1, rooms: { [u.id]: u.defaultRoomId! } }, data);
  });

  return { state, gangMap, leaders };
}

describe("optimiseSchedule", () => {
  it("never loses a lesson", () => {
    const data = build();
    const { state, gangMap, leaders } = seedGappySchedule(data);
    const placedBefore = state.unitPlacements.size;

    optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: Date.now() + 2000,
      rng: createSeededRng(42),
    });

    expect(state.unitPlacements.size).toBe(placedBefore);
    for (const leader of leaders) {
      expect(state.unitPlacements.has(leader.id)).toBe(true);
    }
  });

  it("never increases the objective", () => {
    const data = build();
    const { state, gangMap, leaders } = seedGappySchedule(data);

    const report = optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: Date.now() + 2000,
      rng: createSeededRng(7),
    });

    expect(report.after.softCost).toBeLessThanOrEqual(report.before.softCost);
    // The report must describe the schedule it actually left behind.
    expect(scoreSchedule(data, state.schedule).softCost).toBe(report.after.softCost);
  });

  it("closes a gap it is given room to close", () => {
    const data = build();
    const { state, gangMap, leaders } = seedGappySchedule(data);
    const before = scoreSchedule(data, state.schedule);

    const report = optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: Date.now() + 3000,
      rng: createSeededRng(3),
    });

    expect(before.breakdown.classGapPeriods).toBeGreaterThan(0);
    expect(report.after.breakdown.classGapPeriods).toBeLessThan(before.breakdown.classGapPeriods);
    expect(report.accepted).toBeGreaterThan(0);
  });

  it("leaves no double-booking behind", () => {
    const data = build();
    const { state, gangMap, leaders } = seedGappySchedule(data);

    optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: Date.now() + 2000,
      rng: createSeededRng(11),
    });

    const occupied = new Set<string>();
    for (const [unitId, pl] of state.unitPlacements) {
      const u = gangMap.get(unitId)?.[0];
      if (!u) continue;
      for (const classId of u.classIds) {
        const key = `${classId}-${pl.d}-${pl.p}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
      for (const teacherId of u.teacherIds) {
        const key = `T${teacherId}-${pl.d}-${pl.p}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
  });

  it("stops at the deadline", () => {
    const data = build();
    const { state, gangMap, leaders } = seedGappySchedule(data);

    const started = Date.now();
    optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: started + 60,
      rng: createSeededRng(5),
    });

    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("is a no-op on an already optimal schedule", () => {
    const data = build();
    const state = initializeState(data);
    const gangMap = new Map<string, AllocationUnit[]>();
    const leaders: AllocationUnit[] = [];

    // Contiguous from P0, no gaps anywhere: nothing to improve.
    for (let i = 0; i < 4; i++) {
      const u = unit(`u${i}`, "c1", "t1", "s1");
      gangMap.set(u.id, [u]);
      leaders.push(u);
      applyGangToState(state, [u], { d: 0, p: i, p2: -1, rooms: { [u.id]: "r1" } }, data);
    }

    const before = scoreSchedule(data, state.schedule).softCost;
    const report = optimiseSchedule(state, data, leaders, gangMap, mapsFor(data), {
      deadlineMs: Date.now() + 1000,
      rng: createSeededRng(9),
    });

    expect(report.after.softCost).toBe(before);
    expect(state.unitPlacements.size).toBe(4);
  });
});
