import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SubjectsView } from "../src/features/subjects/SubjectsView";
import { DEFAULT_DATA } from "../src/utils/constants";

// Mock useProfile
vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    addActivity: vi.fn(),
  }),
}));

describe("SubjectsView", () => {
  const mockOnUpdate = vi.fn();

  const defaultProps = {
    data: DEFAULT_DATA,
    onUpdate: mockOnUpdate,
  };

  it("shows Room selection in Subject modal", () => {
    const dataWithRooms = {
      ...DEFAULT_DATA,
      rooms: [{ id: "r-lab", name: "Computer Lab", type: "Lab", capacity: 30 }],
    };
    render(<SubjectsView {...defaultProps} data={dataWithRooms as any} />);

    // Open modal
    const addButton = screen.getByText(/New Subject/i);
    fireEvent.click(addButton);

    // Check for Facility Mapping section
    expect(screen.getByText(/Facility Mapping/i)).toBeDefined();
    expect(screen.getByText(/Fixed Facility \/ Room/i)).toBeDefined();

    // Check if Lab is in dropdown
    const select = screen.getByRole("combobox");
    expect(select).toBeDefined();
    expect(screen.getByText(/Computer Lab/i)).toBeDefined();
  });
});
