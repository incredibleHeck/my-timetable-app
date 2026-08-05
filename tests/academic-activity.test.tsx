import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeachersView } from "../src/features/teachers/TeachersView";
import { RoomsView } from "../src/features/rooms/RoomsView";
import { AppData } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";
import React from "react";

// Mock useProfile
const mockAddActivity = vi.fn();
vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    addActivity: mockAddActivity,
    profiles: [],
    activeProfile: { name: "Test" },
    isLoading: false,
    isSaving: false,
  }),
}));

describe("Academic Activity Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseData: AppData = {
    ...DEFAULT_DATA,
    teachers: [{ id: "t1", name: "John Doe", specialtyIds: [], constraints: [] }],
    rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "Classroom" }],
  };

  it("should log an activity when a teacher is duplicated", async () => {
    const onUpdate = vi.fn();
    render(<TeachersView data={baseData} onUpdate={onUpdate} />);

    const duplicateButton = screen.getByTitle("Duplicate John Doe");
    fireEvent.click(duplicateButton);

    expect(mockAddActivity).toHaveBeenCalledWith(
      "ACADEMIC",
      "Duplicated Teacher: John Doe",
      expect.any(Object),
    );
  });

  it("should log an activity when a room is added", async () => {
    const onUpdate = vi.fn();
    render(<RoomsView data={baseData} onUpdate={onUpdate} />);

    // Open modal
    const addButtons = screen.getAllByText("Add Room");
    fireEvent.click(addButtons[0]); // The first one is the main button

    // Fill form
    fireEvent.change(screen.getByLabelText("Room Name/Number"), { target: { value: "New Room" } });

    // Save
    fireEvent.click(screen.getByText("Save Room"));

    expect(mockAddActivity).toHaveBeenCalledWith(
      "ACADEMIC",
      "Added Room: New Room",
      expect.any(Object),
    );
  });
});
