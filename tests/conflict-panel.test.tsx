import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConflictPanel } from "../src/features/generator/components/ConflictPanel";
import { Conflict } from "../src/types";

describe("ConflictPanel", () => {
  const hardCollision: Conflict = {
    classId: "c1",
    className: "Class 1A",
    subjectId: "s1",
    subjectName: "Math",
    teacherId: "t1",
    teacherName: "John Doe",
    day: 0,
    period: 0,
    duration: 1,
    reason: "Double Booking: Teacher John Doe is assigned to multiple classes (c1, c2)",
    severity: "HIGH",
    kind: "blocking",
  };

  const unplacedLesson: Conflict = {
    classId: "c2",
    className: "Class 2B",
    subjectId: "s2",
    subjectName: "Science",
    teacherId: "t2",
    teacherName: "Jane Smith",
    day: 0,
    period: 0,
    missingPeriods: 2,
    reason: "Curriculum Gap: 2 period(s) of Science not scheduled (3/5)",
    severity: "HIGH",
    kind: "blocking",
  };

  it("renders two resolution buckets with structured cards", () => {
    render(<ConflictPanel conflicts={[hardCollision, unplacedLesson]} />);

    expect(screen.getByText("Hard Collisions")).toBeInTheDocument();
    expect(screen.getByText("Unplaced Lessons")).toBeInTheDocument();
    expect(screen.getByText("Math")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Period 1")).toBeInTheDocument();
    expect(screen.getByText("2 missing")).toBeInTheDocument();
  });

  it("does not render raw reason strings on cards", () => {
    render(<ConflictPanel conflicts={[hardCollision, unplacedLesson]} />);

    expect(screen.queryByText(hardCollision.reason)).not.toBeInTheDocument();
    expect(screen.queryByText(unplacedLesson.reason)).not.toBeInTheDocument();
    expect(screen.getByText("Teacher overlap")).toBeInTheDocument();
    expect(screen.getByText("Curriculum shortfall")).toBeInTheDocument();
  });

  it("shows section success states when a bucket is empty", () => {
    render(<ConflictPanel conflicts={[hardCollision]} />);

    expect(screen.getByText("Every curriculum lesson was placed.")).toBeInTheDocument();
  });

  it("shows a reassuring empty state when there are no conflicts", () => {
    render(<ConflictPanel conflicts={[]} />);

    expect(screen.getByText("Timetable Valid")).toBeInTheDocument();
    expect(screen.getByText(/no curriculum gaps/i)).toBeInTheDocument();
  });

  it("expands selected card with fix guidance and calls onConflictSelect", () => {
    const onSelect = vi.fn();
    render(<ConflictPanel conflicts={[hardCollision]} onConflictSelect={onSelect} />);

    fireEvent.click(screen.getByText("Math"));
    expect(onSelect).toHaveBeenCalledWith(hardCollision);

    render(
      <ConflictPanel
        conflicts={[hardCollision]}
        selectedConflict={hardCollision}
        onConflictSelect={onSelect}
      />,
    );

    expect(screen.getByText("How to fix")).toBeInTheDocument();
    expect(screen.getByText(/Drag one of the conflicting lessons/i)).toBeInTheDocument();
  });

  it("shows curriculum fix guidance for unplaced lessons when selected", () => {
    render(<ConflictPanel conflicts={[unplacedLesson]} selectedConflict={unplacedLesson} />);

    expect(screen.getByText("How to fix")).toBeInTheDocument();
    expect(screen.getByText(/Assign 2 more periods to Class 2B/i)).toBeInTheDocument();
  });
});
