import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalConfigView } from "../src/features/configuration/GlobalConfigView";
import { DEFAULT_DATA } from "../src/utils/constants";

const pushToHistory = vi.fn();

vi.mock("../src/contexts/ProfileContext", () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProfile: () => ({
    addActivity: vi.fn(),
    profiles: [],
    activeProfile: { id: "1", name: "Test Profile" },
    isLoading: false,
    isSaving: false,
    isDirty: false,
    createNewProfile: vi.fn(),
    switchProfile: vi.fn(),
    updateActiveProfile: vi.fn(),
    reloadProfiles: vi.fn(),
    getClassSchedule: vi.fn(() => []),
  }),
}));

vi.mock("../src/contexts/HistoryContext", () => ({
  useHistory: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    pushToHistory,
    canUndo: false,
    canRedo: false,
  }),
}));

describe("GlobalConfigView Synchronization", () => {
  beforeEach(() => {
    pushToHistory.mockClear();
  });

  it("updates dayStructure when period slider is changed", () => {
    const onUpdate = vi.fn();
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 8,
        dayStructure: Array(8).fill({ type: "CLASS", label: "P" }),
      },
    };

    render(<GlobalConfigView data={data} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Day structure" }));

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "10" } });

    expect(pushToHistory).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          periodsPerDay: 10,
          dayStructure: expect.arrayContaining([expect.objectContaining({ type: "CLASS" })]),
        }),
      }),
    );

    const lastCall = onUpdate.mock.calls[0][0];
    expect(lastCall.settings.dayStructure.length).toBe(10);
  });

  it("updates timeSlots when timeline automation changes", () => {
    const onUpdate = vi.fn();
    const data = DEFAULT_DATA;

    render(<GlobalConfigView data={data} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Day structure" }));

    const startInput = screen.getByLabelText(/start of day/i);
    fireEvent.change(startInput, { target: { value: "07:30" } });

    expect(pushToHistory).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          schoolStartTime: "07:30",
          timeSlots: expect.any(Array),
        }),
      }),
    );
  });
});
