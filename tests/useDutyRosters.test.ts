import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useDutyRosters } from "../src/features/duty/hooks/useDutyRosters";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, DutyRoster } from "../src/types";

describe("useDutyRosters", () => {
  it("should initialize with a default roster if none exists", () => {
    const mockOnUpdate = vi.fn();
    const data: AppData = { ...DEFAULT_DATA, dutyRosters: [] };

    const { result } = renderHook(() => useDutyRosters(data, mockOnUpdate));

    // onUpdate should be called to set the default roster
    expect(mockOnUpdate).toHaveBeenCalled();
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.dutyRosters?.length).toBe(1);
    expect(updateCall.dutyRosters?.[0].name).toBe("Standard Duty Roster");

    // Hook state
    expect(result.current.activeRosterId).toBe(updateCall.dutyRosters?.[0].id);
  });

  it("should hydrate with existing rosters", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: DutyRoster = {
      id: "r1",
      name: "Existing Roster",
      type: "DAILY",
      dailyAssignments: [],
      weeklyAssignments: [],
      dailyParams: { min: 4, max: 6 },
      weeklyParams: { min: 4, max: 6, weeks: 4 },
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, dutyRosters: [existingRoster] };

    const { result } = renderHook(() => useDutyRosters(data, mockOnUpdate));

    expect(result.current.activeRosterId).toBe("r1");
    expect(result.current.activeRoster).toEqual(existingRoster);
    expect(mockOnUpdate).not.toHaveBeenCalled(); // No migration needed
  });

  it("should create a new roster", () => {
    const mockOnUpdate = vi.fn();
    const data: AppData = { ...DEFAULT_DATA, dutyRosters: [] };
    const { result } = renderHook(() => useDutyRosters(data, mockOnUpdate));

    act(() => {
      result.current.createNewRoster();
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(2); // 1st: default init, 2nd: createNewRoster
    const updateCall = mockOnUpdate.mock.calls[1][0] as AppData;
    expect(updateCall.dutyRosters?.length).toBe(1); // since `data` reference in hook closure might not have updated without rerender, it depends on data passed in.
    // wait, createNewRoster appends to data.dutyRosters. Since data.dutyRosters is [], it will be [newRoster].
    expect(updateCall.dutyRosters?.[0].name).toMatch(/New Roster/);
  });

  it("should update the active roster", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: DutyRoster = {
      id: "r1",
      name: "Existing Roster",
      type: "DAILY",
      dailyAssignments: [],
      weeklyAssignments: [],
      dailyParams: { min: 4, max: 6 },
      weeklyParams: { min: 4, max: 6, weeks: 4 },
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, dutyRosters: [existingRoster] };

    const { result } = renderHook(() => useDutyRosters(data, mockOnUpdate));

    act(() => {
      result.current.updateActiveRoster({ name: "Updated Name" });
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.dutyRosters?.[0].name).toBe("Updated Name");
  });

  it("should delete a roster", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: DutyRoster = {
      id: "r1",
      name: "Existing Roster",
      type: "DAILY",
      dailyAssignments: [],
      weeklyAssignments: [],
      dailyParams: { min: 4, max: 6 },
      weeklyParams: { min: 4, max: 6, weeks: 4 },
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, dutyRosters: [existingRoster] };

    window.confirm = vi.fn(() => true);

    const { result } = renderHook(() => useDutyRosters(data, mockOnUpdate));

    act(() => {
      result.current.deleteRoster("r1");
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.dutyRosters?.length).toBe(0);
  });
});
