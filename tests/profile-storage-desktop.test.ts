import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as ProfileStorage from "../src/services/profile/profileStorage";
import * as NativeAdapter from "../src/services/fileSystem/nativeAdapter";
import { ProfileSchemaTooNewError } from "../src/services/profile/migrations";
import { CURRENT_SCHEMA_VERSION } from "../src/types/profile";
import { DEFAULT_DATA } from "../src/utils/constants";

vi.mock("../src/services/fileSystem/nativeAdapter", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  fileExists: vi.fn(),
  removeFile: vi.fn(),
}));

vi.mock("../src/utils/platform", () => ({
  isTauriEnv: vi.fn().mockReturnValue(true),
  getTauriPath: vi.fn().mockResolvedValue({
    appDataDir: vi.fn().mockResolvedValue("/app/data"),
    join: vi.fn().mockImplementation((...args: string[]) => args.join("/")),
  }),
}));

const profileFixture = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: "p1",
  name: "School One",
  created: 1700000000000,
  lastModified: 1700000005000,
  data: DEFAULT_DATA,
  meta: {},
  ...overrides,
});

const manifestFixture = (activeProfileId: string | null = "p1") => ({
  profiles: [
    { id: "p1", name: "School One", lastModified: 1 },
    { id: "p2", name: "School Two", lastModified: 2 },
  ],
  activeProfileId,
});

describe("profileStorage (desktop backend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadProfile", () => {
    it("reads and parses the profile file", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(profileFixture()));

      const profile = await ProfileStorage.loadProfile("p1");

      expect(profile?.id).toBe("p1");
      expect(profile?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("migrates an un-versioned profile on the way in", async () => {
      const legacy = profileFixture();
      delete (legacy as Record<string, unknown>).schemaVersion;
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(legacy));

      const profile = await ProfileStorage.loadProfile("p1");

      expect(profile?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("returns null when the file is missing or unreadable", async () => {
      vi.mocked(NativeAdapter.readFile).mockRejectedValue(new Error("ENOENT"));

      await expect(ProfileStorage.loadProfile("p1")).resolves.toBeNull();
    });

    it("propagates a too-new profile instead of reporting it as missing", async () => {
      // Returning null here would make the profile silently fail to open, which
      // is indistinguishable from "not found" at the call site.
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(
        JSON.stringify(profileFixture({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })),
      );

      await expect(ProfileStorage.loadProfile("p1")).rejects.toBeInstanceOf(
        ProfileSchemaTooNewError,
      );
    });
  });

  describe("deleteProfile", () => {
    it("removes the file and drops the entry from the manifest", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(manifestFixture("p2")));

      await ProfileStorage.deleteProfile("p1");

      expect(NativeAdapter.removeFile).toHaveBeenCalledWith("/app/data/profile_p1.json");
      const written = JSON.parse(vi.mocked(NativeAdapter.writeFile).mock.calls[0][1] as string);
      expect(written.profiles.map((p: { id: string }) => p.id)).toEqual(["p2"]);
      expect(written.activeProfileId).toBe("p2");
    });

    it("reassigns the active profile when the active one is deleted", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(manifestFixture("p1")));

      await ProfileStorage.deleteProfile("p1");

      const written = JSON.parse(vi.mocked(NativeAdapter.writeFile).mock.calls[0][1] as string);
      expect(written.activeProfileId).toBe("p2");
    });

    it("clears the active profile when the last one is deleted", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(
        JSON.stringify({
          profiles: [{ id: "p1", name: "Only", lastModified: 1 }],
          activeProfileId: "p1",
        }),
      );

      await ProfileStorage.deleteProfile("p1");

      const written = JSON.parse(vi.mocked(NativeAdapter.writeFile).mock.calls[0][1] as string);
      expect(written.profiles).toEqual([]);
      expect(written.activeProfileId).toBeNull();
    });

    it("rethrows so the caller can surface the failure", async () => {
      vi.mocked(NativeAdapter.removeFile).mockRejectedValue(new Error("locked"));

      await expect(ProfileStorage.deleteProfile("p1")).rejects.toThrow("locked");
    });
  });

  describe("setActiveProfile", () => {
    it("writes the new active id into the manifest", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(manifestFixture("p1")));

      await ProfileStorage.setActiveProfile("p2");

      const written = JSON.parse(vi.mocked(NativeAdapter.writeFile).mock.calls[0][1] as string);
      expect(written.activeProfileId).toBe("p2");
    });

    it("rethrows when the manifest cannot be read", async () => {
      vi.mocked(NativeAdapter.readFile).mockRejectedValue(new Error("corrupt"));

      await expect(ProfileStorage.setActiveProfile("p2")).rejects.toThrow("corrupt");
    });
  });

  describe("getActiveProfileId", () => {
    it("returns the id recorded in the manifest", async () => {
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(manifestFixture("p2")));

      await expect(ProfileStorage.getActiveProfileId()).resolves.toBe("p2");
    });

    it("returns null rather than throwing when the manifest is unreadable", async () => {
      vi.mocked(NativeAdapter.readFile).mockRejectedValue(new Error("gone"));

      await expect(ProfileStorage.getActiveProfileId()).resolves.toBeNull();
    });
  });

  describe("flushProfileEmergency", () => {
    it("is a no-op on desktop, where async writes are already reliable", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");

      ProfileStorage.flushProfileEmergency(profileFixture() as never);

      expect(setItem).not.toHaveBeenCalled();
    });
  });
});
