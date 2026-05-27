import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import {
  RepairController,
  countUnplacedGangs,
  diversifyRepairState,
  getGangId,
} from "../src/features/generator/scheduler/solver/repair-controller";
import {
  MAX_GANG_REPAIR_ATTEMPTS,
  REPAIR_STAGNATION_LIMIT,
  PRIORITY_CRITICAL,
} from "../src/features/generator/scheduler/constants";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import {
  initializeState,
  applyGangToState,
} from "../src/features/generator/scheduler/core/state";
import { runMinConflictsRepair } from "../src/features/generator/scheduler/solver/repair";

function makeLeader(id: string, priority: number): AllocationUnit {
  return {
    id,
    subjectId: "s1",
    subjectName: "Math",
    duration: 1,
    classIds: ["c1"],
    classNames: ["10A"],
    teacherIds: ["t1"],
    teacherNames: ["Teacher 1"],
    priority,
    rankLevel: 10,
    defaultRoomId: "r1",
  };
}

describe("RepairController", () => {
  it("resets stagnation when unplaced count improves", () => {
    const controller = new RepairController(5);
    for (let i = 0; i < REPAIR_STAGNATION_LIMIT; i++) {
      controller.recordProgress(5);
    }
    expect(controller.shouldDiversify()).toBe(true);

    controller.recordProgress(4);
    expect(controller.shouldDiversify()).toBe(false);
  });

  it("abandons a gang after max failed repair attempts", () => {
    const controller = new RepairController(1);
    const leader = makeLeader("u-stuck", 100);

    for (let i = 0; i < MAX_GANG_REPAIR_ATTEMPTS - 1; i++) {
      controller.recordFailedAttempt("u-stuck", leader);
      expect(controller.shouldSkipGang("u-stuck")).toBe(false);
    }

    controller.recordFailedAttempt("u-stuck", leader);
    expect(controller.shouldSkipGang("u-stuck")).toBe(true);
    expect(controller.abandonedLeadersList).toHaveLength(1);
    expect(controller.abandonedLeadersList[0].id).toBe("u-stuck");
  });

  it("tracks unplaced count across queue and abandoned gangs", () => {
    const controller = new RepairController(2);
    const queue = [makeLeader("u1", 100), makeLeader("u2", 100)];

    controller.recordFailedAttempt("u1", queue[0]);
    for (let i = 1; i < MAX_GANG_REPAIR_ATTEMPTS; i++) {
      controller.recordFailedAttempt("u1", queue[0]);
    }

    expect(countUnplacedGangs(queue, controller)).toBe(
      queue.length + controller.abandonedCount,
    );
  });
});

describe("diversifyRepairState", () => {
  it("removes low-priority placed gangs and re-queues them", () => {
    const dayStructure = [
      { type: "CLASS" as const, label: "1" },
      { type: "CLASS" as const, label: "2" },
    ];
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 2,
        daysPerWeek: 1,
        dayStructure,
        fixedOccasions: [[""]],
      },
      subjects: [{ id: "s1", name: "Math", color: "#f00" }],
      teachers: [
        {
          id: "t1",
          name: "Teacher 1",
          specialtyIds: ["s1"],
          constraints: [[false]],
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

    const low = makeLeader("u-low", 10);
    const high = makeLeader("u-high", PRIORITY_CRITICAL + 1);
    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(low), [low]],
      [getGangId(high), [high]],
    ]);
    const unitMap = new Map<string, AllocationUnit>([
      [low.id, low],
      [high.id, high],
    ]);

    const state = initializeState(data);
    applyGangToState(state, [low], {
      d: 0,
      p: 0,
      p2: -1,
      rooms: { [low.id]: "r1" },
    });
    applyGangToState(state, [high], {
      d: 0,
      p: 1,
      p2: -1,
      rooms: { [high.id]: "r1" },
    });

    const repairQueue: AllocationUnit[] = [];
    const repairSet = new Set<string>();

    const removed = diversifyRepairState(
      state,
      data,
      gangMap,
      unitMap,
      repairQueue,
      repairSet,
    );

    expect(removed).toBe(1);
    expect(repairQueue).toHaveLength(1);
    expect(repairQueue[0].id).toBe("u-low");
    expect(state.unitPlacements.has("u-high")).toBe(true);
    expect(state.unitPlacements.has("u-low")).toBe(false);
  });
});

describe("runMinConflictsRepair stagnation", () => {
  it("stops re-queuing a gang that cannot be placed", () => {
    const dayStructure = [{ type: "CLASS" as const, label: "1" }];
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 1,
        daysPerWeek: 1,
        dayStructure,
        fixedOccasions: [[""]],
      },
      subjects: [
        { id: "s1", name: "Math", color: "#f00" },
        { id: "s2", name: "English", color: "#0f0" },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher 1",
          specialtyIds: ["s1", "s2"],
          constraints: [[false]],
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

    const stuck = makeLeader("u-stuck", 100);
    stuck.subjectId = "s2";
    stuck.teacherIds = ["t-blocked"];
    stuck.teacherNames = ["Blocked Teacher"];

    data.teachers.push({
      id: "t-blocked",
      name: "Blocked Teacher",
      specialtyIds: ["s2"],
      constraints: [[true]],
    });

    const gangMap = new Map<string, AllocationUnit[]>([
      [getGangId(stuck), [stuck]],
    ]);
    const unitMap = new Map<string, AllocationUnit>([[stuck.id, stuck]]);
    const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
    const classMap = new Map(data.classes.map((c) => [c.id, c]));
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const state = initializeState(data);

    runMinConflictsRepair(
      state,
      [getGangId(stuck)],
      gangMap,
      unitMap,
      data,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      MAX_GANG_REPAIR_ATTEMPTS + 5,
    );

    expect(state.unitPlacements.has("u-stuck")).toBe(false);
  });
});
