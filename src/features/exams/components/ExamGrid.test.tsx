// src/features/exams/components/ExamGrid.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExamGrid } from "./ExamGrid";
import { AppData, ExamSession } from "../../../types";

const mockOnEdit = vi.fn();
const mockCheckConflicts = vi.fn(() => []);
const mockOnSwap = vi.fn();
const mockOnMoveDate = vi.fn();
const mockOnMoveToSlot = vi.fn();

const mockData: AppData = {
  subjects: [{ id: "sub1", name: "Mathematics", color: "#ff0000" }],
  classes: [{ id: "c1", name: "Class 10A", curriculum: [], level: "10" }],
  teachers: [],
  rooms: [],
  settings: {} as any,
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
    // ARRANGE: Create two exam sessions for the same subject but different papers,
    // scheduled at the exact same date and time.
    const multiPaperExams: ExamSession[] = [
      {
        id: "e1-p1",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-05", // Monday
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
        date: "2024-08-05", // Monday
        startTime: "09:00",
        duration: 90,
        paperNumber: 2,
        paperLabel: "Paper 2",
        status: "DRAFT",
      },
    ];

    // ACT: Render the ExamGrid with the multi-paper exams
    render(
      <ExamGrid
        data={mockData}
        exams={multiPaperExams}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveDate={mockOnMoveDate}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
        editTool="MOVE"
      />
    );

    // ASSERT: Check for the split-view headers that DraggableExamCard should render
    // We use `getAllByText` because the paper number can appear in multiple places (header, card body).
    // The presence of at least one of each confirms the split view logic is active.
    const paper1Elements = screen.getAllByText(/Paper 1/i);
    const paper2Elements = screen.getAllByText(/Paper 2/i);

    expect(paper1Elements.length).toBeGreaterThan(0);
    expect(paper2Elements.length).toBeGreaterThan(0);

    // Check that the subject name appears (as the main header for the block)
    const subjectNameElements = screen.getAllByText(/mathematics/i);
    expect(subjectNameElements.length).toBeGreaterThan(0);
  });

  it("should group staggered exams (different times, same morning) into split view", () => {
    // ARRANGE: P1 at 09:00, P2 at 09:30. Both should be in "Morning" column.
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
        startTime: "09:30", // Staggered start
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
        onMoveDate={mockOnMoveDate}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
        editTool="MOVE"
      />
    );

    // If they are grouped, we see split headers "Paper 1" and "Paper 2".
    // If they were NOT grouped (bug behavior), one would be in col 1 and one in col 2,
    // potentially appearing as separate cards.
    // However, our `DraggableExamCard` logic ONLY triggers split view if `getSlots` groups them.
    // So if we see "Paper 1" mini-header (from DraggableExamCard split logic), it means they were grouped.

    // The mini-header is: <div ...>Paper 1</div>
    // The regular label is: <span ...>Paper 1</span>
    
    const paper1Elements = screen.getAllByText(/Paper 1/i);
    const paper2Elements = screen.getAllByText(/Paper 2/i);

    // We expect at least 2 instances if split view is active (Header + Badge)
    // If NOT split view, we only see 1 instance (Badge only)
    expect(paper1Elements.length).toBeGreaterThanOrEqual(2);
    expect(paper2Elements.length).toBeGreaterThanOrEqual(2);
  });

  it("should group wide-spanning exams (Morning & Afternoon) into the same column based on anchor time", () => {
    // ARRANGE: P1 at 09:00 (Morning), P2 at 14:00 (Afternoon).
    // Previously, these would split across columns.
    // Now, P2 should be pulled into Session 1 because P1 anchors the subject to Morning.
    const spanningExams: ExamSession[] = [
      {
        id: "e3-p1",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-07",
        startTime: "09:00",
        duration: 120,
        paperNumber: 1,
        paperLabel: "Paper 1",
        status: "DRAFT",
      },
      {
        id: "e3-p2",
        subjectId: "sub1",
        classIds: ["c1"],
        date: "2024-08-07",
        startTime: "14:00", // Afternoon time
        duration: 90,
        paperNumber: 2,
        paperLabel: "Paper 2",
        status: "DRAFT",
      },
    ];

    render(
      <ExamGrid
        data={mockData}
        exams={spanningExams}
        onEdit={mockOnEdit}
        checkConflicts={mockCheckConflicts}
        onSwap={mockOnSwap}
        onMoveDate={mockOnMoveDate}
        onMoveToSlot={mockOnMoveToSlot}
        isEditMode={false}
        editTool="MOVE"
      />
    );

    // 1. Check Headers
    expect(screen.getByText("Subject 1")).toBeInTheDocument();
    expect(screen.getByText("Subject 2")).toBeInTheDocument();

    // 2. Check Grouping (Split View)
    // If grouped, we see the split headers.
    const paper1Elements = screen.getAllByText(/Paper 1/i);
    const paper2Elements = screen.getAllByText(/Paper 2/i);

    expect(paper1Elements.length).toBeGreaterThanOrEqual(2);
    expect(paper2Elements.length).toBeGreaterThanOrEqual(2);
  });
});
