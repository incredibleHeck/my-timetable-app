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
      { id: "c2", name: "10B", periodCount: 6, duration: 40, curriculum: [], defaultRoomId: "" }
    ],
    teachers: [
      { id: "t1", name: "Alice", isPartTime: false, requiredRooms: [] },
      { id: "t2", name: "Bob", isPartTime: false, requiredRooms: [] }
    ],
  };

  it("should render the generator view with classes by default", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Select Group")).toBeInTheDocument();
    expect(screen.getByText("10A")).toBeInTheDocument();
    expect(screen.getByText("10B")).toBeInTheDocument();
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

  it("should enable edit mode", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);
    
    const editBtn = screen.getByText("Enable Edit");
    fireEvent.click(editBtn);

    expect(screen.getByText("Disable Edit")).toBeInTheDocument();
  });

  it("should enable manual placement mode", () => {
    render(<GeneratorView data={testData} onUpdate={mockOnUpdate} />);
    
    // Manual placement is only visible when edit mode is on
    const editBtn = screen.getByText("Enable Edit");
    fireEvent.click(editBtn);

    const manualBtn = screen.getByText("Manual Placement");
    fireEvent.click(manualBtn);

    expect(screen.getByText("Manual Placement On")).toBeInTheDocument();
  });
});
