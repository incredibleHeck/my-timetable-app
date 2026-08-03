import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DutyView } from "../src/features/duty/DutyView";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, DutyRoster } from "../src/types";

describe("DutyView", () => {
  const mockOnUpdate = vi.fn();
  const mockOnNavigate = vi.fn();

  const mockRoster: DutyRoster = {
    id: "r1",
    name: "Test Roster",
    type: "DAILY",
    dailyAssignments: [{ id: "a1", day: 0, period: 0, locationId: "general", teacherId: "t1" }],
    weeklyAssignments: [],
    dailyParams: { min: 4, max: 6 },
    weeklyParams: { min: 4, max: 6, weeks: 4 },
    createdAt: new Date().toISOString(),
  };

  const testData: AppData = {
    ...DEFAULT_DATA,
    dutyRosters: [mockRoster],
    teachers: [
      { id: "t1", name: "Alice", isPartTime: false, requiredRooms: [] },
      { id: "t2", name: "Bob", isPartTime: false, requiredRooms: [] },
    ],
  };

  it("should render initializing state when no roster is ready", () => {
    render(<DutyView data={DEFAULT_DATA} onUpdate={mockOnUpdate} />);
    // useDutyRosters will call onUpdate to create default roster, but the component might briefly show "Initializing"
    expect(screen.getByText("Initializing Duty System...")).toBeInTheDocument();
  });

  it("should render the active roster and grid", () => {
    render(<DutyView data={testData} onUpdate={mockOnUpdate} />);
    expect(screen.getByDisplayValue("Test Roster")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument(); // Alice is assigned
  });

  it("should toggle mode between Daily and Weekly", () => {
    render(<DutyView data={testData} onUpdate={mockOnUpdate} />);
    const weeklyBtn = screen.getByText("Weekly");
    fireEvent.click(weeklyBtn);
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dutyRosters: expect.arrayContaining([expect.objectContaining({ type: "WEEKLY" })]),
      }),
    );
  });

  it("should open generator modal", () => {
    render(<DutyView data={testData} onUpdate={mockOnUpdate} />);
    const genBtn = screen.getByText("Auto-Generate");
    fireEvent.click(genBtn);
    expect(screen.getByText("Configure Roster Generation")).toBeInTheDocument(); // Modal title
  });

  it("should enable edit mode (swap)", () => {
    render(<DutyView data={testData} onUpdate={mockOnUpdate} />);
    const editBtn = screen.getByText("Enable Edit");
    fireEvent.click(editBtn);
    expect(screen.getByText("Disable Edit")).toBeInTheDocument();
  });
});
