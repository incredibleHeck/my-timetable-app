import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TeachersView } from "../src/features/teachers/TeachersView";
import { DEFAULT_DATA } from "../src/utils/constants";

vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    addActivity: vi.fn(),
  }),
}));

describe("TeachersView row interactions", () => {
  const mockData = {
    ...DEFAULT_DATA,
    teachers: [
      {
        id: "t1",
        name: "Alice Smith",
        specialtyIds: [],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(DEFAULT_DATA.settings.periodsPerDay).fill(false)),
      },
    ],
  };

  // The name is the primary control for the row, so it is a real button rather
  // than a heading inside a clickable card. That removes the old trade-off where
  // the click shortcut was mouse-only because the card could not be focused.
  it("opens the editor when the teacher name is activated", () => {
    render(<TeachersView data={mockData} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Alice Smith" }));

    expect(screen.getByText("Edit Teacher")).toBeDefined();
    expect((screen.getByLabelText(/Full name/i) as HTMLInputElement).value).toBe("Alice Smith");
  });

  // Row actions name their subject: forty rows of buttons all called "Edit"
  // gives a screen reader no way to tell which teacher is about to change.
  it("exposes row actions labelled with the teacher they act on", () => {
    render(<TeachersView data={mockData} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Alice Smith" }));

    expect(screen.getByText("Edit Teacher")).toBeDefined();
    expect((screen.getByLabelText(/Full name/i) as HTMLInputElement).value).toBe("Alice Smith");
  });
});
