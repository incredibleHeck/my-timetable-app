import { describe, it, expect } from "vitest";
import { getFormattedTimeRange, calculateClassSchedule } from "../src/utils/timeUtils";
import { ClassGroup } from "../src/features/classes/types";
import { Settings } from "../src/types";

describe("Export Header Logic", () => {
  const globalSettings: Partial<Settings> = {
    schoolStartTime: "08:00",
    defaultClassDuration: 40,
    defaultBreakDuration: 15,
    defaultLunchDuration: 45,
    timeSlots: [
      { start: "08:00", end: "08:40" },
      { start: "08:40", end: "09:20" },
    ],
  };

  const dayStructure = [
    { type: "CLASS" as const, label: "P1" },
    { type: "BREAK" as const, label: "Break" },
  ];

  it("should format time ranges correctly for CLASS mode with overrides", () => {
    const classGroup: Partial<ClassGroup> = {
      id: "c1",
      duration: 50,
      breakDuration: 10,
    };

    const schedule = calculateClassSchedule(
      classGroup as ClassGroup,
      globalSettings as Settings,
      dayStructure,
    );

    // P1 (50m): 08:00 - 08:50
    expect(getFormattedTimeRange(schedule[0])).toBe("08:00 - 08:50");

    // Break (10m): 08:50 - 09:00
    expect(getFormattedTimeRange(schedule[1])).toBe("08:50 - 09:00");
  });

  it("should fall back to global timeSlots for TEACHER mode (simulated)", () => {
    // In teacher mode, we use settings.timeSlots[p]
    const p0Time = globalSettings.timeSlots![0];
    expect(getFormattedTimeRange(p0Time)).toBe("08:00 - 08:40");
  });
});
