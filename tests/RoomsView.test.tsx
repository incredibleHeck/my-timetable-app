import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomsView } from "../src/features/rooms/RoomsView";
import { AppData } from "../src/types";
import { DEFAULT_DATA } from "../src/utils/constants";

const mockAddActivity = vi.fn();

vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({ addActivity: mockAddActivity }),
}));

const buildData = (overrides: Partial<AppData> = {}): AppData =>
  ({
    ...DEFAULT_DATA,
    rooms: [
      { id: "r-lab", name: "Science Lab", type: "Lab", capacity: 24 },
      {
        id: "r-home",
        name: "Year 4A Classroom",
        type: "Classroom",
        capacity: 30,
        isHomeRoom: true,
      },
    ],
    subjects: [
      { id: "s-chem", name: "Chemistry", color: "#ec4899", requiredRoomId: "r-lab" },
      { id: "s-eng", name: "English", color: "#2dd4bf" },
    ],
    classes: [],
    teachers: [],
    ...overrides,
  }) as unknown as AppData;

const lastActivityData = () => (mockAddActivity.mock.calls.at(-1) as [string, string, AppData])[2];

describe("RoomsView", () => {
  beforeEach(() => mockAddActivity.mockClear());

  it("separates shared facilities from generated home rooms", () => {
    render(<RoomsView data={buildData()} onUpdate={vi.fn()} />);

    expect(screen.getByText("Shared facilities")).toBeDefined();
    expect(screen.getByText("Home rooms")).toBeDefined();
    // A home room is removed with its class, so it offers no delete action.
    expect(screen.getByRole("button", { name: "Delete Science Lab" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Delete Year 4A Classroom" })).toBeNull();
  });

  // `isHomeRoom` is set by the class sync and editable nowhere in this form.
  // Rebuilding the record from form state dropped it, which quietly detached the
  // room from the class that owns it.
  it("keeps the home-room flag when a home room is edited", () => {
    render(<RoomsView data={buildData()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Year 4A Classroom" }));
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Room" }));

    const saved = lastActivityData().rooms.find((r) => r.id === "r-home");
    expect(saved).toMatchObject({ isHomeRoom: true, capacity: 32, name: "Year 4A Classroom" });
  });

  it("clears the pin on subjects when their required room is deleted", () => {
    render(<RoomsView data={buildData()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Science Lab" }));
    // The dialog names what is pinned to the room rather than only saying it
    // will be removed from the list.
    expect(within(screen.getByRole("dialog")).getByText(/Chemistry/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Delete Room" }));

    const next = lastActivityData();
    expect(next.rooms.some((r) => r.id === "r-lab")).toBe(false);
    expect(next.subjects.find((s) => s.id === "s-chem")?.requiredRoomId).toBeUndefined();
  });
});
