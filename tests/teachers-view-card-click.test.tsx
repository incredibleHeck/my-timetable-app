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

describe("TeachersView card interactions", () => {
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

  it("opens Edit Teacher modal when clicking the teacher card", () => {
    render(<TeachersView data={mockData} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Alice Smith/i }));

    expect(screen.getByText("Edit Teacher")).toBeDefined();
    expect((screen.getByLabelText(/Full Name/i) as HTMLInputElement).value).toBe("Alice Smith");
  });
});
