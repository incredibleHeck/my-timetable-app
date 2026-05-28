import { describe, it, expect, vi, beforeEach } from "vitest";
import * as NativeAdapter from "../src/services/fileSystem/nativeAdapter";

// Mock the Tauri plugins
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(),
  writeFile: vi.fn(),
  remove: vi.fn(),
  mkdir: vi.fn(),
  BaseDirectory: { AppData: 1 },
}));

vi.mock("@tauri-apps/api/path", () => ({
  dirname: vi.fn().mockResolvedValue("/mock/path"),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

import { writeTextFile, readTextFile, remove } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";

describe("NativeAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__TAURI__", {});
  });

  describe("writeFile", () => {
    it("should write text to a file", async () => {
      await NativeAdapter.writeFile("test.txt", "content");
      expect(writeTextFile).toHaveBeenCalledWith("test.txt", "content");
    });
  });

  describe("readFile", () => {
    it("should read text from a file", async () => {
      vi.mocked(readTextFile).mockResolvedValue("content");
      const result = await NativeAdapter.readFile("test.txt");
      expect(result).toBe("content");
      expect(readTextFile).toHaveBeenCalledWith("test.txt");
    });
  });

  describe("saveDialog", () => {
    it("should open save dialog and return path", async () => {
      vi.mocked(save).mockResolvedValue("/path/to/save.json");
      const result = await NativeAdapter.saveDialog({ defaultPath: "test.json" });
      expect(result).toBe("/path/to/save.json");
      expect(save).toHaveBeenCalled();
    });
  });

  describe("removeFile", () => {
    it("should remove a file", async () => {
      await NativeAdapter.removeFile("test.txt");
      expect(remove).toHaveBeenCalledWith("test.txt");
    });
  });
});
