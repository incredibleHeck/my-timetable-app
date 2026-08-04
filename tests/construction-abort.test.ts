import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import {
  runConstructionQueue,
  PlacementRecord,
  ConstructionMaps,
} from "../src/features/generator/scheduler/solver/construction";

/**
 * Stopping construction early does not make the queued lessons disappear.
 *
 * Both early exits used to return with the queue still populated, so those units
 * were neither on the grid nor recorded as unplaced — they stopped being counted
 * entirely. A real run cut short by the clock reported 3 unplaced while the grid
 * held 295, and since `unplacedDuringConstruction` seeds the repair queue,
 * nothing downstream could see them either.
 */

function build(): AppData {
  const periods = 4;
  const days = 2;
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

function makeUnits(n: number): AllocationUnit[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
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
  }));
}

function run(units: AllocationUnit[], shouldAbort?: () => boolean, onProgress?: () => boolean) {
  const data = build();
  const state = initializeState(data);
  const gangMap = new Map<string, AllocationUnit[]>(units.map((u) => [u.id, [u]]));

  const maps: ConstructionMaps = {
    data,
    gangMap,
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };

  const queue = [...units];
  const stack: PlacementRecord[] = [];
  const unplaced: AllocationUnit[] = [];

  const result = runConstructionQueue(
    queue,
    state,
    maps,
    stack,
    0,
    0,
    0,
    unplaced,
    onProgress,
    onProgress ? units.length : undefined,
    undefined,
    shouldAbort,
  );

  return { result, state, queue, units };
}

describe("construction accounts for every lesson when it stops early", () => {
  it("hands back the queue when the clock aborts it", () => {
    const units = makeUnits(6);
    // Abort immediately: nothing gets placed, so everything must be reported.
    const { result, state, queue } = run(units, () => true);

    expect(state.unitPlacements.size).toBe(0);
    expect(result.unplaced).toHaveLength(6);
    expect(queue).toHaveLength(0);
  });

  it("hands back the queue when the caller cancels", () => {
    const units = makeUnits(40);
    let calls = 0;
    // The progress hook is consulted every 10 steps; refuse on the first one.
    const { result, state, queue } = run(units, undefined, () => {
      calls++;
      return false;
    });

    expect(calls).toBeGreaterThan(0);
    expect(queue).toHaveLength(0);
    expect(state.unitPlacements.size + result.unplaced.length).toBe(40);
  });

  it("still accounts for everything on a clean run", () => {
    const units = makeUnits(5);
    const { result, state } = run(units);

    expect(state.unitPlacements.size + result.unplaced.length).toBe(5);
    expect(result.gangsPlaced).toBe(state.unitPlacements.size);
  });

  it("reports lessons it genuinely cannot place, without aborting", () => {
    // 8 teaching slots exist (2 days x 4 periods) but one teacher cannot be in
    // two places at once, so the last two of ten have nowhere to go.
    const units = makeUnits(10);
    const { result, state } = run(units);

    expect(state.unitPlacements.size).toBe(8);
    expect(result.unplaced).toHaveLength(2);
  });
});
