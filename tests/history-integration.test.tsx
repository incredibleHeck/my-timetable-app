import { renderHook, act } from "@testing-library/react";
import { ProfileProvider, useProfile } from "../src/contexts/ProfileContext";
import { useHistory } from "../src/contexts/HistoryContext";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import * as ProfileStorage from "../src/services/profile/profileStorage";

vi.unmock("../src/contexts/HistoryContext");

vi.mock("../src/services/profile/profileStorage", () => ({
  init: vi.fn(),
  listProfiles: vi.fn(() => Promise.resolve([])),
  getActiveProfileId: vi.fn(() => Promise.resolve(null)),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
}));

const mockData = {
  settings: {
    periodsPerDay: 8,
    dayStructure: [],
    timeSlots: [],
    maxConsecutivePeriods: 4,
    fixedOccasions: [],
  },
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
  recentActivity: [],
};

const mockProfile = {
  id: "test-id",
  name: "Test Profile",
  created: 1,
  lastModified: 1,
  data: { ...mockData },
  meta: {},
};

function useProfileAndHistory() {
  return { profile: useProfile(), history: useHistory() };
}

describe("ProfileContext History Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ProfileStorage.loadProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);
    (ProfileStorage.getActiveProfileId as ReturnType<typeof vi.fn>).mockResolvedValue("test-id");
  });

  it("should handle push, undo and redo", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );

    const { result } = renderHook(() => useProfileAndHistory(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.history.canUndo).toBe(false);

    const data2 = { ...mockData, lastGenerated: "2026-01-10" };
    act(() => {
      result.current.history.pushToHistory();
      result.current.profile.updateActiveProfile(data2);
    });

    expect(result.current.history.canUndo).toBe(true);
    expect(result.current.profile.activeProfile?.data.lastGenerated).toBe("2026-01-10");

    act(() => {
      result.current.history.undo();
    });

    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(true);
    expect(result.current.profile.activeProfile?.data.lastGenerated).toBe(null);

    act(() => {
      result.current.history.redo();
    });

    expect(result.current.history.canUndo).toBe(true);
    expect(result.current.history.canRedo).toBe(false);
    expect(result.current.profile.activeProfile?.data.lastGenerated).toBe("2026-01-10");
  });

  it("resets history when switching profiles", async () => {
    const profileTwo = {
      ...mockProfile,
      id: "test-id-2",
      name: "Profile Two",
    };

    (ProfileStorage.loadProfile as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve(id === "test-id" ? mockProfile : profileTwo),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );

    const { result } = renderHook(() => useProfileAndHistory(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    act(() => {
      result.current.history.pushToHistory();
      result.current.profile.updateActiveProfile({ ...mockData, lastGenerated: "2026-01-10" });
    });

    expect(result.current.history.canUndo).toBe(true);

    await act(async () => {
      await result.current.profile.switchProfile("test-id-2");
    });

    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(false);
    expect(result.current.profile.activeProfile?.id).toBe("test-id-2");
  });
});
