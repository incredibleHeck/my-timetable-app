import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useGlobalConfig } from "../src/features/configuration/hooks/useGlobalConfig";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("useGlobalConfig", () => {
  it("updateMaxSubjectPeriodsPerDay returns updated settings", () => {
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA));

    let next: ReturnType<typeof result.current.updateMaxSubjectPeriods> | undefined;
    act(() => {
      next = result.current.updateMaxSubjectPeriods(3);
    });

    expect(next!.settings.maxSubjectPeriodsPerDay).toBe(3);
  });

  it("updateMaxTeachingPeriodsPerWeek returns updated settings", () => {
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA));

    let next: ReturnType<typeof result.current.updateMaxTeachingPeriodsPerWeek> | undefined;
    act(() => {
      next = result.current.updateMaxTeachingPeriodsPerWeek(30);
    });

    expect(next!.settings.maxTeachingPeriodsPerWeek).toBe(30);
  });

  it("updateMaxTeacherPeriodsPerDay returns updated settings", () => {
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA));

    let next: ReturnType<typeof result.current.updateMaxTeacherPeriods> | undefined;
    act(() => {
      next = result.current.updateMaxTeacherPeriods(8);
    });

    expect(next!.settings.maxTeacherPeriodsPerDay).toBe(8);
  });

  it("handlePeriodCountChange trims schedule when decreasing periods", () => {
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 10,
        dayStructure: Array(10)
          .fill(null)
          .map((_, i) => ({ type: "CLASS" as const, label: `P${i + 1}` })),
      },
      schedule: {
        c1: {
          0: {
            9: {
              subjectId: "s1",
              teacherId: "t1",
              classId: "c1",
            },
          },
        },
      },
    };

    const { result } = renderHook(() => useGlobalConfig(data));

    let next: ReturnType<typeof result.current.handlePeriodCountChange> | undefined;
    act(() => {
      next = result.current.handlePeriodCountChange(8);
    });

    expect(next!.settings.periodsPerDay).toBe(8);
    expect(next!.settings.dayStructure).toHaveLength(8);
    expect(next!.schedule?.c1?.[0]?.[9]).toBeUndefined();
  });

  it("setPeriodType updates structure and recalculates times", () => {
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA));

    let next: ReturnType<typeof result.current.setPeriodType> | undefined;
    act(() => {
      next = result.current.setPeriodType(0, "BREAK");
    });

    expect(next!.settings.dayStructure[0].type).toBe("BREAK");
    expect(next!.settings.dayStructure[0].label).toBe("Break");
    expect(next!.settings.timeSlots.length).toBeGreaterThan(0);
  });
});
