import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ProfileStorage from "../src/services/profile/profileStorage";
import * as NativeAdapter from "../src/services/fileSystem/nativeAdapter";

// Mock NativeAdapter
vi.mock("../src/services/fileSystem/nativeAdapter", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  fileExists: vi.fn(),
  removeFile: vi.fn(),
}));

// Mock Platform
vi.mock("../src/utils/platform", () => ({
  isTauriEnv: vi.fn().mockReturnValue(true),
  getTauriPath: vi.fn().mockResolvedValue({
    appDataDir: vi.fn().mockResolvedValue("/app/data"),
    join: vi.fn().mockImplementation((...args) => args.join("/")),
  }),
}));

describe("ProfileStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("should create manifest if not exists", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(false);

      await ProfileStorage.init();

      expect(NativeAdapter.writeFile).toHaveBeenCalledWith(
        "/app/data/manifest.json",
        expect.stringContaining('"profiles":[]'),
      );
    });

    it("should do nothing if manifest exists", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true);
      await ProfileStorage.init();
      expect(NativeAdapter.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("createProfile", () => {
    it("should save profile and update manifest", async () => {
      // Mock existing manifest
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(
        JSON.stringify({ profiles: [], activeProfileId: null }),
      );
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true); // For init check if called, or just ensure Create reads manifest

      const newProfile = {
        id: "p1",
        name: "New Profile",
        created: 100,
        lastModified: 100,
        data: {} as any,
        meta: {},
      };

      await ProfileStorage.saveProfile(newProfile);

      // Should write profile file
      expect(NativeAdapter.writeFile).toHaveBeenCalledWith(
        "/app/data/profile_p1.json",
        expect.stringContaining("New Profile"),
      );

      // Should update manifest
      expect(NativeAdapter.writeFile).toHaveBeenCalledWith(
        "/app/data/manifest.json",
        expect.stringContaining('"id":"p1"'),
      );
    });
  });

  describe("listProfiles", () => {
    it("should return profiles from manifest", async () => {
      const manifest = {
        profiles: [{ id: "p1", name: "P1", lastModified: 100 }],
        activeProfileId: "p1",
      };
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(manifest));

      const result = await ProfileStorage.listProfiles();
      expect(result).toEqual(manifest.profiles);
    });
  });
});
