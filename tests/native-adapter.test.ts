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
  rename: vi.fn(),
  BaseDirectory: { AppData: 1 },
}));

vi.mock("@tauri-apps/api/path", () => ({
  dirname: vi.fn().mockResolvedValue("/mock/path"),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

import {
  writeTextFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { dirname } from "@tauri-apps/api/path";
import { save, open } from "@tauri-apps/plugin-dialog";

describe("NativeAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__TAURI__", {});
  });

  describe("writeFile", () => {
    it("should write text to a temp file then rename it", async () => {
      await NativeAdapter.writeFile("test.txt", "content");
      expect(writeTextFile).toHaveBeenCalledWith("test.txt.tmp", "content");
      expect(rename).toHaveBeenCalledWith("test.txt.tmp", "test.txt");
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

  describe("writeBinaryFile", () => {
    it("writes to a temp path then renames, so a crash cannot leave a half file", async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      await NativeAdapter.writeBinaryFile("/dir/report.xlsx", bytes);

      expect(mkdir).toHaveBeenCalledWith("/mock/path", { recursive: true });
      expect(writeFile).toHaveBeenCalledWith("/dir/report.xlsx.tmp", bytes);
      expect(rename).toHaveBeenCalledWith("/dir/report.xlsx.tmp", "/dir/report.xlsx");
    });

    it("skips mkdir when the path has no parent directory", async () => {
      vi.mocked(dirname).mockResolvedValueOnce("");

      await NativeAdapter.writeBinaryFile("report.xlsx", new Uint8Array([1]));

      expect(mkdir).not.toHaveBeenCalled();
      expect(rename).toHaveBeenCalledWith("report.xlsx.tmp", "report.xlsx");
    });

    it("propagates a write failure rather than reporting success", async () => {
      vi.mocked(writeFile).mockRejectedValueOnce(new Error("disk full"));

      await expect(
        NativeAdapter.writeBinaryFile("/dir/report.xlsx", new Uint8Array([1])),
      ).rejects.toThrow("disk full");
      expect(rename).not.toHaveBeenCalled();
    });
  });

  describe("writeFile", () => {
    it("creates the parent directory before writing", async () => {
      await NativeAdapter.writeFile("/dir/a.txt", "x");
      expect(mkdir).toHaveBeenCalledWith("/mock/path", { recursive: true });
    });

    it("rethrows so callers can surface a failed save", async () => {
      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error("readonly"));
      await expect(NativeAdapter.writeFile("/dir/a.txt", "x")).rejects.toThrow("readonly");
    });

    it("does not rename when the temp write failed", async () => {
      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error("readonly"));
      await expect(NativeAdapter.writeFile("/dir/a.txt", "x")).rejects.toThrow();
      expect(rename).not.toHaveBeenCalled();
    });
  });

  describe("renameFile", () => {
    it("renames and rethrows on failure", async () => {
      await NativeAdapter.renameFile("/a", "/b");
      expect(rename).toHaveBeenCalledWith("/a", "/b");

      vi.mocked(rename).mockRejectedValueOnce(new Error("busy"));
      await expect(NativeAdapter.renameFile("/a", "/b")).rejects.toThrow("busy");
    });
  });

  describe("readFile", () => {
    it("rethrows so a missing profile is not mistaken for empty content", async () => {
      vi.mocked(readTextFile).mockRejectedValueOnce(new Error("ENOENT"));
      await expect(NativeAdapter.readFile("gone.txt")).rejects.toThrow("ENOENT");
    });
  });

  describe("fileExists", () => {
    it("reports what the filesystem says", async () => {
      vi.mocked(exists).mockResolvedValueOnce(true);
      await expect(NativeAdapter.fileExists("a.txt")).resolves.toBe(true);

      vi.mocked(exists).mockResolvedValueOnce(false);
      await expect(NativeAdapter.fileExists("a.txt")).resolves.toBe(false);
    });

    it("answers false rather than throwing when the check itself fails", async () => {
      // Callers use this to decide whether to seed a manifest; throwing here
      // would abort startup instead of creating one.
      vi.mocked(exists).mockRejectedValueOnce(new Error("permission denied"));
      await expect(NativeAdapter.fileExists("a.txt")).resolves.toBe(false);
    });
  });

  describe("saveDialog", () => {
    it("returns null when the user cancels", async () => {
      vi.mocked(save).mockResolvedValueOnce(null);
      await expect(NativeAdapter.saveDialog()).resolves.toBeNull();
    });

    it("returns null rather than throwing when the dialog fails", async () => {
      vi.mocked(save).mockRejectedValueOnce(new Error("no display"));
      await expect(NativeAdapter.saveDialog()).resolves.toBeNull();
    });

    it("forwards filters and default path through to the shell", async () => {
      vi.mocked(save).mockResolvedValueOnce("/out.json");
      const filters = [{ name: "JSON", extensions: ["json"] }];

      await NativeAdapter.saveDialog({ defaultPath: "out.json", filters });

      expect(save).toHaveBeenCalledWith({ defaultPath: "out.json", filters });
    });
  });

  describe("openDialog", () => {
    it("returns the selected path", async () => {
      vi.mocked(open).mockResolvedValueOnce("/in.json");
      await expect(NativeAdapter.openDialog()).resolves.toBe("/in.json");
    });

    it("supports multi-select and forwards filters", async () => {
      vi.mocked(open).mockResolvedValueOnce(["/a.json", "/b.json"]);
      const filters = [{ name: "JSON", extensions: ["json"] }];

      const result = await NativeAdapter.openDialog({ multiple: true, filters });

      expect(result).toEqual(["/a.json", "/b.json"]);
      expect(open).toHaveBeenCalledWith({ multiple: true, filters });
    });

    it("returns null rather than throwing when the dialog fails", async () => {
      vi.mocked(open).mockRejectedValueOnce(new Error("no display"));
      await expect(NativeAdapter.openDialog()).resolves.toBeNull();
    });
  });

  describe("outside the desktop shell", () => {
    beforeEach(() => {
      // Every entry point guards on isTauriEnv; without the guard these would
      // try to import Tauri plugins in a browser and crash the page.
      vi.unstubAllGlobals();
    });

    it("refuses filesystem work", async () => {
      await expect(NativeAdapter.writeFile("a.txt", "x")).rejects.toThrow(/not available/);
      await expect(NativeAdapter.readFile("a.txt")).rejects.toThrow(/not available/);
      await expect(NativeAdapter.removeFile("a.txt")).rejects.toThrow(/not available/);
      await expect(NativeAdapter.renameFile("a", "b")).rejects.toThrow(/not available/);
      await expect(NativeAdapter.writeBinaryFile("a.bin", new Uint8Array([1]))).rejects.toThrow(
        /not available/,
      );
    });

    it("degrades to a safe answer where the caller expects one", async () => {
      await expect(NativeAdapter.fileExists("a.txt")).resolves.toBe(false);
      await expect(NativeAdapter.saveDialog()).resolves.toBeNull();
      await expect(NativeAdapter.openDialog()).resolves.toBeNull();
    });
  });
});
