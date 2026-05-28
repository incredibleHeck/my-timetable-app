import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClassAssignmentsPanel } from "../src/features/classes/components/ClassAssignmentsPanel";
import { describe, it, expect, vi } from "vitest";
import { AppData } from "../src/types";

import { mockPushToHistory } from "../vitest-setup";

describe("ClassAssignmentsPanel Undo Integration", () => {
  const mockData: AppData = {
    settings: {
      periodsPerDay: 5,
      dayStructure: [],
      timeSlots: [],
      maxConsecutivePeriods: 4,
      fixedOccasions: [],
    },
    classes: [
      {
        id: "c1",
        name: "Class 1",
        curriculum: [{ id: "cur1", subjectId: "sub1", periodsPerWeek: 3, singles: 1, doubles: 1 }],
      } as any,
    ],
    teachers: [{ id: "t1", name: "Teacher 1", specialtyIds: ["sub1"], constraints: [] } as any],
    subjects: [{ id: "sub1", name: "Math", color: "red" } as any],
    rooms: [],
    schedule: {},
    conflicts: [],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    dutyAssignments: [],
    lastGenerated: null,
  };

  it("pushes to history when assigning a teacher", async () => {
    mockPushToHistory.mockClear();
    const onUpdate = vi.fn();
    const { container } = render(<ClassAssignmentsPanel data={mockData} onUpdate={onUpdate} />);

    // Select Class (First select)
    const selects = container.querySelectorAll("select");
    const classSelect = selects[0];
    fireEvent.change(classSelect, { target: { value: "c1" } });

    // Select Teacher (Second select)
    const teacherSelect = selects[1];
    fireEvent.change(teacherSelect, { target: { value: "t1" } });

    // Click Assign
    const assignBtn = screen.getByText("Assign to Class");
    expect(assignBtn).not.toBeDisabled();

    fireEvent.click(assignBtn);

    expect(mockPushToHistory).toHaveBeenCalledWith(mockData);
    expect(onUpdate).toHaveBeenCalled();
  });
});
