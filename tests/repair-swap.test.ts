import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import {
  initializeState,
  applyGangToState,
} from "../src/features/generator/scheduler/core/state";
import {
  findSwapMove,
  findBestRepairMove,
  findMinConflictMove,
} from "../src/features/generator/scheduler/solver/search";
import { executeRepairAction } from "../src/features/generator/scheduler/solver/repair-executor";
import { getGangId } from "../src/features/generator/scheduler/solver/repair-controller";

function makeUnit(
  id: string,
  subjectId: string,
  subjectName: string,
  teacherId = "t1",
): AllocationUnit {
  return {
    id,
    subjectId,
    subjectName,
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: [teacherId],
    teacherNames: ["Teacher 1"],
    priority: 100,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

function buildTwoPeriodData() {
  const dayStructure = [
    { type: "CLASS" as const, label: "1" },
    { type: "CLASS" as const, label: "2" },
  ];

  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 2,
      daysPerWeek: 1,
      dayStructure,
      fixedOccasions: [[""]],
      maxSubjectPeriodsPerDay: 2,
      maxTeacherPeriodsPerDay: 6,
    },
    subjects: [
      { id: "s-math", name: "Math", color: "#f00" },
      { id: "s-eng", name: "English", color: "#0f0" },
    ],
    teachers: [
      {
        id: "t1",
        name: "Teacher 1",
        specialtyIds: ["s-math", "s-eng"],
        constraints: [[false, false]],
      },
    ],
    rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "Classroom" }],
    classes: [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: 2,
        structure: dayStructure,
        curriculum: [],
      },
    ],
  };
}

describe("Repair swap neighborhood (PR3)", () => {
  it("findSwapMove coordinates incoming and partner placements", () => {
    const data = buildTwoPeriodData();
    const state = initializeState(data);

    const partner = makeUnit("u-partner", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-eng", "English");

    applyGangToState(state, [partner], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-partner": "r1" },
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(partner), [partner]],
      [getGangId(incoming), [incoming]],
    ]);
    const unitMap = new Map<string, AllocationUnit>([
      [partner.id, partner],
      [incoming.id, incoming],
    ]);
    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const swap = findSwapMove(
      state,
      data,
      [incoming],
      gangMap,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(swap).not.toBeNull();
    expect(swap!.partnerGangId).toBe(getGangId(partner));
    expect(swap!.gangMove.d).toBe(0);
    expect(swap!.gangMove.p).toBe(0);
    expect(swap!.partnerMove.cost).toBeLessThan(Infinity);
  });

  it("executeRepairAction applies swap moves without re-queuing the partner", () => {
    const data = buildTwoPeriodData();
    const state = initializeState(data);

    const partner = makeUnit("u-partner", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-eng", "English");

    applyGangToState(state, [partner], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-partner": "r1" },
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(partner), [partner]],
      [getGangId(incoming), [incoming]],
    ]);
    const unitMap = new Map<string, AllocationUnit>([
      [partner.id, partner],
      [incoming.id, incoming],
    ]);
    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const swap = findSwapMove(
      state,
      data,
      [incoming],
      gangMap,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(swap).not.toBeNull();

    const repairQueue: AllocationUnit[] = [];
    const repairSet = new Set<string>();

    executeRepairAction(
      state,
      [incoming],
      swap!,
      repairQueue,
      repairSet,
      gangMap,
      unitMap,
      data,
    );

    expect(state.unitPlacements.has("u-incoming")).toBe(true);
    expect(state.unitPlacements.has("u-partner")).toBe(true);
    expect(repairQueue).toHaveLength(0);
    expect(state.schedule["c1"]?.[0]?.[0]?.subjectId).toBe("s-eng");
    expect(state.schedule["c1"]?.[0]?.[1]?.subjectId).toBe("s-math");
  });

  it("findBestRepairMove prefers a direct placement over a swap when both exist", () => {
    const data = buildTwoPeriodData();
    const state = initializeState(data);

    const partner = makeUnit("u-partner", "s-math", "Math");
    const incoming = makeUnit("u-incoming", "s-eng", "English");

    applyGangToState(state, [partner], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { "u-partner": "r1" },
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(partner), [partner]],
      [getGangId(incoming), [incoming]],
    ]);
    const unitMap = new Map<string, AllocationUnit>([
      [partner.id, partner],
      [incoming.id, incoming],
    ]);
    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const direct = findMinConflictMove(
      state,
      data,
      [incoming],
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );
    const best = findBestRepairMove(
      state,
      data,
      [incoming],
      gangMap,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(direct.cost).toBeLessThan(Infinity);
    expect(best.kind).toBe("place");
    expect(best.cost).toBe(direct.cost);
  });
});
