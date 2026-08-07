import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileService } from "../src/services/fileSystem";
import * as NativeAdapter from "../src/services/fileSystem/nativeAdapter";
import { isTauriEnv } from "../src/utils/platform";
import { notify } from "../src/components/ui/Toast";
import { DEFAULT_DATA } from "../src/utils/constants";

vi.mock("../src/services/fileSystem/nativeAdapter", () => ({
  saveDialog: vi.fn(),
  openDialog: vi.fn(),
  writeFile: vi.fn(),
  writeBinaryFile: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("../src/utils/platform", () => ({
  isTauriEnv: vi.fn(),
  getTauriPath: vi.fn(),
}));

vi.mock("../src/components/ui/Toast", () => ({
  notify: vi.fn(),
}));

const asTauri = () => vi.mocked(isTauriEnv).mockReturnValue(true);
const asWeb = () => vi.mocked(isTauriEnv).mockReturnValue(false);

/**
 * jsdom's Blob has no arrayBuffer(), which the desktop export path relies on.
 * A stub keeps the test about FileService rather than about jsdom.
 */
const fakeBlob = (bytes: number[] = [1, 2, 3]): Blob =>
  ({
    type: "application/octet-stream",
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  }) as unknown as Blob;

/** Anchors the service creates for browser downloads, newest last. */
const createdAnchors: HTMLAnchorElement[] = [];

describe("FileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdAnchors.length = 0;

    // jsdom implements neither object URLs nor navigation on click.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === "a") createdAnchors.push(el as HTMLAnchorElement);
      return el;
    }) as typeof document.createElement);

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveProject (desktop)", () => {
    it("writes the serialized project to the chosen path", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue("/tmp/out.json");

      const result = await FileService.saveProject(DEFAULT_DATA, "myschool");

      expect(result).toEqual({ success: true, path: "/tmp/out.json" });
      const [path, content] = vi.mocked(NativeAdapter.writeFile).mock.calls[0];
      expect(path).toBe("/tmp/out.json");
      expect(JSON.parse(content as string)).toEqual(DEFAULT_DATA);
    });

    it("offers a dated default filename built from the given stem", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue("/tmp/out.json");

      await FileService.saveProject(DEFAULT_DATA, "myschool");

      const [options] = vi.mocked(NativeAdapter.saveDialog).mock.calls[0];
      expect((options as { defaultPath: string }).defaultPath).toMatch(
        /^myschool_\d{4}-\d{2}-\d{2}\.json$/,
      );
    });

    it("writes nothing when the user cancels the dialog", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue(null);

      const result = await FileService.saveProject(DEFAULT_DATA);

      expect(result).toEqual({ success: false });
      expect(NativeAdapter.writeFile).not.toHaveBeenCalled();
    });

    it("reports failure when the write throws", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue("/tmp/out.json");
      vi.mocked(NativeAdapter.writeFile).mockRejectedValue(new Error("disk full"));

      const result = await FileService.saveProject(DEFAULT_DATA);

      expect(result).toEqual({ success: false });
    });
  });

  describe("saveProject (web)", () => {
    it("falls back to a browser download", async () => {
      asWeb();

      const result = await FileService.saveProject(DEFAULT_DATA);

      expect(result).toEqual({ success: true });
      expect(createdAnchors.at(-1)?.download).toMatch(/^school_schedule_\d{4}-\d{2}-\d{2}\.json$/);
      expect(NativeAdapter.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("loadProjectNative", () => {
    it("returns nothing outside the desktop shell", async () => {
      asWeb();
      await expect(FileService.loadProjectNative()).resolves.toEqual({ data: null, path: "" });
      expect(NativeAdapter.openDialog).not.toHaveBeenCalled();
    });

    it("reads and validates the selected file", async () => {
      asTauri();
      vi.mocked(NativeAdapter.openDialog).mockResolvedValue("/tmp/in.json");
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(DEFAULT_DATA));

      const result = await FileService.loadProjectNative();

      expect(result.path).toBe("/tmp/in.json");
      expect(result.data).toMatchObject({ subjects: expect.any(Array) });
    });

    it("returns nothing when the user cancels", async () => {
      asTauri();
      vi.mocked(NativeAdapter.openDialog).mockResolvedValue(null);

      await expect(FileService.loadProjectNative()).resolves.toEqual({ data: null, path: "" });
    });

    it("swallows malformed JSON rather than throwing at the caller", async () => {
      asTauri();
      vi.mocked(NativeAdapter.openDialog).mockResolvedValue("/tmp/in.json");
      vi.mocked(NativeAdapter.readFile).mockResolvedValue("{not json");

      await expect(FileService.loadProjectNative()).resolves.toEqual({ data: null, path: "" });
    });
  });

  describe("saveExport", () => {
    it("writes binary content and confirms the path to the user", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue("/tmp/report.xlsx");

      const result = await FileService.saveExport(fakeBlob([1, 2, 3]), "report.xlsx", "xlsx");

      expect(result).toEqual({ success: true, path: "/tmp/report.xlsx" });
      const [path, bytes] = vi.mocked(NativeAdapter.writeBinaryFile).mock.calls[0];
      expect(path).toBe("/tmp/report.xlsx");
      expect(Array.from(bytes as Uint8Array)).toEqual([1, 2, 3]);
      expect(notify).toHaveBeenCalledWith(expect.stringContaining("/tmp/report.xlsx"), "success");
    });

    it("writes nothing when the user cancels", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue(null);

      const result = await FileService.saveExport(fakeBlob(), "r.xlsx", "xlsx");

      expect(result).toEqual({ success: false });
      expect(NativeAdapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it("surfaces the underlying reason when the write is refused", async () => {
      asTauri();
      vi.mocked(NativeAdapter.saveDialog).mockResolvedValue("/root/report.xlsx");
      vi.mocked(NativeAdapter.writeBinaryFile).mockRejectedValue(new Error("forbidden path"));

      const result = await FileService.saveExport(fakeBlob(), "r.xlsx", "xlsx");

      expect(result).toEqual({ success: false });
      expect(notify).toHaveBeenCalledWith(expect.stringContaining("forbidden path"), "error");
    });

    it("falls back to a browser download on web", async () => {
      asWeb();

      const result = await FileService.saveExport(fakeBlob(), "r.xlsx", "xlsx");

      expect(result).toEqual({ success: true });
      expect(createdAnchors.at(-1)?.download).toBe("r.xlsx");
      expect(NativeAdapter.writeBinaryFile).not.toHaveBeenCalled();
    });
  });

  describe("webDownload", () => {
    it("names the download and releases the object URL", async () => {
      const result = await FileService.webDownload("payload", "out.json", "application/json");

      expect(result).toEqual({ success: true });
      expect(createdAnchors.at(-1)?.download).toBe("out.json");
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });

    it("reports failure instead of throwing when the DOM refuses", async () => {
      vi.spyOn(document, "createElement").mockImplementation(() => {
        throw new Error("no DOM");
      });

      await expect(
        FileService.webDownload("payload", "out.json", "application/json"),
      ).resolves.toEqual({ success: false });
    });
  });

  describe("parseJsonFile", () => {
    it("validates a well-formed backup", async () => {
      const file = new File([JSON.stringify(DEFAULT_DATA)], "backup.json", {
        type: "application/json",
      });

      await expect(FileService.parseJsonFile(file)).resolves.toMatchObject({
        subjects: expect.any(Array),
      });
    });

    it("rejects malformed JSON", async () => {
      const file = new File(["{not json"], "backup.json", { type: "application/json" });

      await expect(FileService.parseJsonFile(file)).rejects.toThrow();
    });

    it("rejects an empty file", async () => {
      const file = new File([""], "backup.json", { type: "application/json" });

      await expect(FileService.parseJsonFile(file)).rejects.toThrow();
    });
  });
});
