import { describe, it, expect } from "vitest";
import {
  countScheduleSlotsAtOrAfterPeriod,
  trimScheduleToPeriods,
} from "../src/features/configuration/logic/configUtils";
import { ScheduleResult } from "../src/features/generator/types";

describe("configUtils", () => {
  const schedule: ScheduleResult = {
    c1: {
      0: {
        0: { subjectId: "s1", teacherId: "t1", classId: "c1" },
        7: { subjectId: "s1", teacherId: "t1", classId: "c1" },
        8: { subjectId: "s2", teacherId: "t1", classId: "c1" },
      },
      1: {
        9: { subjectId: "s1", teacherId: "t1", classId: "c1" },
      },
    },
    c2: {
      0: {
        5: { subjectId: "s1", teacherId: "t2", classId: "c2" },
      },
    },
  };

  it("countScheduleSlotsAtOrAfterPeriod counts slots at or after index", () => {
    expect(countScheduleSlotsAtOrAfterPeriod(schedule, 7)).toBe(3);
    expect(countScheduleSlotsAtOrAfterPeriod(schedule, 8)).toBe(2);
    expect(countScheduleSlotsAtOrAfterPeriod(schedule, 10)).toBe(0);
    expect(countScheduleSlotsAtOrAfterPeriod(undefined, 5)).toBe(0);
  });

  it("trimScheduleToPeriods removes periods at or above limit", () => {
    const trimmed = trimScheduleToPeriods(schedule, 8);
    expect(trimmed.c1?.[0]?.[7]).toBeDefined();
    expect(trimmed.c1?.[0]?.[8]).toBeUndefined();
    expect(trimmed.c1?.[1]?.[9]).toBeUndefined();
    expect(Object.keys(trimmed.c1?.[1] ?? {})).toHaveLength(0);
    expect(trimmed.c2?.[0]?.[5]).toBeDefined();
  });

  it("trimScheduleToPeriods drops empty class entries", () => {
    const onlyHigh: ScheduleResult = {
      c1: { 0: { 10: { subjectId: "s", teacherId: "t", classId: "c1" } } },
    };
    const trimmed = trimScheduleToPeriods(onlyHigh, 8);
    expect(trimmed.c1).toBeUndefined();
  });
});
