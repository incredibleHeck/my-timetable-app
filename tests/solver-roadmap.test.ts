import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import {
  getRoomCandidates,
  resolveTargetRoom,
} from "../src/features/generator/scheduler/logic/rooms";
import { solveSmart } from "../src/features/generator/scheduler/solver/solver";
import { findMostConstrainedGangIdx } from "../src/features/generator/scheduler/solver/heuristics";
import { getGangId } from "../src/features/generator/scheduler/solver/repair-controller";

describe("Solver roadmap improvements", () => {
  it("getRoomCandidates uses strict chain for specialist required rooms", () => {
    const data = {
      ...DEFAULT_DATA,
      subjects: [{ id: "s1", name: "Art", color: "#f00", requiredRoomId: "r-lab" }],
      rooms: [
        { id: "r-lab", name: "Lab", capacity: 30, type: "Lab" },
        { id: "r-home", name: "Home", capacity: 30, type: "Classroom" },
      ],
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r-home",
          periodCount: 5,
          structure: DEFAULT_DATA.settings.dayStructure,
          curriculum: [],
        },
      ],
    };

    const unit: AllocationUnit = {
      id: "u1",
      subjectId: "s1",
      subjectName: "Art",
      duration: 1,
      classIds: ["c1"],
      classNames: ["10A"],
      teacherIds: ["t1"],
      teacherNames: ["T1"],
      priority: 10,
      rankLevel: 10,
      defaultRoomId: "r-home",
      preferredRoomIds: ["r-home"],
    };

    const subject = data.subjects[0];
    const cls = data.classes[0];
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    expect(getRoomCandidates(unit, subject, cls, roomMap)).toEqual(["r-lab"]);
  });

  it("resolveTargetRoom falls back to homeroom for non-specialist subjects", () => {
    const data = {
      ...DEFAULT_DATA,
      subjects: [{ id: "s1", name: "Math", color: "#f00" }],
      teachers: [
        {
          id: "t1",
          name: "Teacher",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(8).fill(false)),
        },
      ],
      rooms: [
        { id: "r-alt", name: "Alt", capacity: 30, type: "Classroom" },
        { id: "r-home", name: "Home", capacity: 30, type: "Classroom" },
      ],
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r-home",
          periodCount: 5,
          structure: DEFAULT_DATA.settings.dayStructure,
          curriculum: [],
        },
      ],
    };

    const state = initializeState(data);
    state.roomOccupancy["r-home"] = { 0: { 0: "blocker" } };

    const unit: AllocationUnit = {
      id: "u1",
      subjectId: "s1",
      subjectName: "Math",
      duration: 1,
      classIds: ["c1"],
      classNames: ["10A"],
      teacherIds: ["t1"],
      teacherNames: ["T1"],
      priority: 10,
      rankLevel: 10,
      defaultRoomId: "r-home",
      preferredRoomIds: ["r-alt"],
    };

    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const room = resolveTargetRoom(
      0,
      0,
      -1,
      unit,
      state,
      subjectMap,
      classMap,
      roomMap,
      { requireAvailable: true },
    );

    expect(room).toBe("r-alt");
  });

  it("findMostConstrainedGangIdx picks the smallest domain deterministically", () => {
    const data = DEFAULT_DATA;
    const state = initializeState(data);

    const flexible: AllocationUnit = {
      id: "u-flex",
      subjectId: "s1",
      subjectName: "Math",
      duration: 1,
      classIds: ["c1"],
      classNames: ["10A"],
      teacherIds: ["t-flex"],
      teacherNames: ["Flex"],
      priority: 10,
      rankLevel: 10,
    };

    const tight: AllocationUnit = {
      id: "u-tight",
      subjectId: "s2",
      subjectName: "English",
      duration: 1,
      classIds: ["c1"],
      classNames: ["10A"],
      teacherIds: ["t-tight"],
      teacherNames: ["Tight"],
      priority: 10,
      rankLevel: 10,
    };

    data.teachers = [
      {
        id: "t-flex",
        name: "Flex",
        specialtyIds: ["s1"],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(8).fill(false)),
      },
      {
        id: "t-tight",
        name: "Tight",
        specialtyIds: ["s2"],
        constraints: [
          [false, true, true, true, true, true, true, true],
          ...Array(4).fill(Array(8).fill(true)),
        ],
      },
    ];
    data.classes = [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "r1",
        periodCount: 8,
        structure: DEFAULT_DATA.settings.dayStructure,
        curriculum: [],
      },
    ];
    data.rooms = [{ id: "r1", name: "Room", capacity: 30, type: "Classroom" }];

    const gangMap = new Map([
      [getGangId(flexible), [flexible]],
      [getGangId(tight), [tight]],
    ]);
    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map([
      ["s1", { id: "s1", name: "Math", color: "#f00" }],
      ["s2", { id: "s2", name: "English", color: "#0f0" }],
    ]);
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const idx = findMostConstrainedGangIdx(
      [flexible, tight],
      state,
      data,
      gangMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );

    expect(idx).toBe(1);
  });

  it("maxCorePeriodsPerDay blocks overloading core subjects on one day", () => {
    const dayStructure = DEFAULT_DATA.settings.dayStructure;
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        maxCorePeriodsPerDay: 2,
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          periodCount: 8,
          structure: dayStructure,
          curriculum: [],
        },
      ],
      rooms: [{ id: "r1", name: "Room", capacity: 30, type: "Classroom" }],
      teachers: [
        {
          id: "t1",
          name: "Teacher",
          specialtyIds: ["s-math"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(8).fill(false)),
        },
      ],
      subjects: [{ id: "s-math", name: "Math", color: "#f00" }],
    };

    const units: AllocationUnit[] = [
      {
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
        isCore: true,
      },
      {
        id: "u2",
        subjectId: "s-math",
        subjectName: "Math",
        duration: 1,
        classIds: ["c1"],
        classNames: ["10A"],
        teacherIds: ["t1"],
        teacherNames: ["T1"],
        priority: 10,
        rankLevel: 10,
        isCore: true,
      },
      {
        id: "u3",
        subjectId: "s-math",
        subjectName: "Math",
        duration: 1,
        classIds: ["c1"],
        classNames: ["10A"],
        teacherIds: ["t1"],
        teacherNames: ["T1"],
        priority: 10,
        rankLevel: 10,
        isCore: true,
      },
    ];

    const { state } = solveSmart(units, data);
    const day0Core = Object.values(state.schedule["c1"]?.[0] ?? {}).filter(
      (slot) => slot?.isCore,
    ).length;

    expect(day0Core).toBeLessThanOrEqual(2);
  });

  it("solveSmart multi-run returns the best attempt", () => {
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 1,
        daysPerWeek: 2,
        dayStructure: [{ type: "CLASS" as const, label: "1" }],
        fixedOccasions: [[""], [""]],
      },
      subjects: [
        { id: "s-math", name: "Math", color: "#f00" },
        { id: "s-eng", name: "English", color: "#0f0" },
      ],
      teachers: [
        {
          id: "t-flex",
          name: "Flex",
          specialtyIds: ["s-math"],
          constraints: [[false], [false]],
        },
        {
          id: "t-restricted",
          name: "Restricted",
          specialtyIds: ["s-eng"],
          constraints: [[false], [true]],
        },
      ],
      rooms: [{ id: "r1", name: "Room", capacity: 30, type: "Classroom" }],
      classes: [
        {
          id: "c1",
          name: "10A",
          defaultRoomId: "r1",
          periodCount: 1,
          structure: [{ type: "CLASS" as const, label: "1" }],
          curriculum: [],
        },
      ],
    };

    const units: AllocationUnit[] = [
      {
        id: "u-math",
        subjectId: "s-math",
        subjectName: "Math",
        duration: 1,
        classIds: ["c1"],
        classNames: ["10A"],
        teacherIds: ["t-flex"],
        teacherNames: ["Flex"],
        priority: 10,
        rankLevel: 10,
      },
      {
        id: "u-eng",
        subjectId: "s-eng",
        subjectName: "English",
        duration: 1,
        classIds: ["c1"],
        classNames: ["10A"],
        teacherIds: ["t-restricted"],
        teacherNames: ["Restricted"],
        priority: 10,
        rankLevel: 10,
      },
    ];

    const single = solveSmart(units, data, undefined, { runs: 1, seed: 1 });
    const multi = solveSmart(units, data, undefined, {
      runs: 5,
      seed: 1,
      shuffleConstruction: true,
    });

    expect(multi.conflicts.length).toBeLessThanOrEqual(single.conflicts.length);
    expect(multi.state.unitPlacements.size).toBeGreaterThanOrEqual(
      single.state.unitPlacements.size,
    );
  });
});
