import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClassEditorModal } from "../src/features/classes/components/ClassEditorModal";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("ClassEditorModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingClass: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it("initializes durations from global defaults when creating new class and saves them", async () => {
    render(<ClassEditorModal {...defaultProps} />);

    // Set a name so save is enabled
    const nameInput = screen.getByLabelText(/Class Name/i);
    fireEvent.change(nameInput, { target: { value: "Test Class" } });

    // Click Save
    const saveButton = screen.getByText(/Save Class/i);
    fireEvent.click(saveButton);

    // Verify onSave was called with default durations from DEFAULT_DATA
    // DEFAULT_DATA.settings has defaultBreakDuration: 20, defaultLunchDuration: 60
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Class",
        breakDuration: 20,
        lunchDuration: 60,
        duration: 50,
      }),
      null,
    );
  });

  it("hydrates existing durations from editingClass and saves them", async () => {
    const existingClass = {
      id: "c1",
      name: "Existing Class",
      curriculum: [],
      breakDuration: 15,
      lunchDuration: 45,
      duration: 40,
      periodCount: 8,
      structure: [],
    };

    render(<ClassEditorModal {...defaultProps} editingClass={existingClass as any} />);

    // Click Save
    const saveButton = screen.getByText(/Save Class/i);
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Existing Class",
        breakDuration: 15,
        lunchDuration: 45,
        duration: 40,
      }),
      expect.objectContaining({ id: "c1" }),
    );
  });

  // The editor owns eight fields but a ClassGroup carries more. `level` and
  // `studentCount` are editable nowhere in the UI yet drive exam year grouping
  // and the scheduler's room-capacity check, so rebuilding the record from form
  // state alone silently discarded them on every save.
  it("preserves fields the editor does not own when saving an edit", () => {
    mockOnSave.mockClear();

    const existingClass = {
      id: "c2",
      name: "Year 7A",
      curriculum: [],
      periodCount: 8,
      structure: [],
      level: "7",
      studentCount: 32,
    };

    render(<ClassEditorModal {...defaultProps} editingClass={existingClass as any} />);
    fireEvent.click(screen.getByText(/Save Class/i));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Year 7A", level: "7", studentCount: 32 }),
      expect.objectContaining({ id: "c2" }),
    );
  });
});
