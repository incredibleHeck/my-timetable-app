import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SubjectsView } from "../src/features/subjects/SubjectsView";
import { AppData } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";

const mockAddActivity = vi.fn();

vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    addActivity: mockAddActivity,
  }),
}));

describe("SubjectsView", () => {
  const mockOnUpdate = vi.fn();

  const dataWithRooms = {
    ...DEFAULT_DATA,
    rooms: [{ id: "r-lab", name: "Computer Lab", type: "Lab", capacity: 30 }],
  } as AppData;

  it("offers a room requirement in the subject modal", () => {
    render(<SubjectsView data={dataWithRooms} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByText(/New Subject/i));

    expect(screen.getByLabelText(/Room requirement/i)).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(screen.getByText(/Computer Lab/i)).toBeDefined();
  });

  // The editor owns six fields but a Subject carries more. Rebuilding the record
  // from the form alone dropped exam paper settings and room preferences, so
  // renaming a subject quietly discarded its exam configuration.
  it("preserves fields the editor does not own when saving an edit", () => {
    mockAddActivity.mockClear();

    const data = {
      ...dataWithRooms,
      subjects: [
        {
          id: "s1",
          name: "Physics",
          color: "#ef4444",
          examPaperCount: 3,
          examPaperDurations: [60, 90, 45],
          requiredRoomType: "Lab",
          preferredRoomIds: ["r-lab"],
        },
      ],
      teachers: [],
      classes: [],
    } as unknown as AppData;

    render(<SubjectsView data={data} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Physics" }));
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: "Physics I" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Subject/i }));

    const [, , nextData] = mockAddActivity.mock.calls.at(-1) as [string, string, AppData];
    expect(nextData.subjects[0]).toMatchObject({
      name: "Physics I",
      examPaperCount: 3,
      examPaperDurations: [60, 90, 45],
      requiredRoomType: "Lab",
      preferredRoomIds: ["r-lab"],
    });
  });
});
