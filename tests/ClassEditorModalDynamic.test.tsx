import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClassEditorModal } from "../src/features/classes/components/ClassEditorModal";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("ClassEditorModal Dynamic Duration Updates", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const dataWithNoDayStructure = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      dayStructure: [],
      periodsPerDay: 8,
      defaultBreakDuration: 25,
      defaultLunchDuration: 75,
      defaultClassDuration: 55,
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingClass: null,
    data: dataWithNoDayStructure,
    onSave: mockOnSave,
  };

  it("auto-updates break duration when first BREAK is added even if previously cleared", () => {
    render(<ClassEditorModal {...defaultProps} />);

    // Switch to Structure tab
    fireEvent.click(screen.getByRole("button", { name: /Structure/i }));

    // Manually clear the break duration
    const breakInput = screen.getByText(/Break \(min\)/i).parentElement!.querySelector("input")!;
    fireEvent.change(breakInput, { target: { value: "0" } });
    expect(screen.getByDisplayValue("0")).toBeDefined();

    // Click slot 1 once to change CLASS -> BREAK
    const slot1 = screen.getByText("1").closest("button")!;
    fireEvent.click(slot1); // CLASS -> BREAK

    // Check if Break duration updated to 25
    expect(screen.getByDisplayValue("25")).toBeDefined();
  });

  it("auto-updates lunch duration when first LUNCH is added even if previously cleared", () => {
    render(<ClassEditorModal {...defaultProps} />);

    // Switch to Structure tab
    fireEvent.click(screen.getByRole("button", { name: /Structure/i }));

    // Manually clear the lunch duration
    const lunchInput = screen.getByText(/Lunch \(min\)/i).parentElement!.querySelector("input")!;
    fireEvent.change(lunchInput, { target: { value: "0" } });
    expect(screen.getByDisplayValue("0")).toBeDefined();

    // Click slot 1 twice to change CLASS -> BREAK -> LUNCH
    const slot1 = screen.getByText("1").closest("button")!;
    fireEvent.click(slot1); // CLASS -> BREAK
    fireEvent.click(slot1); // BREAK -> LUNCH

    // Check if Lunch duration updated to 75
    expect(screen.getByDisplayValue("75")).toBeDefined();
  });

  it("does NOT overwrite manual duration adjustments when adding more slots of same type", () => {
    render(<ClassEditorModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Structure/i }));

    const slot1 = screen.getByText("1").closest("button")!;
    const slot2 = screen.getByText("2").closest("button")!;

    // 1. Add first BREAK
    fireEvent.click(slot1);
    expect(screen.getByDisplayValue("25")).toBeDefined();

    // 2. Manually change break duration to 30
    const breakInput = screen.getByDisplayValue("25");
    fireEvent.change(breakInput, { target: { value: "30" } });
    expect(screen.getByDisplayValue("30")).toBeDefined();

    // 3. Add second BREAK
    fireEvent.click(slot2);

    // 4. Verify it's still 30, not reset to 25
    expect(screen.getByDisplayValue("30")).toBeDefined();
    expect(screen.queryByDisplayValue("25")).toBeNull();
  });
});
