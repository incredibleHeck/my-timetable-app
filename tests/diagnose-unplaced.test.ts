import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState, applyGangToState } from "../src/features/generator/scheduler/core/state";
import {
  diagnoseUnplacedGang,
  DiagnosisMaps,
} from "../src/features/generator/scheduler/logic/diagnose-unplaced";

/** Two periods a day, two days: small enough to reason about every slot. */
const STRUCTURE = [
  { type: "CLASS" as const, label: "P1" },
  { type: "CLASS" as const, label: "P2" },
];

function makeUnit(over: Partial<AllocationUnit> = {}): AllocationUnit {
  return {
    id: "u1",
    subjectId: "s-math",
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

function buildData(over: Partial<AppData["settings"]> = {}, classesOver?: AppData["classes"]) {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 2,
      daysPerWeek: 2,
      dayStructure: STRUCTURE,
      fixedOccasions: [
        ["", ""],
        ["", ""],
      ],
      maxSubjectPeriodsPerDay: 4,
      maxTeacherPeriodsPerDay: 6,
      enforceSubjectDaySpread: false,
      ...over,
    },
    subjects: [{ id: "s-math", name: "Math", color: "#f00" }],
    teachers: [
      {
        id: "t1",
        name: "T1",
        specialtyIds: ["s-math"],
        constraints: [
          [false, false],
          [false, false],
        ],
      },
      // Occupies slots in the fixtures below; state only builds grids for
      // teachers it knows about, so this must be declared.
      {
        id: "t-other",
        name: "Other",
        specialtyIds: ["s-math"],
        constraints: [
          [false, false],
          [false, false],
        ],
      },
    ],
    classes: classesOver ?? [
      { id: "c1", name: "10A", curriculum: [], defaultRoomId: "r1", periodCount: 2 },
    ],
    rooms: [{ id: "r1", name: "R1", capacity: 100 }],
    schedule: {},
  } as unknown as AppData;
}

function mapsFor(data: AppData): DiagnosisMaps {
  return {
    teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
    subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
    classMap: new Map(data.classes.map((c) => [c.id, c])),
    roomMap: new Map(data.rooms.map((r) => [r.id, r])),
  };
}

describe("diagnoseUnplacedGang", () => {
  it("reports every slot free when nothing is placed", () => {
    const data = buildData();
    const state = initializeState(data);
    const d = diagnoseUnplacedGang(state, data, [makeUnit()], mapsFor(data));

    expect(d.slotsConsidered).toBe(4); // 2 days x 2 periods
    expect(d.slotsBlocked).toBe(0);
    expect(d.summary).toContain("4 of 4 slots were still free");
    expect(d.summary).toContain("the search gave up");
  });

  it("names the teacher's own unavailability", () => {
    const data = buildData();
    data.teachers[0].constraints = [
      [true, true],
      [true, true],
    ];
    const state = initializeState(data);
    const d = diagnoseUnplacedGang(state, data, [makeUnit()], mapsFor(data));

    expect(d.slotsBlocked).toBe(4);
    expect(d.reasons[0].reason).toBe("TEACHER_UNAVAILABLE");
    expect(d.reasons[0].count).toBe(4);
    expect(d.summary).toContain("Blocked in all 4 slots");
    expect(d.summary).toContain("teacher marked unavailable");
  });

  it("distinguishes a busy class from a busy teacher", () => {
    const data = buildData();
    const state = initializeState(data);

    // Fill day 0 for the class with a lesson taught by someone else.
    applyGangToState(
      state,
      [makeUnit({ id: "other", teacherIds: ["t-other"], teacherNames: ["Other"] })],
      { d: 0, p: 0, p2: -1, rooms: { other: "r1" } },
      data,
    );

    const d = diagnoseUnplacedGang(state, data, [makeUnit()], mapsFor(data));
    const byReason = Object.fromEntries(d.reasons.map((r) => [r.reason, r.count]));

    expect(byReason.CLASS_BUSY).toBe(1);
    expect(byReason.TEACHER_BUSY).toBeUndefined();
    expect(d.slotsBlocked).toBe(1);
  });

  it("counts breaks as non-teaching rather than as a constraint failure", () => {
    const data = buildData({
      dayStructure: [
        { type: "CLASS" as const, label: "P1" },
        { type: "BREAK" as const, label: "Break" },
      ],
    });
    const state = initializeState(data);
    const d = diagnoseUnplacedGang(state, data, [makeUnit()], mapsFor(data));

    const byReason = Object.fromEntries(d.reasons.map((r) => [r.reason, r.count]));
    expect(byReason.NOT_A_CLASS_PERIOD).toBe(2); // one per day
    expect(d.slotsBlocked).toBe(2);
  });

  it("flags a double with no room to complete it", () => {
    // Day is one teaching period then a break, so a double can never fit.
    const data = buildData({
      periodsPerDay: 2,
      dayStructure: [
        { type: "CLASS" as const, label: "P1" },
        { type: "BREAK" as const, label: "Break" },
      ],
    });
    const state = initializeState(data);
    const d = diagnoseUnplacedGang(state, data, [makeUnit({ duration: 2 })], mapsFor(data));

    const byReason = Object.fromEntries(d.reasons.map((r) => [r.reason, r.count]));
    expect(byReason.NO_SECOND_PERIOD_FOR_DOUBLE).toBe(2);
    expect(d.slotsBlocked).toBe(4);
  });

  it("requires every partner class of a joint lesson to be free", () => {
    const data = buildData(undefined, [
      { id: "c1", name: "2A", curriculum: [], defaultRoomId: "r1", periodCount: 2 },
      { id: "c2", name: "2B", curriculum: [], defaultRoomId: "r1", periodCount: 2 },
    ] as unknown as AppData["classes"]);
    const state = initializeState(data);

    // Only the partner class is busy; the leader's class is free.
    applyGangToState(
      state,
      [makeUnit({ id: "other", classIds: ["c2"], classNames: ["2B"], teacherIds: ["t-other"] })],
      { d: 0, p: 0, p2: -1, rooms: { other: "r1" } },
      data,
    );

    const joint = makeUnit({ classIds: ["c1", "c2"], classNames: ["2A", "2B"] });
    const d = diagnoseUnplacedGang(state, data, [joint], mapsFor(data));

    // The slot must be rejected even though 2A itself is free.
    expect(d.slotsBlocked).toBe(1);
    expect(d.reasons[0].reason).toBe("CLASS_BUSY");
  });

  it("records one reason per slot, not one per failed predicate", () => {
    const data = buildData();
    data.teachers[0].constraints = [
      [true, true],
      [true, true],
    ];
    const state = initializeState(data);
    const d = diagnoseUnplacedGang(state, data, [makeUnit()], mapsFor(data));

    const total = d.reasons.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(d.slotsBlocked);
  });
});
