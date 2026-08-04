import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import { checkHardConstraints } from "../src/features/generator/scheduler/logic/constraints";

/**
 * Occupancy is tracked by period index, which only means "the same instant"
 * when every class shares a day structure. These fixtures stagger two classes by
 * one period, so index 2 in the late class runs at the same clock time as index
 * 3 in the early one — a collision no index-based check can see.
 *
 * The reference school runs four different structures and had five real ICT
 * double-bookings from exactly this.
 */

/** Early class: 60-minute periods from 08:00, no break. */
const EARLY = [
  { type: "CLASS" as const, label: "P1", duration: 60 },
  { type: "CLASS" as const, label: "P2", duration: 60 },
  { type: "CLASS" as const, label: "P3", duration: 60 },
  { type: "CLASS" as const, label: "P4", duration: 60 },
];

/** Late class: same periods, but a 60-minute break first shifts everything by one. */
const LATE = [
  { type: "BREAK" as const, label: "Break", duration: 60 },
  { type: "CLASS" as const, label: "P1", duration: 60 },
  { type: "CLASS" as const, label: "P2", duration: 60 },
  { type: "CLASS" as const, label: "P3", duration: 60 },
];

function build(over: Partial<AppData> = {}): AppData {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 4,
      daysPerWeek: 1,
      startTime: "08:00",
      dayStructure: EARLY,
      fixedOccasions: [["", "", "", ""]],
      maxSubjectPeriodsPerDay: 4,
      maxTeacherPeriodsPerDay: 8,
      enforceSubjectDaySpread: false,
    },
    subjects: [
      { id: "s-ict", name: "ICT", color: "#00f", isSingleResource: true },
      { id: "s-math", name: "Math", color: "#f00" },
    ],
    teachers: [
      { id: "t-a", name: "A", specialtyIds: [], constraints: [[false, false, false, false]] },
      { id: "t-b", name: "B", specialtyIds: [], constraints: [[false, false, false, false]] },
    ],
    classes: [
      {
        id: "early",
        name: "Early",
        curriculum: [],
        structure: EARLY,
        periodCount: 4,
        defaultRoomId: "r-shared",
      },
      {
        id: "late",
        name: "Late",
        curriculum: [],
        structure: LATE,
        periodCount: 4,
        defaultRoomId: "r-shared",
      },
    ],
    rooms: [{ id: "r-shared", name: "Shared", capacity: 100 }],
    schedule: {},
    ...over,
  } as unknown as AppData;
}

function maps(data: AppData) {
  return {
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };
}

function unit(over: Partial<AllocationUnit>): AllocationUnit {
  return {
    id: "u",
    subjectId: "s-math",
    subjectName: "Math",
    duration: 1,
    classIds: ["early"],
    classNames: ["Early"],
    teacherIds: ["t-a"],
    teacherNames: ["A"],
    priority: 10,
    rankLevel: 10,
    defaultRoomId: "r-shared",
    ...over,
  };
}

/** Places `occupant` for the Late class, then asks whether `candidate` may join. */
function setup(occupant: AllocationUnit, occupantPeriod: number) {
  const data = build();
  const state = initializeState(data);
  applyGangToState(
    state,
    [occupant],
    { d: 0, p: occupantPeriod, p2: -1, rooms: { [occupant.id]: "r-shared" } },
    data,
  );
  return { data, state };
}

function allows(
  data: AppData,
  state: ReturnType<typeof initializeState>,
  u: AllocationUnit,
  p: number,
) {
  const m = maps(data);
  return checkHardConstraints(
    state,
    data,
    0,
    p,
    -1,
    u,
    m.teacherMap,
    m.classMap,
    m.subjectMap,
    m.roomMap,
  );
}

describe("staggered day structures", () => {
  it("puts the two classes in the same hour at different indices", () => {
    const state = initializeState(build());
    expect(state.hasStaggeredDays).toBe(true);

    const early = state.classTimeRanges.get("early")!;
    const late = state.classTimeRanges.get("late")!;

    // The property that matters is not that any particular pair lines up — the
    // app derives bell times from settings — but that at least one *cross-index*
    // pair shares clock time. That is precisely what an index-keyed grid cannot
    // represent, and what the constraint check now has to catch.
    const crossIndexOverlaps: Array<[number, number]> = [];
    for (let a = 0; a < early.length; a++) {
      for (let b = 0; b < late.length; b++) {
        if (a === b) continue;
        if (early[a].start < late[b].end && late[b].start < early[a].end) {
          crossIndexOverlaps.push([a, b]);
        }
      }
    }
    expect(crossIndexOverlaps.length).toBeGreaterThan(0);
  });

  it("treats a class carrying its own copy of the global structure as not staggered", () => {
    const data = build();
    data.classes = data.classes.map((c) => ({ ...c, structure: [...EARLY] }));
    // Structurally identical, different array identities.
    expect(initializeState(data).hasStaggeredDays).toBe(false);
  });

  it("refuses to book a teacher into an overlapping window", () => {
    const occupant = unit({ id: "busy", classIds: ["late"], classNames: ["Late"] });
    const { data, state } = setup(occupant, 1);

    // Early P1 runs at the same clock time as Late P1 despite the index match,
    // so this is caught by the index check too. The staggered case is P1 vs P2.
    const candidate = unit({ id: "cand", classIds: ["early"], teacherIds: ["t-a"] });
    expect(allows(data, state, candidate, 1)).toBe(false);
  });

  it("refuses a shared resource already in use at that clock time", () => {
    // Late holds ICT at its index 2; Early's index 2 is a different hour, but
    // Early's index 1 is not.
    const occupant = unit({
      id: "ict-late",
      subjectId: "s-ict",
      subjectName: "ICT",
      classIds: ["late"],
      classNames: ["Late"],
      teacherIds: ["t-b"],
    });
    const { data, state } = setup(occupant, 2);

    const candidate = unit({
      id: "ict-early",
      subjectId: "s-ict",
      subjectName: "ICT",
      classIds: ["early"],
      teacherIds: ["t-a"],
    });

    // Early index 2 == Late index 2? No: Late is shifted one hour later, so
    // Early's index 2 collides with Late's index 3, and Early index 3 does not.
    const earlyStart = state.classTimeRanges.get("early")![2].start;
    const lateStart = state.classTimeRanges.get("late")![2].start;
    expect(earlyStart).not.toBe(lateStart);

    // The overlapping index must be refused...
    const clashing = [1, 2, 3].filter((p) => {
      const r = state.classTimeRanges.get("early")![p];
      const o = state.classTimeRanges.get("late")![2];
      return r.start < o.end && o.start < r.end;
    });
    expect(clashing.length).toBeGreaterThan(0);
    for (const p of clashing) {
      expect(allows(data, state, candidate, p)).toBe(false);
    }
  });

  it("still allows a non-overlapping slot", () => {
    const occupant = unit({
      id: "ict-late",
      subjectId: "s-ict",
      subjectName: "ICT",
      classIds: ["late"],
      classNames: ["Late"],
      teacherIds: ["t-b"],
    });
    const { data, state } = setup(occupant, 3);

    const candidate = unit({
      id: "ict-early",
      subjectId: "s-ict",
      subjectName: "ICT",
      classIds: ["early"],
      teacherIds: ["t-a"],
    });

    // Late index 3 is the last hour of the day; Early index 0 is the first.
    const early0 = state.classTimeRanges.get("early")![0];
    const late3 = state.classTimeRanges.get("late")![3];
    expect(early0.end <= late3.start).toBe(true);
    expect(allows(data, state, candidate, 0)).toBe(true);
  });
});
