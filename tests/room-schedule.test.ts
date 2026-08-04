import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import {
  getRoomOccupants,
  getSpecialistRooms,
  countRoomPeriods,
} from "../src/features/generator/utils/roomSchedule";

/**
 * A room's timetable is not a class's timetable with the labels swapped.
 * Several classes can legitimately occupy one room at the same period: on the
 * demo school every such case is a joint PE lesson, two year groups taught
 * together in one hall by one teacher. Reading only the first match would hide
 * the other class from the room's own schedule.
 */

function build(over: Partial<AppData> = {}): AppData {
  return {
    ...DEFAULT_DATA,
    subjects: [
      { id: "s-pe", name: "PE", color: "#0f0" },
      { id: "s-ict", name: "ICT", color: "#00f" },
    ],
    teachers: [
      { id: "t-ruth", name: "Aunty Ruth", specialtyIds: [], constraints: [] },
      { id: "t-eric", name: "Uncle Eric", specialtyIds: [], constraints: [] },
    ],
    classes: [
      { id: "c2a", name: "Year 2A", curriculum: [], defaultRoomId: "r-2a" },
      { id: "c2b", name: "Year 2B", curriculum: [], defaultRoomId: "r-2b" },
    ],
    rooms: [
      { id: "r-2a", name: "Year 2A Classroom", type: "Classroom", capacity: 30 },
      { id: "r-2b", name: "Year 2B Classroom", type: "Classroom", capacity: 30 },
      { id: "r-hall", name: "SPORTS HALL", type: "Hall", capacity: 60 },
      { id: "r-lab", name: "ICT LAB", type: "Computer Lab", capacity: 30 },
    ],
    schedule: {},
    ...over,
  } as unknown as AppData;
}

const slot = (subjectId: string, teacherId: string, roomId: string, classId: string) =>
  ({ subjectId, teacherId, roomId, classId, duration: 1 }) as never;

describe("getRoomOccupants", () => {
  it("collapses a joint lesson into one entry naming every class", () => {
    const data = build({
      schedule: {
        c2a: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2a") } },
        c2b: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2b") } },
      } as never,
    });

    const occupants = getRoomOccupants(data, "r-hall", 0, 3);

    expect(occupants).toHaveLength(1);
    expect(occupants[0].classNames).toEqual(["Year 2A", "Year 2B"]);
    expect(occupants[0].isContested).toBe(false);
  });

  it("keeps genuinely different lessons apart and flags them", () => {
    // Same room, same period, two different subjects and teachers: a real clash.
    const data = build({
      schedule: {
        c2a: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2a") } },
        c2b: { 0: { 3: slot("s-ict", "t-eric", "r-hall", "c2b") } },
      } as never,
    });

    const occupants = getRoomOccupants(data, "r-hall", 0, 3);

    expect(occupants).toHaveLength(2);
    expect(occupants.every((o) => o.isContested)).toBe(true);
  });

  it("returns nothing for an empty cell or an unknown room", () => {
    const data = build({
      schedule: { c2a: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2a") } } } as never,
    });

    expect(getRoomOccupants(data, "r-hall", 0, 4)).toEqual([]);
    expect(getRoomOccupants(data, "r-lab", 0, 3)).toEqual([]);
    expect(getRoomOccupants(data, "", 0, 3)).toEqual([]);
  });
});

describe("getSpecialistRooms", () => {
  it("excludes every class's home room", () => {
    const names = getSpecialistRooms(build()).map((r) => r.name);
    expect(names).toEqual(["SPORTS HALL", "ICT LAB"]);
  });

  it("keeps a room that no class calls home even if it looks ordinary", () => {
    const data = build({
      classes: [{ id: "c2a", name: "Year 2A", curriculum: [], defaultRoomId: "r-2a" }] as never,
    });
    // Year 2B's room is nobody's home now, so it is a bookable space.
    expect(getSpecialistRooms(data).map((r) => r.name)).toContain("Year 2B Classroom");
  });
});

describe("countRoomPeriods", () => {
  it("counts a joint lesson once, not once per class", () => {
    const data = build({
      schedule: {
        c2a: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2a") } },
        c2b: { 0: { 3: slot("s-pe", "t-ruth", "r-hall", "c2b") } },
      } as never,
    });
    // The hall is busy for one period, not two.
    expect(countRoomPeriods(data, "r-hall")).toBe(1);
  });

  it("adds up separate lessons across the week", () => {
    const data = build({
      schedule: {
        c2a: {
          0: { 3: slot("s-ict", "t-eric", "r-lab", "c2a") },
          1: { 2: slot("s-ict", "t-eric", "r-lab", "c2a") },
        },
        c2b: { 0: { 5: slot("s-ict", "t-eric", "r-lab", "c2b") } },
      } as never,
    });
    expect(countRoomPeriods(data, "r-lab")).toBe(3);
  });

  it("reports zero for a room nothing uses", () => {
    expect(countRoomPeriods(build(), "r-hall")).toBe(0);
  });
});
