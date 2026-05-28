import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDndLogic } from "../src/features/generator/hooks/useDndLogic";
import { AppData, Teacher, Class, Subject } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";
import { mockPushToHistory } from "../vitest-setup";

describe("Scheduling Activity Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTeacher: Teacher = {
    id: "t1",
    name: "John Doe",
    specialtyIds: ["s1"],
    constraints: Array(5)
      .fill(null)
      .map(() => Array(8).fill(false)),
  };

  const mockClass: Class = {
    id: "c1",
    name: "10A",
    curriculum: [],
    defaultRoomId: "r1",
  };

  const mockSubject: Subject = {
    id: "s1",
    name: "Math",
    color: "#ff0000",
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1", isFixed: false },
        },
      },
    },
  };

  it("should log an activity when a lesson is moved", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDndLogic(baseData, "c1", "CLASS", onUpdate));

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "c1-0-0",
          data: {
            current: {
              day: 0,
              period: 0,
              slot: baseData.schedule["c1"][0][0],
              classGroup: mockClass,
            },
          },
        },
      } as never);
    });

    act(() => {
      result.current.handleDragEnd({
        active: {
          id: "c1-0-0",
          data: {
            current: {
              day: 0,
              period: 0,
              slot: baseData.schedule["c1"][0][0],
              classGroup: mockClass,
            },
          },
        },
        over: {
          id: "c1-0-1",
          data: {
            current: {
              day: 0,
              period: 1,
            },
          },
        },
      } as never);
    });

    expect(mockPushToHistory).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            type: "SCHEDULING",
            message: "Moved Math (John Doe) in 10A to Monday P2",
          }),
        ]),
      }),
    );
  });

  it("should log an activity when two lessons are swapped", () => {
    const swapData: AppData = {
      ...baseData,
      subjects: [...baseData.subjects, { id: "s2", name: "Science", color: "#00ff00" }],
      schedule: {
        c1: {
          0: {
            0: { subjectId: "s1", teacherId: "t1", classId: "c1", isFixed: false },
            1: { subjectId: "s2", teacherId: "t1", classId: "c1", isFixed: false },
          },
        },
      },
    };

    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDndLogic(swapData, "c1", "CLASS", onUpdate));

    act(() => {
      result.current.handleDragStart({
        active: {
          id: "c1-0-0",
          data: {
            current: {
              day: 0,
              period: 0,
              slot: swapData.schedule["c1"][0][0],
              classGroup: mockClass,
            },
          },
        },
      } as never);
    });

    act(() => {
      result.current.handleDragEnd({
        active: {
          id: "c1-0-0",
          data: {
            current: {
              day: 0,
              period: 0,
              slot: swapData.schedule["c1"][0][0],
              classGroup: mockClass,
            },
          },
        },
        over: {
          id: "c1-0-1",
          data: {
            current: {
              day: 0,
              period: 1,
              slot: swapData.schedule["c1"][0][1],
              classGroup: mockClass,
            },
          },
        },
      } as never);
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            type: "SCHEDULING",
            message: "Swapped Math with Science in 10A",
          }),
        ]),
      }),
    );
  });
});
