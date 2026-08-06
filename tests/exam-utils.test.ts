import { describe, it, expect } from "vitest";
import {
  getPeriodIndicesOverlapping,
  getWeekKey,
  pickExamRoom,
  getExamGridDefaults,
  getExamSessionColumns,
  getSessionIndexForStartTime,
  seededShuffle,
} from "../src/features/exams/logic/examUtils";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("examUtils", () => {
  const timeSlots = [
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "13:00", end: "14:00" },
  ];

  it("returns multiple overlapping period indices", () => {
    const indices = getPeriodIndicesOverlapping(timeSlots, 9 * 60 + 30, 10 * 60 + 30);
    expect(indices).toContain(1);
    expect(indices).toContain(2);
  });

  it("produces stable week keys", () => {
    expect(getWeekKey("2026-06-03")).toBe(getWeekKey("2026-06-05"));
    expect(getWeekKey("2026-06-03")).not.toBe(getWeekKey("2026-06-10"));
  });

  it("seats a class in its own home room", () => {
    const classes = [
      { id: "c1", name: "10A", defaultRoomId: "r1", studentCount: 25, curriculum: [] },
    ];
    const rooms = [
      { id: "r1", name: "10A Classroom", capacity: 30, type: "Classroom", isHomeRoom: true },
      { id: "r2", name: "Small", capacity: 10, type: "Classroom" },
    ];
    expect(pickExamRoom(["c1"], classes as any, rooms as any)).toBe("r1");
  });

  // Teaching is suspended during exams, so a class always sits in its own home
  // room even when its cohort would outgrow it — the picker no longer reaches
  // for a smaller "fitting" room and stops sending two cohorts to the same one.
  it("keeps the home room even when the cohort exceeds its capacity", () => {
    const classes = [
      { id: "c1", name: "10A", defaultRoomId: "r1", studentCount: 40, curriculum: [] },
    ];
    const rooms = [
      { id: "r1", name: "10A Classroom", capacity: 30, type: "Classroom", isHomeRoom: true },
      { id: "hall", name: "Main Hall", capacity: 200, type: "Hall" },
    ];
    expect(pickExamRoom(["c1"], classes as any, rooms as any)).toBe("r1");
  });

  // A multi-class sitting has no single venue — each class stays in its own
  // room, resolved per class after invigilation splits the exam.
  it("returns no shared room for a multi-class sitting", () => {
    const classes = [
      { id: "c1", name: "10A", defaultRoomId: "r1", studentCount: 25, curriculum: [] },
      { id: "c2", name: "10B", defaultRoomId: "r2", studentCount: 25, curriculum: [] },
    ];
    const rooms = [
      { id: "r1", name: "10A Classroom", capacity: 30, type: "Classroom", isHomeRoom: true },
      { id: "r2", name: "10B Classroom", capacity: 30, type: "Classroom", isHomeRoom: true },
    ];
    expect(pickExamRoom(["c1", "c2"], classes as any, rooms as any)).toBeUndefined();
  });

  it("derives exam grid defaults from settings", () => {
    const defaults = getExamGridDefaults({
      ...DEFAULT_DATA.settings,
      examGrid: {
        sessionCutoff: "12:00",
        session1DefaultTime: "08:30",
        session2DefaultTime: "13:30",
      },
    });
    expect(defaults.sessionCutoff).toBe("12:00");
    expect(defaults.session1DefaultTime).toBe("08:30");
    expect(defaults.session2DefaultTime).toBe("13:30");
    expect(defaults.columns).toHaveLength(2);
  });

  it("builds a single session column when sessionsPerDay is 1", () => {
    const columns = getExamSessionColumns({
      ...DEFAULT_DATA.settings,
      examGrid: { sessionsPerDay: 1 },
    });
    expect(columns).toHaveLength(1);
    expect(getSessionIndexForStartTime("10:00", columns)).toBe(0);
  });

  it("seeded shuffle is deterministic", () => {
    const input = [1, 2, 3, 4, 5];
    expect(seededShuffle(input, 99)).toEqual(seededShuffle(input, 99));
  });
});
