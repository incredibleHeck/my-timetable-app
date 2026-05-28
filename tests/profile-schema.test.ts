import { describe, it, expect } from "vitest";
import { validateProfile } from "../src/types/profile";
import { parseAppData } from "../src/schemas/appData";

describe("Profile Schema", () => {
  const validSettings = {
    periodsPerDay: 5,
    dayStructure: [{ type: "CLASS" as const, label: "P1" }],
    fixedOccasions: [],
    timeSlots: [],
    maxConsecutivePeriods: 2,
  };

  it("should validate a correct profile", () => {
    const validProfile = {
      id: "p1",
      name: "Test Profile",
      created: 1234567890,
      lastModified: 1234567890,
      data: {
        settings: validSettings,
        subjects: [],
        teachers: [],
        rooms: [],
        classes: [],
        jointClasses: [],
        electives: [],
        exams: [],
        dutyLocations: [],
        schedule: {},
        conflicts: [],
        recentActivity: [],
        lastGenerated: null,
      },
      meta: { description: "A test" },
    };
    expect(validateProfile(validProfile)).toBe(true);
  });

  it("should reject missing required fields", () => {
    const invalidProfile = {
      name: "No ID",
    };
    expect(validateProfile(invalidProfile)).toBe(false);
  });

  it("should reject invalid types", () => {
    const invalidProfile = {
      id: 123,
      name: "Test",
    };
    expect(validateProfile(invalidProfile)).toBe(false);
  });

  it("should reject AppData missing settings", () => {
    const invalidProfile = {
      id: "p1",
      name: "Test",
      created: 1,
      lastModified: 1,
      data: { schedule: {} },
      meta: {},
    };
    expect(validateProfile(invalidProfile)).toBe(false);
  });
});

describe("parseAppData", () => {
  it("throws with readable message when settings is missing", () => {
    expect(() => parseAppData({ subjects: [] })).toThrow(/settings/i);
  });

  it("normalizes legacy fixed occasion values", () => {
    const data = parseAppData({
      settings: {
        periodsPerDay: 1,
        dayStructure: [{ type: "CLASS", label: "P1" }],
        fixedOccasions: [[true]],
        maxConsecutivePeriods: 2,
      },
    });
    expect(data.settings.fixedOccasions[0][0]).toBe("Reserved");
  });
});
