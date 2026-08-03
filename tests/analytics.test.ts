import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAnalytics } from "../src/features/workload/hooks/useAnalytics";
import { AppData } from "../src/types";

// Day structure: P1(class) P2(class) BREAK P3(class) => teaching indices [0,1,3]
const makeData = (): AppData =>
  ({
    settings: {
      periodsPerDay: 4,
      daysPerWeek: 5,
      dayStructure: [
        { type: "CLASS", label: "P1" },
        { type: "CLASS", label: "P2" },
        { type: "BREAK", label: "Recess" },
        { type: "CLASS", label: "P3" },
      ],
      fixedOccasions: [],
      timeSlots: [],
      maxConsecutivePeriods: 4,
    },
    subjects: [
      { id: "s1", name: "Math", color: "#111" },
      { id: "s2", name: "Art", color: "#222" },
    ],
    teachers: [
      { id: "t1", name: "Ada", specialtyIds: [], constraints: [] },
      { id: "t2", name: "Bo", specialtyIds: [], constraints: [] },
    ],
    rooms: [
      { id: "r1", name: "Room 101", capacity: 30, type: "std" },
      { id: "r2", name: "Lab", capacity: 20, type: "lab", isHomeRoom: false },
    ],
    classes: [{ id: "c1", name: "7A", defaultRoomId: "r1", curriculum: [] }],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    schedule: {
      c1: {
        // Monday: t1 teaches P1 (idx0) and P3 (idx3) in r1 => a gap at idx1
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1", roomId: "r1" },
          3: { subjectId: "s2", teacherId: "t1", classId: "c1", roomId: "r1" },
        },
        // Tuesday: t2 teaches P1+P2 consecutively in r2 => no gap
        1: {
          0: { subjectId: "s1", teacherId: "t2", classId: "c1", roomId: "r2" },
          1: { subjectId: "s1", teacherId: "t2", classId: "c1", roomId: "r2" },
        },
      },
    },
    conflicts: [],
    lastGenerated: "2026-08-01",
    recentActivity: [],
  }) as unknown as AppData;

describe("useAnalytics", () => {
  it("reports totals and teaching capacity per week", () => {
    const { result } = renderHook(() => useAnalytics(makeData()));
    // 3 teaching periods/day * 5 days
    expect(result.current.summary.teachingSlotsPerWeek).toBe(15);
    expect(result.current.summary.totalLessons).toBe(4);
    expect(result.current.hasSchedule).toBe(true);
  });

  it("computes room occupancy against weekly teaching capacity", () => {
    const { result } = renderHook(() => useAnalytics(makeData()));
    const r1 = result.current.rooms.find((r) => r.roomId === "r1")!;
    const r2 = result.current.rooms.find((r) => r.roomId === "r2")!;
    // r1: 2 occupied of 15 => 13.3%, r2: 2 of 15 => 13.3%
    expect(r1.occupiedSlots).toBe(2);
    expect(r1.occupancyPct).toBeCloseTo(13.3, 1);
    expect(r2.occupiedSlots).toBe(2);
  });

  it("detects teacher gap periods between first and last lesson of a day", () => {
    const { result } = renderHook(() => useAnalytics(makeData()));
    const ada = result.current.teacherGaps.find((t) => t.teacherId === "t1")!;
    const bo = result.current.teacherGaps.find((t) => t.teacherId === "t2")!;
    // Ada: P1 and P3 with idle P2 between => 1 gap
    expect(ada.teachingPeriods).toBe(2);
    expect(ada.gapPeriods).toBe(1);
    // Bo: consecutive P1+P2 => no gaps
    expect(bo.teachingPeriods).toBe(2);
    expect(bo.gapPeriods).toBe(0);
    expect(result.current.summary.totalGapPeriods).toBe(1);
  });

  it("builds subject distribution sorted by periods and excludes unused subjects", () => {
    const { result } = renderHook(() => useAnalytics(makeData()));
    const subjects = result.current.subjects;
    // s1 appears 3x, s2 appears 1x
    expect(subjects[0].subjectId).toBe("s1");
    expect(subjects[0].periods).toBe(3);
    expect(subjects[0].pct).toBeCloseTo(75, 0);
    expect(subjects.find((s) => s.subjectId === "s2")?.periods).toBe(1);
  });

  it("handles an empty schedule without dividing by zero", () => {
    const data = makeData();
    data.schedule = {};
    const { result } = renderHook(() => useAnalytics(data));
    expect(result.current.hasSchedule).toBe(false);
    expect(result.current.summary.totalLessons).toBe(0);
    expect(result.current.summary.avgRoomOccupancyPct).toBe(0);
    expect(result.current.subjects).toHaveLength(0);
  });
});
