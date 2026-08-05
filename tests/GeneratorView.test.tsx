import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GeneratorView } from "../src/features/generator/GeneratorView";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

describe("GeneratorView", () => {
  const mockOnUpdate = vi.fn();
  const mockOnNavigate = vi.fn();

  const testData: AppData = {
    ...DEFAULT_DATA,
    classes: [
      { id: "c1", name: "10A", periodCount: 6, duration: 40, curriculum: [], defaultRoomId: "" },
      { id: "c2", name: "10B", periodCount: 6, duration: 40, curriculum: [], defaultRoomId: "" },
    ],
    teachers: [
      { id: "t1", name: "Alice", isPartTime: false, requiredRooms: [] },
      { id: "t2", name: "Bob", isPartTime: false, requiredRooms: [] },
    ],
  };

  it("should render the generator view with classes by default", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Select Group")).toBeInTheDocument();
    expect(screen.getByText("10A")).toBeInTheDocument();
    expect(screen.getByText("10B")).toBeInTheDocument();
  });

  // Exam Timetable and Duty Roster both carry one. Dropping it here left the
  // timetable as the only full-width workspace with no way back out of it.
  it("offers a way back to the dashboard", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} onNavigate={mockOnNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    expect(mockOnNavigate).toHaveBeenCalledWith("DASHBOARD");
  });

  it("should toggle to teacher view", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);

    // Switch to teacher view
    const teacherBtn = screen.getByText("Teachers");
    fireEvent.click(teacherBtn);

    expect(screen.getByText("Select Teacher")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  // The grid is directly editable. "Enable Edit" and the "Manual Placement"
  // mode nested inside it are gone: neither gated anything a drag or a click on
  // an empty slot could not decide for itself, and undo already covers mistakes.
  it("does not gate the grid behind an edit mode", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);

    expect(screen.queryByText("Enable Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Manual Placement")).not.toBeInTheDocument();
    expect(screen.queryByText(/Read-only mode/i)).not.toBeInTheDocument();
  });

  it("says room timetables cannot be edited in place", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByText("Rooms"));

    expect(screen.getByText(/Room timetables are a read-only view/i)).toBeInTheDocument();
  });
});
