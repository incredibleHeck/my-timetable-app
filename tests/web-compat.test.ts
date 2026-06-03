import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { FileService } from "../src/services/fileSystem";
import { isTauriEnv } from "../src/utils/platform";
import * as ProfileStorage from "../src/services/profile/profileStorage";

describe("Web Compatibility", () => {
  beforeEach(() => {
    // Ensure Tauri globals are NOT present
    vi.stubGlobal("__TAURI__", undefined);
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);
  });

  it("should import FileService without crashing in a web environment", () => {
    expect(FileService).toBeDefined();
    expect(FileService.isTauri).toBe(false);
  });

  it("should use webDownload when saving project in web mode", async () => {
    // Spy on webDownload
    const webDownloadSpy = vi
      .spyOn(FileService, "webDownload")
      .mockResolvedValue({ success: true });

    const mockData = { version: 1, profiles: [] } as any;
    const result = await FileService.saveProject(mockData, "test");

    expect(result.success).toBe(true);
    expect(webDownloadSpy).toHaveBeenCalled();
  });

  it("should use webDownload when saving export in web mode", async () => {
    const webDownloadSpy = vi
      .spyOn(FileService, "webDownload")
      .mockResolvedValue({ success: true });

    const mockBlob = new Blob(["test content"], { type: "text/plain" });
    const result = await FileService.saveExport(mockBlob, "test", "txt");

    expect(result.success).toBe(true);
    expect(webDownloadSpy).toHaveBeenCalledWith(mockBlob, "test", "text/plain");
  });

  it("should detect platform correctly via isTauriEnv", () => {
    // Test Web Mode
    vi.stubGlobal("__TAURI__", undefined);
    expect(isTauriEnv()).toBe(false);

    // Test Tauri Mode
    vi.stubGlobal("__TAURI__", {});
    expect(isTauriEnv()).toBe(true);
  });

  it("should initialize and use localStorage for profiles in web mode", async () => {
    // Clear localStorage
    localStorage.clear();

    // Init
    await ProfileStorage.init();
    expect(localStorage.getItem("profile_manifest")).toBeDefined();

    // Save
    const mockProfile = {
      id: "test-id",
      name: "Test Profile",
      data: DEFAULT_DATA,
      created: Date.now(),
      lastModified: Date.now(),
      meta: {},
    };
    await ProfileStorage.saveProfile(mockProfile);

    expect(localStorage.getItem("profile_data_test-id")).toBeDefined();

    // List
    const profiles = await ProfileStorage.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Test Profile");

    // Load
    const loaded = await ProfileStorage.loadProfile("test-id");
    expect(loaded?.name).toBe("Test Profile");
  });
});
