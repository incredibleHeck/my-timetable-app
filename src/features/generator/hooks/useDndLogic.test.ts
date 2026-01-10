import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useDndLogic } from "./useDndLogic";
import { AppData, ClassGroup, Subject, Teacher, ScheduleSlot } from "../../../types";
import { DragEndEvent } from "@dnd-kit/core";

// Mock ProfileContext
vi.mock("../../../contexts/ProfileContext", () => ({
  useProfile: () => ({
    pushToHistory: vi.fn(),
  }),
}));

// MOCK DATA FACTORY
const createMockData = (): AppData => ({
  settings: {
    periodsPerDay: 5,
    daysPerWeek: 5,
    dayStructure: ["CLASS", "CLASS", "CLASS", "CLASS", "CLASS"],
    fixedOccasions: {},
  },
  classes: [{ id: "c1", name: "Class 1", periodCount: 5 }] as ClassGroup[],
  teachers: [{ id: "t1", name: "Teacher 1" }] as Teacher[],
  subjects: [
    { id: "sub1", name: "Math", color: "red" },
    { id: "sub2", name: "English", color: "blue" },
    { id: "sub3", name: "Science", color: "green" },
    { id: "sub4", name: "History", color: "yellow" },
  ] as Subject[],
  rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "Classroom" }] as any,
  classrooms: [],
  schedule: {
    c1: {
      0: {
        // Day 0
        0: { subjectId: "sub1", teacherId: "t1", duration: 1, isFixed: false, roomId: "r1" }, // Single (P0)
        2: { subjectId: "sub2", teacherId: "t1", duration: 1, isFixed: false, roomId: "r1" }, // Double Start (P2)
        3: { subjectId: "sub2", teacherId: "t1", duration: 1, isFixed: true, roomId: "r1" },  // Double End (P3)
        4: { subjectId: "sub4", teacherId: "t1", duration: 1, isFixed: false, roomId: "r1" }, // Single (P4)
      },
      1: {
        // Day 1
        0: { subjectId: "sub3", teacherId: "t1", duration: 1, isFixed: false, roomId: "r1" }, // Double Start
        1: { subjectId: "sub3", teacherId: "t1", duration: 1, isFixed: true, roomId: "r1" },  // Double End
      }
    },
  },
  conflicts: [],
  jointClasses: [],
  electives: [],
  lastGenerated: null,
});

const createDragEvent = (
  source: { d: number, p: number, slot: ScheduleSlot, cId: string },
  target: { d: number, p: number } | null
): DragEndEvent => {
    return {
        active: {
            id: "active",
            data: {
                current: {
                    day: source.d,
                    period: source.p,
                    slot: source.slot,
                    classGroup: { id: source.cId }
                }
            },
            rect: { current: { translated: null } }
        },
        over: target ? {
            id: "over",
            data: {
                current: {
                    day: target.d,
                    period: target.p
                }
            },
            rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
            disabled: false,
        } : null,
        delta: { x: 0, y: 0 },
    } as unknown as DragEndEvent;
}

describe("useDndLogic", () => {
  it("should swap Single with Single", () => {
    const data = createMockData();
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDndLogic(data, "c1", "CLASS", onUpdate)
    );

    const sSlot = data.schedule.c1[0][0]; // Single
    const event = createDragEvent(
        { d: 0, p: 0, slot: sSlot, cId: "c1" },
        { d: 0, p: 4 } // Single
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it("should NOT swap Single with Double (Constraint)", () => {
    const data = createMockData();
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDndLogic(data, "c1", "CLASS", onUpdate)
    );

    const sSlot = data.schedule.c1[0][0]; // Single
    const event = createDragEvent(
        { d: 0, p: 0, slot: sSlot, cId: "c1" },
        { d: 0, p: 2 } // Double Start
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    // Should NOT update
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("should swap Double with Double", () => {
    const data = createMockData();
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDndLogic(data, "c1", "CLASS", onUpdate)
    );

    const dSlot = data.schedule.c1[0][2]; // Double
    const event = createDragEvent(
        { d: 0, p: 2, slot: dSlot, cId: "c1" },
        { d: 1, p: 0 } // Double
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it("should NOT move Double to Single Empty if P2 occupied", () => {
    const data = createMockData();
    // Setup: Day 2 P0 Empty, P1 Occupied
    if (!data.schedule.c1[2]) data.schedule.c1[2] = {};
    data.schedule.c1[2][1] = { subjectId: "x", teacherId: "x", duration: 1, isFixed: false };

    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDndLogic(data, "c1", "CLASS", onUpdate)
    );

    const dSlot = data.schedule.c1[0][2]; // Double
    const event = createDragEvent(
        { d: 0, p: 2, slot: dSlot, cId: "c1" },
        { d: 2, p: 0 } // Empty, but P1 occupied
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("should move Double to Empty (if P2 free)", () => {
    const data = createMockData();
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDndLogic(data, "c1", "CLASS", onUpdate)
    );

    const dSlot = data.schedule.c1[0][2]; // Double
    const event = createDragEvent(
        { d: 0, p: 2, slot: dSlot, cId: "c1" },
        { d: 2, p: 0 } // Empty, P1 also Empty
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    expect(onUpdate).toHaveBeenCalled();
  });
});
