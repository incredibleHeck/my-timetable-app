import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExamsView } from "../src/features/exams/ExamsView";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ExamRoster } from "../src/types";

describe("ExamsView", () => {
  const mockOnUpdate = vi.fn();
  const mockOnNavigate = vi.fn();

  const mockRoster: ExamRoster = {
    id: "r1",
    name: "Test Timetable",
    exams: [
      {
        id: "e1",
        classIds: ["c1"],
        subjectId: "s1",
        date: "2024-01-01",
        startTime: "09:00",
        duration: 120,
        mode: "WRITTEN",
        invigilatorIds: ["t1"],
        status: "DRAFT",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const testData: AppData = {
    ...DEFAULT_DATA,
    examRosters: [mockRoster],
    classes: [
      { id: "c1", name: "10A", periodCount: 6, duration: 40, curriculum: [], defaultRoomId: "" },
    ],
    subjects: [{ id: "s1", name: "Math", isDoublePeriod: false, isLab: false }],
    teachers: [{ id: "t1", name: "Alice", isPartTime: false, requiredRooms: [] }],
  };

  it("should render the active roster", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    expect(screen.getByDisplayValue("Test Timetable")).toBeInTheDocument();
  });

  it("should switch to card view", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    const cardViewBtn = screen.getByRole("tab", { name: "Cards" });
    fireEvent.click(cardViewBtn);
    // In card view, the subject name should be visible
    expect(screen.getByText("Math")).toBeInTheDocument();
  });

  it("should filter exams by search query", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    // Switch to card view to easily see the exam cards
    const cardViewBtn = screen.getByRole("tab", { name: "Cards" });
    fireEvent.click(cardViewBtn);

    expect(screen.getByText("Math")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search exams");
    fireEvent.change(searchInput, { target: { value: "Science" } });

    expect(screen.queryByText("Math")).not.toBeInTheDocument();
    expect(screen.getByText("No exams found")).toBeInTheDocument();
  });

  it("should open the auto schedule modal", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    const autoBtn = screen.getByText("Auto Schedule");
    fireEvent.click(autoBtn);
    expect(screen.getByText("Auto-Generate Timetable")).toBeInTheDocument();
  });

  it("should open the invigilator assignment modal", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    const assignBtn = screen.getByText("Assign staff");
    fireEvent.click(assignBtn);
    expect(screen.getByText("Who can invigilate")).toBeInTheDocument();
  });

  it("should enable edit mode", () => {
    render(<ExamsView data={testData} onUpdate={mockOnUpdate} />);
    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);
    expect(screen.getByRole("button", { name: "Editing" })).toBeInTheDocument();
  });
});
