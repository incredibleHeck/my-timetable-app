import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkloadStats } from "../src/features/workload/hooks/useWorkloadStats";
import { AppData } from "../src/types";

describe("useWorkloadStats - Elective Blocks", () => {
  const mockData: Partial<AppData> = {
    settings: {
      periodsPerDay: 8,
      dayStructure: [
        { type: "CLASS", label: "1" },
        { type: "CLASS", label: "2" },
        { type: "BREAK", label: "B" },
        { type: "CLASS", label: "3" },
      ],
      fixedOccasions: [],
      timeSlots: [],
      maxConsecutivePeriods: 4,
    } as any,
    teachers: [{ id: "t1", name: "Teacher 1", constraints: [[], [], [], [], []] } as any],
    classes: [
      {
        id: "c1",
        name: "Class 1",
        curriculum: [{ id: "curr1", subjectId: "s1", periodsPerWeek: 3, assignedTeacherId: "t1" }],
      },
      {
        id: "c2",
        name: "Class 2",
        curriculum: [{ id: "curr2", subjectId: "s1", periodsPerWeek: 3, assignedTeacherId: "t1" }],
      },
    ] as any,
    jointClasses: [],
    electives: [{ id: "e1", name: "Elective 1", classIds: ["c1", "c2"], subjectIds: ["s1"] }],
    schedule: {
      c1: { 0: { 0: { subjectId: "s1", teacherId: "t1", isFixed: false } } },
      c2: { 0: { 0: { subjectId: "s1", teacherId: "t1", isFixed: false } } },
    },
    subjects: [],
    rooms: [],
    conflicts: [],
    lastGenerated: null,
  };

  it("should de-duplicate requested workload for elective blocks", () => {
    const { result } = renderHook(() => useWorkloadStats(mockData as AppData));
    const stat = result.current.workloadStats.find((s) => s.t.id === "t1");

    // Elective block 'e1' for c1 and c2 should count as 3 periods total, not 6
    expect(stat?.assignedPeriods).toBe(3);
  });

  it("should de-duplicate scheduled workload for elective blocks", () => {
    // This should already work because it uses unique (Day, Period) slots,
    // but let's verify it explicitly in this context.
    const { result } = renderHook(() => useWorkloadStats(mockData as AppData));
    const stat = result.current.workloadStats.find((s) => s.t.id === "t1");

    expect(stat?.scheduledPeriods).toBe(1);
  });

  it("should respect JointClass teacherId override even if curriculum has different teacher", () => {
    const overrideData: Partial<AppData> = {
      ...mockData,
      teachers: [
        { id: "t1", name: "Teacher 1", constraints: [] } as any,
        { id: "t2", name: "Teacher 2", constraints: [] } as any,
      ],
      classes: [
        {
          id: "c3",
          name: "Class 3",
          curriculum: [
            { id: "curr3", subjectId: "s3", periodsPerWeek: 4, assignedTeacherId: "t2" },
          ],
        },
      ] as any,
      jointClasses: [
        { id: "j2", name: "Joint S3", subjectId: "s3", classIds: ["c3"], teacherId: "t1" },
      ],
      schedule: {},
    };

    const { result } = renderHook(() => useWorkloadStats(overrideData as AppData));
    const statT1 = result.current.workloadStats.find((s) => s.t.id === "t1");
    const statT2 = result.current.workloadStats.find((s) => s.t.id === "t2");

    // T1 should have 4 periods because of JC override
    expect(statT1?.assignedPeriods).toBe(4);
    // T2 should have 0 periods because they were overridden
    expect(statT2?.assignedPeriods).toBe(0);
  });
});
