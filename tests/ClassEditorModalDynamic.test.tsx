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

  const openStructureTab = () => fireEvent.click(screen.getByRole("tab", { name: /Structure/i }));

  // Period type is chosen from a select per period. It used to be a tile that
  // cycled CLASS -> BREAK -> LUNCH on each click, which meant two clicks to
  // reach LUNCH and no way back without going all the way round.
  const setPeriodType = (period: number, type: string) =>
    fireEvent.change(screen.getByLabelText(`Period ${period} type`), { target: { value: type } });

  it("auto-updates break duration when first BREAK is added even if previously cleared", () => {
    render(<ClassEditorModal {...defaultProps} />);
    openStructureTab();

    fireEvent.change(screen.getByLabelText(/Break \(min\)/i), { target: { value: "0" } });
    expect(screen.getByDisplayValue("0")).toBeDefined();

    setPeriodType(1, "BREAK");

    expect(screen.getByDisplayValue("25")).toBeDefined();
  });

  it("auto-updates lunch duration when first LUNCH is added even if previously cleared", () => {
    render(<ClassEditorModal {...defaultProps} />);
    openStructureTab();

    fireEvent.change(screen.getByLabelText(/Lunch \(min\)/i), { target: { value: "0" } });
    expect(screen.getByDisplayValue("0")).toBeDefined();

    setPeriodType(1, "LUNCH");

    expect(screen.getByDisplayValue("75")).toBeDefined();
  });

  it("does NOT overwrite manual duration adjustments when adding more slots of same type", () => {
    render(<ClassEditorModal {...defaultProps} />);
    openStructureTab();

    setPeriodType(1, "BREAK");
    expect(screen.getByDisplayValue("25")).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Break \(min\)/i), { target: { value: "30" } });
    expect(screen.getByDisplayValue("30")).toBeDefined();

    setPeriodType(2, "BREAK");

    expect(screen.getByDisplayValue("30")).toBeDefined();
    expect(screen.queryByDisplayValue("25")).toBeNull();
  });
});
