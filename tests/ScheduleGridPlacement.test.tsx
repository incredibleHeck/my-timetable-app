import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ScheduleGrid } from "../src/features/generator/components/ScheduleGrid";
import { AppData } from "../src/types";

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
  useProfile: () => ({ activeProfile: null, getClassSchedule: vi.fn().mockReturnValue([]) }),
}));

vi.mock("../src/contexts/HistoryContext", () => ({
  useHistory: () => ({ pushToHistory: vi.fn() }),
}));

const settings = {
  periodsPerDay: 3,
  dayStructure: [
    { type: "CLASS", label: "P1" },
    { type: "CLASS", label: "P2" },
    { type: "CLASS", label: "P3" },
  ],
  schoolStartTime: "08:00",
  defaultClassDuration: 40,
  defaultBreakDuration: 15,
  defaultLunchDuration: 45,
  timeSlots: [],
  maxConsecutivePeriods: 5,
  fixedOccasions: [[], [], [], [], []],
};

const buildData = (periodsPerWeek: number): AppData =>
  ({
    settings,
    subjects: [{ id: "s1", name: "Maths", color: "#2dd4bf" }],
    teachers: [{ id: "t1", name: "Alice", specialtyIds: ["s1"], constraints: [] }],
    classes: [
      {
        id: "class-1",
        name: "Class 1",
        defaultRoomId: "",
        curriculum: [
          {
            id: "cur1",
            subjectId: "s1",
            periodsPerWeek,
            singles: periodsPerWeek,
            doubles: 0,
            assignedTeacherId: "t1",
          },
        ],
      },
    ],
    rooms: [],
    jointClasses: [],
    electives: [],
    schedule: {},
    conflicts: [],
    lastGenerated: null,
  }) as unknown as AppData;

/**
 * Placing an unplaced lesson used to require turning on "Edit", then turning on
 * "Manual Placement" inside it. The affordance is now gated on the only thing
 * that actually decides whether it can do anything: does this class have lessons
 * the solver could not place?
 */
describe("ScheduleGrid unplaced-lesson placement", () => {
  it("offers empty slots when the class has lessons still to place", () => {
    render(
      <ScheduleGrid data={buildData(2)} activeId="class-1" mode="CLASS" onUpdate={() => {}} />,
    );

    expect(
      screen.getAllByRole("button", { name: "Place an unplaced lesson here" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/unplaced/i)).toBeInTheDocument();
  });

  it("leaves the grid alone when nothing is waiting to be placed", () => {
    render(
      <ScheduleGrid data={buildData(0)} activeId="class-1" mode="CLASS" onUpdate={() => {}} />,
    );

    expect(screen.queryByRole("button", { name: "Place an unplaced lesson here" })).toBeNull();
    expect(screen.queryByText(/unplaced/i)).toBeNull();
  });

  // Removing the edit mode also removed the only text saying the grid responds
  // to a drag, which made a permanently-editable grid look permanently locked.
  // A complete timetable is exactly when someone wants to swap two periods.
  it("still says lessons can be dragged when the timetable is complete", () => {
    render(
      <ScheduleGrid data={buildData(0)} activeId="class-1" mode="CLASS" onUpdate={() => {}} />,
    );

    expect(screen.getByText(/drag a lesson onto another slot/i)).toBeInTheDocument();
  });

  it("never offers placement on the read-only room view", () => {
    render(<ScheduleGrid data={buildData(2)} activeId="r1" mode="ROOM" onUpdate={() => {}} />);

    expect(screen.queryByRole("button", { name: "Place an unplaced lesson here" })).toBeNull();
    expect(screen.getByText(/read-only view/i)).toBeInTheDocument();
  });
});
