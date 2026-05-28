import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileProvider, useProfile } from "../src/contexts/ProfileContext";
import * as ProfileStorage from "../src/services/profile/profileStorage";
import * as Migration from "../src/services/profile/migration";

// Mock Services
vi.mock("../src/services/profile/profileStorage", () => ({
  init: vi.fn(),
  listProfiles: vi.fn(),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
  getActiveProfileId: vi.fn(),
}));

vi.mock("../src/services/profile/migration", () => ({
  migrateFromLocalStorage: vi.fn(),
}));

const TestComponent = () => {
  const { profiles, activeProfile, isLoading, createNewProfile, switchProfile } = useProfile();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="active-profile">{activeProfile?.name}</div>
      <div data-testid="profile-count">{profiles.length}</div>
      <button onClick={() => createNewProfile("New P", {})}>Create</button>
      <button onClick={() => switchProfile("p2")}>Switch</button>
    </div>
  );
};

describe("ProfileContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize and load profiles", async () => {
    vi.mocked(Migration.migrateFromLocalStorage).mockResolvedValue(false);
    vi.mocked(ProfileStorage.listProfiles).mockResolvedValue([
      { id: "p1", name: "Profile 1", lastModified: 100 },
    ]);
    vi.mocked(ProfileStorage.getActiveProfileId).mockResolvedValue("p1");
    vi.mocked(ProfileStorage.loadProfile).mockResolvedValue({
      id: "p1",
      name: "Profile 1",
      data: {} as any,
      created: 0,
      lastModified: 0,
      meta: {},
    });

    render(
      <ProfileProvider>
        <TestComponent />
      </ProfileProvider>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("active-profile")).toHaveTextContent("Profile 1");
    });

    expect(ProfileStorage.init).toHaveBeenCalled();
    expect(ProfileStorage.listProfiles).toHaveBeenCalled();
  });
});
