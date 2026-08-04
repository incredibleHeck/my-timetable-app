import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit, SchedulerState } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import { findBestRepairMove } from "../src/features/generator/scheduler/solver/search";

/**
 * The repair search evaluates candidate moves by simulating them against the
 * live state. Simulation is a probe, not a commitment — the caller decides
 * afterwards whether to keep the move.
 *
 * The chain path used to break that: its unwind removed the evicted gangs a
 * second time instead of restoring them, so merely *evaluating* a chain deleted
 * every lesson it touched. On a real school one repair step took the schedule
 * from 1 unplaced lesson to 6, and the loss was invisible because the repair
 * loop tracks queue length rather than the grid.
 *
 * These tests pin the invariant directly: searching must leave the state
 * exactly as it found it.
 */

function snapshotPlacements(state: SchedulerState) {
  return [...state.unitPlacements.entries()]
    .map(([id, pl]) => `${id}@${pl.d}-${pl.p}-${pl.p2}`)
    .sort();
}

function makeUnit(over: Partial<AllocationUnit> = {}): AllocationUnit {
  return {
    id: "u",
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
    ...over,
  };
}

/**
 * A deliberately tight school: one room, few periods, every teacher shared.
 * Chains and evictions are the only way to place anything, which is exactly the
 * code path under test.
 */
function buildCrowdedSchool() {
  const periods = 3;
  const days = 2;
  const dayStructure = Array.from({ length: periods }, (_, i) => ({
    type: "CLASS" as const,
    label: `P${i + 1}`,
  }));
  const free = Array.from({ length: days }, () => Array.from({ length: periods }, () => false));

  const data = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: periods,
      daysPerWeek: days,
      dayStructure,
      fixedOccasions: Array.from({ length: days }, () => Array.from({ length: periods }, () => "")),
      maxSubjectPeriodsPerDay: 4,
      maxTeacherPeriodsPerDay: 6,
      enforceSubjectDaySpread: false,
    },
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "English", color: "#0f0" },
    ],
    teachers: [
      { id: "t1", name: "T1", specialtyIds: ["s1"], constraints: free.map((r) => [...r]) },
      { id: "t2", name: "T2", specialtyIds: ["s2"], constraints: free.map((r) => [...r]) },
    ],
    classes: [
      { id: "c1", name: "10A", curriculum: [], defaultRoomId: "r1", periodCount: periods },
      { id: "c2", name: "10B", curriculum: [], defaultRoomId: "r1", periodCount: periods },
    ],
    rooms: [{ id: "r1", name: "R1", capacity: 100 }],
    schedule: {},
  } as unknown as AppData;

  return data;
}

function mapsFor(data: AppData) {
  return {
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };
}

describe("findBestRepairMove leaves the state untouched", () => {
  it("does not unplace lessons while searching a crowded schedule", () => {
    const data = buildCrowdedSchool();
    const maps = mapsFor(data);
    const state = initializeState(data);

    const gangMap = new Map<string, AllocationUnit[]>();
    const unitMap = new Map<string, AllocationUnit>();

    // Fill both classes across both days so the only route for a new lesson is
    // eviction, and relocating a victim needs a further eviction — a chain.
    let n = 0;
    for (const classId of ["c1", "c2"]) {
      for (let d = 0; d < 2; d++) {
        for (let p = 0; p < 3; p++) {
          const unit = makeUnit({
            id: `placed-${n++}`,
            classIds: [classId],
            classNames: [classId],
            teacherIds: [classId === "c1" ? "t1" : "t2"],
            subjectId: classId === "c1" ? "s1" : "s2",
          });
          gangMap.set(unit.id, [unit]);
          unitMap.set(unit.id, unit);
          applyGangToState(state, [unit], { d, p, p2: -1, rooms: { [unit.id]: "r1" } }, data);
        }
      }
    }

    // The lesson we are trying to fit: needs t1 (busy in c1) and c2 (fully booked).
    const homeless = makeUnit({ id: "homeless", classIds: ["c2"], teacherIds: ["t1"] });
    gangMap.set(homeless.id, [homeless]);
    unitMap.set(homeless.id, homeless);

    const before = snapshotPlacements(state);
    expect(before).toHaveLength(12);

    findBestRepairMove(
      state,
      data,
      [homeless],
      gangMap,
      unitMap,
      maps.teacherMap,
      maps.subjectMap,
      maps.classMap,
      maps.roomMap,
      undefined,
      1,
    );

    expect(snapshotPlacements(state)).toEqual(before);
  });

  it("is idempotent across repeated searches", () => {
    const data = buildCrowdedSchool();
    const maps = mapsFor(data);
    const state = initializeState(data);

    const gangMap = new Map<string, AllocationUnit[]>();
    const unitMap = new Map<string, AllocationUnit>();

    let n = 0;
    for (let d = 0; d < 2; d++) {
      for (let p = 0; p < 3; p++) {
        const unit = makeUnit({ id: `p-${n++}`, classIds: ["c1"], teacherIds: ["t1"] });
        gangMap.set(unit.id, [unit]);
        unitMap.set(unit.id, unit);
        applyGangToState(state, [unit], { d, p, p2: -1, rooms: { [unit.id]: "r1" } }, data);
      }
    }

    const homeless = makeUnit({ id: "homeless", classIds: ["c1"], teacherIds: ["t1"] });
    gangMap.set(homeless.id, [homeless]);
    unitMap.set(homeless.id, homeless);

    const before = snapshotPlacements(state);

    for (let i = 0; i < 5; i++) {
      findBestRepairMove(
        state,
        data,
        [homeless],
        gangMap,
        unitMap,
        maps.teacherMap,
        maps.subjectMap,
        maps.classMap,
        maps.roomMap,
        undefined,
        i + 1,
      );
      // Every iteration must start from the same grid; a leak would compound.
      expect(snapshotPlacements(state)).toEqual(before);
    }
  });
});
