import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import {
  initializeState,
  applyGangToState,
  removeGangFromState,
} from "../src/features/generator/scheduler/core/state";
import {
  snapshotPlacedGangs,
  restorePlacedGangs,
  countUnplacedGangLeaders,
} from "../src/features/generator/scheduler/solver/repair-controller";

/**
 * Repair is not a descent. It places one lesson by evicting another, shakes the
 * grid when it stagnates, and stops wherever the clock leaves it — so the state
 * it ends on is not necessarily the best it reached. Measured on the reference
 * school, one run got to 3 unplaced and finished at 5.
 *
 * These tests cover the snapshot/restore primitive that lets the loop rewind:
 * it has to reproduce the grid exactly, including the derived counters that
 * every constraint check reads.
 */

function build(periods = 4, days = 2): AppData {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: periods,
      daysPerWeek: days,
      dayStructure: Array.from({ length: periods }, (_, i) => ({
        type: "CLASS" as const,
        label: `P${i + 1}`,
      })),
      fixedOccasions: Array.from({ length: days }, () => Array.from({ length: periods }, () => "")),
      maxSubjectPeriodsPerDay: 8,
      maxTeacherPeriodsPerDay: 8,
      enforceSubjectDaySpread: false,
    },
    subjects: [{ id: "s1", name: "Math", color: "#f00" }],
    teachers: [
      {
        id: "t1",
        name: "T1",
        specialtyIds: ["s1"],
        constraints: Array.from({ length: days }, () =>
          Array.from({ length: periods }, () => false),
        ),
      },
    ],
    classes: [{ id: "c1", name: "10A", curriculum: [], defaultRoomId: "r1", periodCount: periods }],
    rooms: [{ id: "r1", name: "R1", capacity: 100 }],
    schedule: {},
  } as unknown as AppData;
}

function unit(id: string): AllocationUnit {
  return {
    id,
    subjectId: "s1",
    subjectName: "Math",
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: ["t1"],
    teacherNames: ["T1"],
    priority: 10,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

function seed(count: number) {
  const data = build();
  const state = initializeState(data);
  const gangMap = new Map<string, AllocationUnit[]>();
  const leaders: AllocationUnit[] = [];

  for (let i = 0; i < count; i++) {
    const u = unit(`u${i}`);
    gangMap.set(u.id, [u]);
    leaders.push(u);
    applyGangToState(
      state,
      [u],
      { d: Math.floor(i / 4), p: i % 4, p2: -1, rooms: { [u.id]: "r1" } },
      data,
    );
  }
  return { data, state, gangMap, leaders };
}

function describeGrid(state: ReturnType<typeof initializeState>) {
  return {
    placements: [...state.unitPlacements.entries()]
      .map(([id, pl]) => `${id}@${pl.d}-${pl.p}-${pl.p2}`)
      .sort(),
    load: JSON.stringify(state.teacherDailyLoad),
    classOccupancy: JSON.stringify(state.classOccupancy),
    teacherOccupancy: JSON.stringify(state.teacherOccupancy),
    roomOccupancy: JSON.stringify(state.roomOccupancy),
    subjectDuration: JSON.stringify(state.classSubjectDuration),
  };
}

describe("repair incumbent snapshot", () => {
  it("restores the grid exactly, derived counters included", () => {
    const { data, state, gangMap } = seed(6);
    const before = describeGrid(state);

    const snapshot = snapshotPlacedGangs(state, gangMap);

    // Wreck it the way repair does: lift lessons out, then put them elsewhere.
    for (const id of ["u0", "u1", "u2"]) {
      const gang = gangMap.get(id)!;
      removeGangFromState(state, gang, data);
      applyGangToState(state, gang, { d: 1, p: 3, p2: -1, rooms: { [id]: "r1" } });
    }
    expect(describeGrid(state)).not.toEqual(before);

    restorePlacedGangs(state, data, gangMap, snapshot);
    expect(describeGrid(state)).toEqual(before);
  });

  it("restores a partial grid without resurrecting unplaced lessons", () => {
    const { data, state, gangMap, leaders } = seed(6);

    // Snapshot a state where two lessons are deliberately absent.
    const removed = ["u4", "u5"];
    for (const id of removed) {
      const gang = gangMap.get(id)!;
      for (const u of gang) state.unitPlacements.delete(u.id);
    }
    const snapshot = snapshotPlacedGangs(state, gangMap);
    expect(snapshot.size).toBe(4);

    // Place them, then rewind: they must be gone again.
    for (const id of removed) {
      applyGangToState(state, gangMap.get(id)!, { d: 1, p: 2, p2: -1, rooms: { [id]: "r1" } });
    }

    restorePlacedGangs(state, data, gangMap, snapshot);

    expect(countUnplacedGangLeaders(leaders, gangMap, state)).toBe(2);
    for (const id of removed) {
      expect(state.unitPlacements.has(id)).toBe(false);
    }
  });

  it("is idempotent", () => {
    const { data, state, gangMap } = seed(5);
    const snapshot = snapshotPlacedGangs(state, gangMap);
    const before = describeGrid(state);

    restorePlacedGangs(state, data, gangMap, snapshot);
    restorePlacedGangs(state, data, gangMap, snapshot);

    expect(describeGrid(state)).toEqual(before);
  });

  it("leaves no stale teacher load behind", () => {
    const { data, state, gangMap } = seed(4);
    const snapshot = snapshotPlacedGangs(state, gangMap);
    const loadBefore = [...state.teacherDailyLoad.t1];

    // Pile every lesson onto one day, inflating that day's load.
    for (let i = 0; i < 4; i++) {
      const gang = gangMap.get(`u${i}`)!;
      removeGangFromState(state, gang, data);
      applyGangToState(state, gang, { d: 1, p: i, p2: -1, rooms: { [`u${i}`]: "r1" } });
    }
    expect(state.teacherDailyLoad.t1[1]).toBe(4);

    restorePlacedGangs(state, data, gangMap, snapshot);
    expect([...state.teacherDailyLoad.t1]).toEqual(loadBefore);
  });
});
