import { describe, it, expect } from "vitest";
import { Teacher } from "../src/features/teachers/types";

describe("Teacher Interface", () => {
  it("should allow setting maxPeriodsPerDay and targetLoad on a teacher", () => {
    const teacher: Teacher = {
      id: "t1",
      name: "John Doe",
      specialtyIds: [],
      constraints: [],
      maxPeriodsPerDay: 4,
      targetLoad: 20,
    };

    expect(teacher.maxPeriodsPerDay).toBe(4);
    expect(teacher.targetLoad).toBe(20);
  });
});
