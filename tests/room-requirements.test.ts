import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import { AllocationUnit } from "../src/features/generator/scheduler/core/types";
import { initializeState } from "../src/features/generator/scheduler/core/state";
import { getRoomCandidates, determineRoom } from "../src/features/generator/scheduler/logic/rooms";

/**
 * A subject can be tied to a facility two ways: a specific room
 * (`requiredRoomId`, the "Fixed Facility / Room" picker) or a kind of room
 * (`requiredRoomType`).
 *
 * The second never worked. Candidates were assembled with the class's home
 * classroom added *before* any type-matched room, and the resolver takes the
 * first candidate that is free — so the home classroom, which is almost always
 * free, won every time. A school could mark ICT as needing a Computer Lab and
 * watch every ICT lesson be scheduled in the ordinary classroom, with the lab
 * reporting 0% utilisation.
 */

const PERIODS = 4;
const DAYS = 1;

function build(subject: Partial<AppData["subjects"][number]>): AppData {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: PERIODS,
      daysPerWeek: DAYS,
      dayStructure: Array.from({ length: PERIODS }, (_, i) => ({
        type: "CLASS" as const,
        label: `P${i + 1}`,
      })),
      fixedOccasions: [Array.from({ length: PERIODS }, () => "")],
    },
    subjects: [{ id: "s-ict", name: "ICT", color: "#00f", ...subject }],
    teachers: [
      {
        id: "t1",
        name: "T1",
        specialtyIds: ["s-ict"],
        constraints: [[false, false, false, false]],
      },
    ],
    classes: [
      {
        id: "c1",
        name: "Year 4A",
        curriculum: [],
        defaultRoomId: "r-home",
        periodCount: PERIODS,
      },
    ],
    rooms: [
      { id: "r-home", name: "Year 4A Classroom", type: "Classroom", capacity: 30 },
      { id: "r-lab", name: "ICT LAB", type: "Computer Lab", capacity: 30 },
      { id: "r-music", name: "MUSIC ROOM", type: "Music Room", capacity: 30 },
    ],
    schedule: {},
  } as unknown as AppData;
}

function unit(over: Partial<AllocationUnit> = {}): AllocationUnit {
  return {
    id: "u1",
    subjectId: "s-ict",
    subjectName: "ICT",
    duration: 1,
    classIds: ["c1"],
    classNames: ["Year 4A"],
    teacherIds: ["t1"],
    teacherNames: ["T1"],
    priority: 10,
    rankLevel: 10,
    defaultRoomId: "r-home",
    ...over,
  };
}

function resolve(data: AppData, u: AllocationUnit) {
  const state = initializeState(data);
  return determineRoom(
    0,
    0,
    -1,
    u,
    state,
    data,
    new Map(data.subjects.map((s) => [s.id, s])),
    new Map(data.classes.map((c) => [c.id, c])),
    new Map(data.rooms.map((r) => [r.id, r])),
  );
}

describe("room requirements", () => {
  it("sends a subject to its fixed room when one is set", () => {
    const data = build({ requiredRoomId: "r-lab" });
    expect(resolve(data, unit())).toBe("r-lab");
  });

  it("sends a subject to a room of the required type", () => {
    const data = build({ requiredRoomType: "Computer Lab" });
    // The home classroom is free and would previously have been chosen.
    expect(resolve(data, unit({ requiredRoomType: "Computer Lab" }))).toBe("r-lab");
  });

  it("does not offer the home classroom when a room type is required", () => {
    const data = build({ requiredRoomType: "Computer Lab" });
    const candidates = getRoomCandidates(
      unit({ requiredRoomType: "Computer Lab" }),
      data.subjects[0],
      data.classes[0],
      new Map(data.rooms.map((r) => [r.id, r])),
    );
    expect(candidates).toEqual(["r-lab"]);
    expect(candidates).not.toContain("r-home");
  });

  it("uses the home classroom when nothing is required", () => {
    const data = build({});
    expect(resolve(data, unit())).toBe("r-home");
  });

  it("marking a subject as a shared resource does not by itself demand a room", () => {
    // `isSingleResource` means one class at a time, not one particular room.
    // It used to resolve to a "Specialist Room" type that no room can have,
    // which silently matched nothing.
    const data = build({ isSingleResource: true });
    expect(resolve(data, unit())).toBe("r-home");
  });
});
