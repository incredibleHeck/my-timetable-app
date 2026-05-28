import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ScheduleGrid } from "../src/features/generator/components/ScheduleGrid";
import { AppData } from "../src/types";

// Mock dnd-kit since we are only testing UI rendering of labels
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  PointerSensor: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    activeProfile: null,
    getClassSchedule: vi.fn().mockReturnValue([]),
  }),
}));

describe("ScheduleGrid UI Labels", () => {
  const mockData: Partial<AppData> = {
    settings: {
      periodsPerDay: 4,
      dayStructure: [
        { type: "CLASS", label: "P1" },
        { type: "CLASS", label: "P2" },
        { type: "BREAK", label: "Break" },
        { type: "CLASS", label: "P3" },
      ],
      schoolStartTime: "08:00",
      defaultClassDuration: 40,
      defaultBreakDuration: 15,
      defaultLunchDuration: 45,
      timeSlots: [],
      maxConsecutivePeriods: 5,
      fixedOccasions: [[], [], [], [], []],
    },
    classes: [{ id: "class-1", name: "Class 1", curriculum: [] }],
    teachers: [],
    subjects: [],
    schedule: {},
    conflicts: [],
    lastGenerated: null,
  };

  it("should render period labels with calculated times", () => {
    render(
      <ScheduleGrid
        data={mockData as AppData}
        activeId="class-1"
        mode="CLASS"
        onUpdate={() => {}}
        editMode={false}
      />,
    );

    // P1: 08:00 - 08:40
    expect(screen.getByText(/Period 1/)).toBeInTheDocument();
    expect(screen.getByText(/\(08:00 - 08:40\)/)).toBeInTheDocument();

    // P2: 08:40 - 09:20
    expect(screen.getByText(/Period 2/)).toBeInTheDocument();
    expect(screen.getByText(/\(08:40 - 09:20\)/)).toBeInTheDocument();

    // Break: 09:20 - 09:35
    expect(screen.getByText(/Break/)).toBeInTheDocument();
    expect(screen.getByText(/\(09:20 - 09:35\)/)).toBeInTheDocument();

    // P3: 09:35 - 10:15
    expect(screen.getByText(/Period 3/)).toBeInTheDocument();
    expect(screen.getByText(/\(09:35 - 10:15\)/)).toBeInTheDocument();
  });

  it("should update times when switching to a class with different durations", () => {
    const dataWithOverrides = {
      ...mockData,
      classes: [
        { id: "class-1", name: "Class 1", curriculum: [] },
        { id: "class-2", name: "Class 2", duration: 50, curriculum: [] },
      ],
    };

    const { rerender } = render(
      <ScheduleGrid
        data={dataWithOverrides as AppData}
        activeId="class-1"
        mode="CLASS"
        onUpdate={() => {}}
        editMode={false}
      />,
    );

    expect(screen.getByText(/\(08:00 - 08:40\)/)).toBeInTheDocument();

    rerender(
      <ScheduleGrid
        data={dataWithOverrides as AppData}
        activeId="class-2"
        mode="CLASS"
        onUpdate={() => {}}
        editMode={false}
      />,
    );

    expect(screen.getByText(/\(08:00 - 08:50\)/)).toBeInTheDocument();
  });
});
