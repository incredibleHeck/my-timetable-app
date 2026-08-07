import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrateFromLocalStorage } from "../src/services/profile/migration";
import * as ProfileStorage from "../src/services/profile/profileStorage";
import { STORAGE_KEY, DEFAULT_DATA } from "../src/utils/constants";
import { CURRENT_SCHEMA_VERSION } from "../src/types/profile";

// Mock ProfileStorage
vi.mock("../src/services/profile/profileStorage", () => ({
  init: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
}));

describe("Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should return false if localStorage is empty", async () => {
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
    expect(ProfileStorage.init).not.toHaveBeenCalled();
  });

  it("should migrate data if exists", async () => {
    const legacyProfiles = [{ id: "legacy1", name: "Legacy 1", data: DEFAULT_DATA }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProfiles));

    const result = await migrateFromLocalStorage();

    expect(result).toBe(true);
    expect(ProfileStorage.init).toHaveBeenCalled();
    expect(ProfileStorage.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "legacy1",
        name: "Legacy 1",
        meta: expect.objectContaining({ description: "Migrated from LocalStorage" }),
      }),
    );

    // Check LS cleanup
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY + "_MIGRATED")).toBeTruthy();
  });

  it("runs the migration chain rather than hardcoding the current version", async () => {
    // The legacy `timetable_app_v1` payload predates versioning, so it is v0.
    // It must come out stamped by the chain, not stamped on the way past it —
    // otherwise a future v1->v2 step would skip this data forever.
    const legacyProfiles = [{ id: "legacy2", name: "Legacy 2", data: DEFAULT_DATA }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProfiles));

    await migrateFromLocalStorage();

    const saved = vi.mocked(ProfileStorage.saveProfile).mock.calls[0][0];
    expect(saved.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("skips a malformed legacy profile instead of storing it", async () => {
    // Storing unvalidated data means loadProfile fails to parse it later and the
    // profile silently disappears. Rejecting it here at least leaves a log, and
    // one bad profile must not abort the others.
    const legacyProfiles = [
      { id: "bad", name: "Corrupt", data: { foo: "bar" } },
      { id: "good", name: "Valid", data: DEFAULT_DATA },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProfiles));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await migrateFromLocalStorage();
    errorSpy.mockRestore();

    expect(result).toBe(true);
    const savedIds = vi
      .mocked(ProfileStorage.saveProfile)
      .mock.calls.map(([profile]) => profile.id);
    expect(savedIds).toEqual(["good"]);
  });
});
