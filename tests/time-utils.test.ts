import { describe, it, expect } from "vitest";
import {
  getEffectiveDuration,
  calculateClassSchedule,
  doTimeRangesOverlap,
} from "../src/utils/timeUtils";
import { ClassGroup } from "../src/features/classes/types";
import { Settings } from "../src/types";

describe("timeUtils - getEffectiveDuration", () => {
  const globalSettings: Partial<Settings> = {
    defaultClassDuration: 40,
    defaultBreakDuration: 15,
    defaultLunchDuration: 45,
  };

  it("should use global defaults when class overrides are missing", () => {
    const classGroup: Partial<ClassGroup> = {
      id: "class-1",
      name: "Class 1",
    };

    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "CLASS"),
    ).toBe(40);
    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "BREAK"),
    ).toBe(15);
    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "LUNCH"),
    ).toBe(45);
  });

  it("should prioritize class overrides over global defaults", () => {
    const classGroup: Partial<ClassGroup> = {
      id: "class-1",
      name: "Class 1",
      duration: 50,
      breakDuration: 20,
      lunchDuration: 60,
    };

    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "CLASS"),
    ).toBe(50);
    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "BREAK"),
    ).toBe(20);
    expect(
      getEffectiveDuration(classGroup as ClassGroup, globalSettings as Settings, "LUNCH"),
    ).toBe(60);
  });

  it("should return a fallback value if neither is defined", () => {
    const emptyClass: Partial<ClassGroup> = {};
    const emptyGlobal: Partial<Settings> = {};

    expect(getEffectiveDuration(emptyClass as ClassGroup, emptyGlobal as Settings, "CLASS")).toBe(
      40,
    ); // Default fallback
  });
});

describe("timeUtils - calculateClassSchedule", () => {
  const globalSettings: Partial<Settings> = {
    schoolStartTime: "08:00",
    defaultClassDuration: 40,
    defaultBreakDuration: 15,
    defaultLunchDuration: 45,
  };

  const dayStructure = [
    { type: "CLASS" as const, label: "P1" },
    { type: "CLASS" as const, label: "P2" },
    { type: "BREAK" as const, label: "Break" },
    { type: "CLASS" as const, label: "P3" },
    { type: "LUNCH" as const, label: "Lunch" },
    { type: "CLASS" as const, label: "P4" },
  ];

  it("should calculate correct times with global defaults", () => {
    const classGroup: Partial<ClassGroup> = { id: "c1", name: "Class 1" };
    const schedule = calculateClassSchedule(
      classGroup as ClassGroup,
      globalSettings as Settings,
      dayStructure,
    );

    expect(schedule[0]).toEqual({ start: "08:00", end: "08:40" }); // P1
    expect(schedule[1]).toEqual({ start: "08:40", end: "09:20" }); // P2
    expect(schedule[2]).toEqual({ start: "09:20", end: "09:35" }); // Break
    expect(schedule[3]).toEqual({ start: "09:35", end: "10:15" }); // P3
    expect(schedule[4]).toEqual({ start: "10:15", end: "11:00" }); // Lunch
    expect(schedule[5]).toEqual({ start: "11:00", end: "11:40" }); // P4
  });

  it("should calculate correct times with class overrides", () => {
    const classGroup: Partial<ClassGroup> = {
      id: "c1",
      name: "Class 1",
      duration: 50,
      breakDuration: 10,
    };
    const schedule = calculateClassSchedule(
      classGroup as ClassGroup,
      globalSettings as Settings,
      dayStructure,
    );

    expect(schedule[0]).toEqual({ start: "08:00", end: "08:50" }); // P1 (50m)
    expect(schedule[1]).toEqual({ start: "08:50", end: "09:40" }); // P2 (50m)
    expect(schedule[2]).toEqual({ start: "09:40", end: "09:50" }); // Break (10m)
    expect(schedule[3]).toEqual({ start: "09:50", end: "10:40" }); // P3 (50m)
    expect(schedule[4]).toEqual({ start: "10:40", end: "11:25" }); // Lunch (45m global)
    expect(schedule[5]).toEqual({ start: "11:25", end: "12:15" }); // P4 (50m)
  });

  it("should handle different school start times", () => {
    const classGroup: Partial<ClassGroup> = { id: "c1", name: "Class 1" };
    const lateGlobal = { ...globalSettings, schoolStartTime: "09:00" };
    const schedule = calculateClassSchedule(
      classGroup as ClassGroup,
      lateGlobal as Settings,
      dayStructure,
    );

    expect(schedule[0].start).toBe("09:00");
    expect(schedule[0].end).toBe("09:40");
  });
});

describe("timeUtils - doTimeRangesOverlap", () => {
  it("should return true for overlapping ranges", () => {
    expect(
      doTimeRangesOverlap({ start: "08:00", end: "08:40" }, { start: "08:30", end: "09:10" }),
    ).toBe(true);
  });

  it("should return true for fully contained ranges", () => {
    expect(
      doTimeRangesOverlap({ start: "08:00", end: "09:00" }, { start: "08:15", end: "08:45" }),
    ).toBe(true);
  });

  it("should return false for non-overlapping ranges", () => {
    expect(
      doTimeRangesOverlap({ start: "08:00", end: "08:40" }, { start: "08:40", end: "09:20" }),
    ).toBe(false); // Touching is not overlapping

    expect(
      doTimeRangesOverlap({ start: "08:00", end: "08:40" }, { start: "09:00", end: "09:40" }),
    ).toBe(false);
  });
});
