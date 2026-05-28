import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import {
  tryConstructionBacktrack,
  runConstructionQueue,
  PlacementRecord,
} from "../src/features/generator/scheduler/solver/construction";
import { solveSmart } from "../src/features/generator/scheduler/solver/solver";
import { getGangId } from "../src/features/generator/scheduler/solver/repair-controller";
import { MAX_BACKTRACK_ATTEMPTS } from "../src/features/generator/scheduler/constants";

function makeUnit(
  id: string,
  subjectId: string,
  subjectName: string,
  teacherId: string,
  priority = 10,
): AllocationUnit {
  return {
    id,
    subjectId,
    subjectName,
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: [teacherId],
    teacherNames: [teacherId],
    priority,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

function buildBacktrackData() {
  const dayStructure = [{ type: "CLASS" as const, label: "1" }];

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 1,
      daysPerWeek: 2,
      dayStructure,
      fixedOccasions: [[""], [""]],
      maxSubjectPeriodsPerDay: 2,
      maxTeacherPeriodsPerDay: 6,
    },
    subjects: [
      { id: "s-math", name: "Math", color: "#f00" },
      { id: "s-eng", name: "English", color: "#0f0" },
    ],
    teachers: [
      {
        id: "t-flex",
        name: "Flexible Teacher",
        specialtyIds: ["s-math"],
        constraints: [[false], [false]],
      },
      {
        id: "t-restricted",
        name: "Restricted Teacher",
        specialtyIds: ["s-eng"],
        constraints: [[false], [true]],
      },
    ],
    rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "Classroom" }],
    classes: [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: 1,
        structure: dayStructure,
        curriculum: [],
      },
    ],
  };
}

function makeRecord(
  leader: AllocationUnit,
  gangUnits: AllocationUnit[],
  move: { d: number; p: number; p2: number; rooms: Record<string, string> },
  canBacktrack: boolean,
): PlacementRecord {
  return {
    leader,
    gangId: getGangId(leader),
    gangUnits,
    move,
    canBacktrack,
    avoidSlots: new Set<string>(),
  };
}

describe("Construction backtracking (PR4)", () => {
  it("tryConstructionBacktrack removes recent placements and re-queues leaders", () => {
    const data = buildBacktrackData();
    const state = initializeState(data);

    const blocker = makeUnit("u-blocker", "s-math", "Math", "t-flex");
    const incoming = makeUnit("u-incoming", "s-eng", "English", "t-restricted");

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(blocker), [blocker]],
      [getGangId(incoming), [incoming]],
    ]);
    const maps = {
      data,
      gangMap,
      teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
      subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
      classMap: new Map(data.classes.map((c) => [c.id, c])),
      roomMap: new Map(data.rooms.map((r) => [r.id, r])),
    };

    applyGangToState(state, [blocker], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-blocker": "r1" },
    });

    const stack: PlacementRecord[] = [
      makeRecord(blocker, [blocker], { d: 0, p: 0, p2: -1, rooms: { "u-blocker": "r1" } }, true),
    ];

    const queue: AllocationUnit[] = [];
    const result = tryConstructionBacktrack(state, queue, incoming, stack, maps, 0);

    expect(result.requeued).toBe(true);
    expect(result.backtrackAttempts).toBe(1);
    expect(stack).toHaveLength(0);
    expect(state.unitPlacements.has("u-blocker")).toBe(false);
    expect(queue.map((u) => u.id)).toEqual(["u-incoming", "u-blocker"]);
  });

  it("does not backtrack over critical placements", () => {
    const data = buildBacktrackData();
    const state = initializeState(data);

    const critical = makeUnit("u-critical", "s-math", "Math", "t-flex", 60000);
    const incoming = makeUnit("u-incoming", "s-eng", "English", "t-restricted");

    applyGangToState(state, [critical], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-critical": "r1" },
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(critical), [critical]],
      [getGangId(incoming), [incoming]],
    ]);
    const maps = {
      data,
      gangMap,
      teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
      subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
      classMap: new Map(data.classes.map((c) => [c.id, c])),
      roomMap: new Map(data.rooms.map((r) => [r.id, r])),
    };

    const stack: PlacementRecord[] = [
      makeRecord(
        critical,
        [critical],
        { d: 0, p: 0, p2: -1, rooms: { "u-critical": "r1" } },
        false,
      ),
    ];

    const queue: AllocationUnit[] = [];
    const result = tryConstructionBacktrack(state, queue, incoming, stack, maps, 0);

    expect(result.requeued).toBe(false);
    expect(stack).toHaveLength(1);
    expect(state.unitPlacements.has("u-critical")).toBe(true);
  });

  it("runConstructionQueue resolves a greedy conflict via backtracking", () => {
    const data = buildBacktrackData();
    const state = initializeState(data);

    const math = makeUnit("u-math", "s-math", "Math", "t-flex");
    const english = makeUnit("u-eng", "s-eng", "English", "t-restricted");

    applyGangToState(state, [math], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-math": "r1" },
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(math), [math]],
      [getGangId(english), [english]],
    ]);
    const maps = {
      data,
      gangMap,
      teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
      subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
      classMap: new Map(data.classes.map((c) => [c.id, c])),
      roomMap: new Map(data.rooms.map((r) => [r.id, r])),
    };

    const stack: PlacementRecord[] = [
      makeRecord(math, [math], { d: 0, p: 0, p2: -1, rooms: { "u-math": "r1" } }, true),
    ];
    const queue = [english];

    const result = runConstructionQueue(queue, state, maps, stack, 0, 0, 0, []);

    expect(result.unplaced).toHaveLength(0);
    expect(result.gangsPlaced).toBe(2);
    expect(result.backtrackAttempts).toBeGreaterThan(0);
    expect(state.unitPlacements.has("u-math")).toBe(true);
    expect(state.unitPlacements.has("u-eng")).toBe(true);
  });

  it("solveSmart places both lessons when restricted teacher only fits day 0", () => {
    const data = buildBacktrackData();
    const units = [
      makeUnit("u-math", "s-math", "Math", "t-flex"),
      makeUnit("u-eng", "s-eng", "English", "t-restricted"),
    ];

    const { conflicts, state } = solveSmart(units, data);

    expect(conflicts.filter((c) => c.reason.includes("Unplaced"))).toHaveLength(0);
    expect(state.unitPlacements.size).toBe(2);
  });

  it("conflict-directed backtrack targets the actual blocker, not just the most recent", () => {
    const data = buildBacktrackData();
    data.settings.daysPerWeek = 3;
    data.settings.periodsPerDay = 1;
    data.settings.dayStructure = [{ type: "CLASS" as const, label: "1" }];
    data.settings.fixedOccasions = [[""], [""], [""]];
    data.teachers = [
      { id: "t-a", name: "A", specialtyIds: [], constraints: [[false], [false], [false]] },
      { id: "t-b", name: "B", specialtyIds: [], constraints: [[false], [false], [false]] },
      { id: "t-target", name: "Target", specialtyIds: [], constraints: [[false], [true], [true]] },
    ];
    data.classes = [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: 1,
        structure: data.settings.dayStructure,
        curriculum: [],
      },
      {
        id: "c2",
        name: "10B",
        defaultRoomId: "r1",
        periodCount: 1,
        structure: data.settings.dayStructure,
        curriculum: [],
      },
    ];

    const state = initializeState(data);

    // unitA: teacher t-target, class c1, day 0 — this is the blocker
    // unitB: teacher t-b, class c2, day 1 — completely unrelated
    // incoming: teacher t-target, class c1 — needs day 0 (only available day)
    const unitA: AllocationUnit = {
      ...makeUnit("u-a", "s-math", "Math", "t-target"),
      classIds: ["c1"],
    };
    const unitB: AllocationUnit = {
      ...makeUnit("u-b", "s-eng", "English", "t-b"),
      classIds: ["c2"],
    };
    const incoming: AllocationUnit = {
      ...makeUnit("u-inc", "s-math", "Math", "t-target"),
      classIds: ["c1"],
    };

    applyGangToState(state, [unitA], { d: 0, p: 0, p2: -1, rooms: { "u-a": "r1" } });
    applyGangToState(state, [unitB], { d: 1, p: 0, p2: -1, rooms: { "u-b": "r1" } });

    const gangMap = new Map([
      [getGangId(unitA), [unitA]],
      [getGangId(unitB), [unitB]],
      [getGangId(incoming), [incoming]],
    ]);
    const maps = {
      data,
      gangMap,
      teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
      subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
      classMap: new Map(data.classes.map((c) => [c.id, c])),
      roomMap: new Map(data.rooms.map((r) => [r.id, r])),
    };

    const stack: PlacementRecord[] = [
      makeRecord(unitA, [unitA], { d: 0, p: 0, p2: -1, rooms: { "u-a": "r1" } }, true),
      makeRecord(unitB, [unitB], { d: 1, p: 0, p2: -1, rooms: { "u-b": "r1" } }, true),
    ];

    const queue: AllocationUnit[] = [];
    const result = tryConstructionBacktrack(state, queue, incoming, stack, maps, 0);

    expect(result.requeued).toBe(true);
    expect(stack).toHaveLength(1);
    expect(stack[0].gangId).toBe(getGangId(unitB));
    expect(state.unitPlacements.has("u-a")).toBe(false);
    expect(state.unitPlacements.has("u-b")).toBe(true);
    expect(queue.map((u) => u.id)).toEqual(["u-inc", "u-a"]);
  });

  it("respects MAX_BACKTRACK_ATTEMPTS before giving up", () => {
    const data = buildBacktrackData();
    const state = initializeState(data);

    const blocker = makeUnit("u-blocker", "s-math", "Math", "t-flex");
    const incoming = makeUnit("u-incoming", "s-eng", "English", "t-restricted");

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(blocker), [blocker]],
      [getGangId(incoming), [incoming]],
    ]);
    const maps = {
      data,
      gangMap,
      teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
      subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
      classMap: new Map(data.classes.map((c) => [c.id, c])),
      roomMap: new Map(data.rooms.map((r) => [r.id, r])),
    };

    const stack: PlacementRecord[] = [];
    const queue: AllocationUnit[] = [];
    let attempts = 0;

    while (attempts < MAX_BACKTRACK_ATTEMPTS + 5) {
      applyGangToState(state, [blocker], {
        d: 0,
        p: 0,
        p2: -1,
        rooms: { "u-blocker": "r1" },
      });
      stack.push(
        makeRecord(blocker, [blocker], { d: 0, p: 0, p2: -1, rooms: { "u-blocker": "r1" } }, true),
      );

      const result = tryConstructionBacktrack(state, queue, incoming, stack, maps, attempts);
      attempts = result.backtrackAttempts;

      if (!result.requeued) break;
    }

    expect(attempts).toBe(MAX_BACKTRACK_ATTEMPTS);
  });
});
