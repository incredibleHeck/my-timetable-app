// src/features/exams/components/ExamGrid.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExamGrid } from "./ExamGrid";
import { AppData, ExamSession } from "../../../types";

const mockOnEdit = vi.fn();
const mockCheckConflicts = vi.fn(() => []);
const mockOnSwap = vi.fn();
const mockOnMoveToSlot = vi.fn();

const mockData: AppData = {
  subjects: [{ id: "sub1", name: "Mathematics", color: "#ff0000" }],
  classes: [{ id: "c1", name: "Class 10A", curriculum: [], level: "10" }],
  teachers: [],
  rooms: [],
  settings: {
    timeSlots: [{ start: "09:00", end: "11:00" }, { start: "14:00", end: "16:00" }]
  } as any,
  jointClasses: [],
  electives: [],
  exams: [],
  dutyLocations: [],
  dutyAssignments: [],
  schedule: {},
  conflicts: [],
  lastGenerated: null,
};

describe("ExamGrid", () => {
  it("should render a split view for subjects with multiple papers in the same session", () => {
    const multiPaperExams: ExamSession[] = [
      {
        id: "e1-p1",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-05",
        startTime: "09:00",
        duration: 120,
        paperNumber: 1,
        paperLabel: "Paper 1",
        status: "DRAFT",
      },
      {
        id: "e1-p2",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-05",
        startTime: "09:00",
        duration: 90,
        paperNumber: 2,
        paperLabel: "Paper 2",
        status: "DRAFT",
      },
    ];

    render(
      <ExamGrid
        data={mockData}
        exams={multiPaperExams}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
      />
    );

    const paper1Elements = screen.getAllByText(/Paper 1/i);
    const paper2Elements = screen.getAllByText(/Paper 2/i);

    expect(paper1Elements.length).toBeGreaterThan(0);
    expect(paper2Elements.length).toBeGreaterThan(0);

    const subjectNameElements = screen.getAllByText(/mathematics/i);
    expect(subjectNameElements.length).toBeGreaterThan(0);
  });

  it("should group staggered exams into split view", () => {
    const staggeredExams: ExamSession[] = [
      {
        id: "e2-p1",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-06",
        startTime: "09:00",
        duration: 120,
        paperNumber: 1,
        paperLabel: "Paper 1",
        status: "DRAFT",
      },
      {
        id: "e2-p2",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-06",
        startTime: "09:30",
        duration: 90,
        paperNumber: 2,
        paperLabel: "Paper 2",
        status: "DRAFT",
      },
    ];

    render(
      <ExamGrid
        data={mockData}
        exams={staggeredExams}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
      />
    );

    const paper1Elements = screen.getAllByText(/Paper 1/i);
    const paper2Elements = screen.getAllByText(/Paper 2/i);

    expect(paper1Elements.length).toBeGreaterThanOrEqual(2);
    expect(paper2Elements.length).toBeGreaterThanOrEqual(2);
  });

  it("should render Subject 1 and Subject 2 headers", () => {
    render(
      <ExamGrid
        data={mockData}
        exams={[]}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
      />
    );

    expect(screen.getByText("Subject 1")).toBeInTheDocument();
    expect(screen.getByText("Subject 2")).toBeInTheDocument();
  });

  it("should have droppable empty cells in edit mode", () => {
    const exams: ExamSession[] = [
      {
        id: "e1",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-05",
        startTime: "09:00",
        duration: 120,
        paperNumber: 1,
        paperLabel: "Paper 1",
        status: "DRAFT",
      }
    ];

    const { container } = render(
      <ExamGrid
        data={mockData}
        exams={exams}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={true}
      />
    );

    // In our implementation, empty cells in Edit Mode get specific CSS classes:
    // bg-white hover:bg-slate-50/30 (if not dragging over)
    // We can check if the cells are rendered using DroppableGridCell by checking for the 'td' elements
    // that are empty.
    
    const cells = container.querySelectorAll('td');
    // There should be 1 date cell and 2 session cells per row.
    // Our mock has one date populated.
    
    // We are looking for the td that represents Session 2 (Subject 2) which should be empty.
    const emptyCell = Array.from(cells).find(td => td.textContent?.trim() === "" || td.textContent?.trim() === "—");
    
    expect(emptyCell).toBeDefined();
    // Since DroppableGridCell wraps the content in a div with h-full w-full
    expect(emptyCell?.querySelector('div.h-full.w-full')).toBeInTheDocument();
  });
});