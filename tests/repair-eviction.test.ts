import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ClassGroup, Subject, Teacher, Room } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import {
  initializeState,
  applyGangToState,
  removeGangFromState,
} from "../src/features/generator/scheduler/core/state";
import { EvaluationEngine } from "../src/features/generator/scheduler/logic/evaluation";
import { findMinConflictMove } from "../src/features/generator/scheduler/solver/search";

function buildRepairTestData(singlePeriod = false): AppData {
  const dayStructure = singlePeriod
    ? [{ type: "CLASS" as const, label: "1" }]
    : [
        { type: "CLASS" as const, label: "1" },
        { type: "CLASS" as const, label: "2" },
      ];

  const periodCount = singlePeriod ? 1 : 2;

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: periodCount,
      daysPerWeek: 1,
      dayStructure,
      fixedOccasions: singlePeriod ? [[""]] : [[""], [""]],
      maxSubjectPeriodsPerDay: 2,
      maxTeacherPeriodsPerDay: 6,
    },
    subjects: [
      { id: "s-math", name: "Math", color: "#f00" },
      { id: "s-eng", name: "English", color: "#0f0" },
      { id: "s-sci", name: "Science", color: "#00f" },
    ],
    teachers: [
      {
        id: "t1",
        name: "Teacher 1",
        specialtyIds: ["s-math", "s-eng", "s-sci"],
        constraints: [[false, false]],
      },
    ],
    rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "Classroom" }],
    classes: [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount,
        structure: dayStructure,
        curriculum: [],
      },
    ],
  };
}

function makeUnit(id: string, subjectId: string, subjectName: string): AllocationUnit {
  return {
    id,
    subjectId,
    subjectName,
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: ["t1"],
    teacherNames: ["Teacher 1"],
    priority: 100,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

describe("Repair eviction constraints (F12)", () => {
  it("evaluateMove treats occupied class slots as legal when victims will be evicted", () => {
    const data = buildRepairTestData();
    const state = initializeState(data);

    const placed = makeUnit("u-placed", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-sci", "Science");

    applyGangToState(state, [placed], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-placed": "r1" },
    });

    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    const unitMap = new Map<string, AllocationUnit>([
      [placed.id, placed],
      [incoming.id, incoming],
    ]);

    const evaluator = new EvaluationEngine();
    const result = evaluator.evaluateMove(
      state,
      data,
      incoming,
      0,
      0,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      unitMap,
    );

    expect(result.isLegal).toBe(true);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.conflicts.some((c) => c.includes("Evicting"))).toBe(true);
  });

  it("findMinConflictMove returns an eviction move for an occupied slot", () => {
    const data = buildRepairTestData(true);
    const state = initializeState(data);

    const placed = makeUnit("u-placed", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-sci", "Science");

    applyGangToState(state, [placed], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-placed": "r1" },
    });

    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    const unitMap = new Map<string, AllocationUnit>([
      [placed.id, placed],
      [incoming.id, incoming],
    ]);

    const move = findMinConflictMove(
      state,
      data,
      [incoming],
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(move.cost).toBeLessThan(Infinity);
    expect(move.d).toBe(0);
    expect(move.p).toBe(0);
    expect(move.evictions.has("u-placed")).toBe(true);
  });

  it("executing an eviction move displaces the occupant and places the incoming lesson", () => {
    const data = buildRepairTestData(true);
    const state = initializeState(data);

    const placed = makeUnit("u-placed", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-eng", "English");

    applyGangToState(state, [placed], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-placed": "r1" },
    });

    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    const unitMap = new Map<string, AllocationUnit>([
      [placed.id, placed],
      [incoming.id, incoming],
    ]);

    const move = findMinConflictMove(
      state,
      data,
      [incoming],
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(move.cost).toBeLessThan(Infinity);
    expect(move.evictions.has("u-placed")).toBe(true);

    removeGangFromState(state, [placed], data);
    applyGangToState(state, [incoming], move);

    expect(state.unitPlacements.has("u-incoming")).toBe(true);
    expect(state.unitPlacements.has("u-placed")).toBe(false);
    expect(state.schedule["c1"]?.[0]?.[0]?.subjectId).toBe("s-eng");
  });

  it("repair move still rejects immutable teacher blocks even with eviction", () => {
    const data = buildRepairTestData();
    data.teachers[0].constraints = [[true, false]];

    const state = initializeState(data);
    const placed = makeUnit("u-placed", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-sci", "Science");

    applyGangToState(state, [placed], {
      d: 0,
      p: 1,
      p2: -1,
      rooms: { "u-placed": "r1" },
    });

    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    const unitMap = new Map<string, AllocationUnit>([
      [placed.id, placed],
      [incoming.id, incoming],
    ]);

    const evaluator = new EvaluationEngine();
    const result = evaluator.evaluateMove(
      state,
      data,
      incoming,
      0,
      0,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      unitMap,
    );

    expect(result.isLegal).toBe(false);
    expect(result.totalCost).toBe(Infinity);
  });
});
