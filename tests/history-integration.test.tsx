import { renderHook, act } from "@testing-library/react";
import { ProfileProvider, useProfile } from "../src/contexts/ProfileContext";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import * as ProfileStorage from "../src/services/profile/profileStorage";

// Mock ProfileStorage
vi.mock("../src/services/profile/profileStorage", () => ({
  init: vi.fn(),
  listProfiles: vi.fn(() => Promise.resolve([])),
  getActiveProfileId: vi.fn(() => Promise.resolve(null)),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
}));

const mockData = {
  settings: { periodsPerDay: 8, dayStructure: [], timeSlots: [], maxConsecutivePeriods: 4, fixedOccasions: [] },
  subjects: [],
  teachers: [],
  rooms: [],
  classes: [],
  jointClasses: [],
  electives: [],
  exams: [],
  dutyLocations: [],
  dutyAssignments: [],
  schedule: {},
  conflicts: [],
  lastGenerated: null,
};

const mockProfile = {
  id: "test-id",
  name: "Test Profile",
  data: { ...mockData },
};

describe("ProfileContext History Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ProfileStorage.loadProfile as any).mockResolvedValue(mockProfile);
    (ProfileStorage.getActiveProfileId as any).mockResolvedValue("test-id");
  });

  it("should handle push, undo and redo", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );

    const { result } = renderHook(() => useProfile(), { wrapper });

    // Wait for init
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.canUndo).toBe(false);

    // Push new state
    const data2 = { ...mockData, lastGenerated: "2026-01-10" };
    act(() => {
      result.current.pushToHistory(data2); // Push current state to past
      result.current.updateActiveProfile(data2);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.activeProfile?.data.lastGenerated).toBe("2026-01-10");

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.activeProfile?.data.lastGenerated).toBe(null);

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.activeProfile?.data.lastGenerated).toBe("2026-01-10");
  });
});
