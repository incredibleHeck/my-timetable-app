import { describe, it, expect } from "vitest";
import { runPreflightCheck } from "../src/features/generator/scheduler/validation/preflight";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

describe("runPreflightCheck", () => {
  it("returns error when curriculum exceeds weekly class slots", () => {
    const data: AppData = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 4,
        dayStructure: Array(4).fill({ type: "CLASS", label: "P" }),
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          curriculum: [{ subjectId: "s1", singles: 25, doubles: 0, assignedTeacherId: "t1" }],
        },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher One",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(4).fill(false)),
        },
      ],
      subjects: [{ id: "s1", name: "Math", color: "#000" }],
      schedule: {},
    };

    const result = runPreflightCheck(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.className === "10A")).toBe(true);
  });

  it("passes when curriculum fits available slots", () => {
    const data: AppData = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 6,
        dayStructure: Array(6).fill({ type: "CLASS", label: "P" }),
      },
      classes: [
        {
          id: "c1",
          name: "10A",
          curriculum: [{ subjectId: "s1", singles: 4, doubles: 0, assignedTeacherId: "t1" }],
        },
      ],
      teachers: [
        {
          id: "t1",
          name: "Teacher One",
          specialtyIds: ["s1"],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(6).fill(false)),
        },
      ],
      subjects: [{ id: "s1", name: "Math", color: "#000" }],
      schedule: {},
    };

    const result = runPreflightCheck(data);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
