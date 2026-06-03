import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { errorReporter } from "../src/services/errorReporter";
import * as NativeAdapter from "../src/services/fileSystem/nativeAdapter";

// Mock platform
let mockIsTauri = false;
vi.mock("../src/utils/platform", () => ({
  isTauriEnv: () => mockIsTauri,
  isWebEnv: () => !mockIsTauri,
  getTauriPath: vi.fn().mockResolvedValue({
    appDataDir: vi.fn().mockResolvedValue("/mock/appdata"),
    join: vi.fn().mockImplementation(async (...args: string[]) => args.join("/")),
  }),
}));

// Mock nativeAdapter
vi.mock("../src/services/fileSystem/nativeAdapter", () => ({
  fileExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe("errorReporter service", () => {
  let consoleLogMock: any;
  let consoleErrorMock: any;

  beforeAll(() => {
    errorReporter.init();
  });

  beforeEach(() => {
    mockIsTauri = false;
    localStorage.clear();
    vi.clearAllMocks();

    consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  describe("Web Environment", () => {
    it("should initialize listeners and report window error", async () => {
      // Dispatch error event
      const testError = new Error("Test Window Error");
      window.dispatchEvent(
        new ErrorEvent("error", {
          error: testError,
          filename: "test.js",
          lineno: 10,
          colno: 5,
        }),
      );

      // Verify log in console
      expect(consoleErrorMock).toHaveBeenCalled();

      // Retrieve logs
      const logs = await errorReporter.getCrashLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe("Test Window Error");
      expect(logs[0].type).toBe("error");
      expect(logs[0].environment).toBe("web");
      expect(logs[0].context).toEqual({
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });
    });

    it("should report unhandled rejection", async () => {
      // Dispatch unhandledrejection
      window.dispatchEvent(
        new PromiseRejectionEvent("unhandledrejection", {
          promise: Promise.resolve(),
          reason: new Error("Test Rejection"),
        }),
      );

      const logs = await errorReporter.getCrashLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe("Test Rejection");
      expect(logs[0].type).toBe("unhandledrejection");
    });

    it("should report manual error and cap logs size at 50", async () => {
      // Add 55 errors
      for (let i = 1; i <= 55; i++) {
        await errorReporter.reportError(new Error(`Error ${i}`));
      }

      const logs = await errorReporter.getCrashLogs();
      expect(logs.length).toBe(50);
      expect(logs[0].message).toBe("Error 6");
      expect(logs[49].message).toBe("Error 55");
    });

    it("should clear crash logs", async () => {
      await errorReporter.reportError(new Error("Some Error"));
      let logs = await errorReporter.getCrashLogs();
      expect(logs.length).toBe(1);

      await errorReporter.clearCrashLogs();
      logs = await errorReporter.getCrashLogs();
      expect(logs.length).toBe(0);
    });

    it("should handle corrupted json in localStorage", async () => {
      localStorage.setItem("eduscheduler_crash_logs", "invalid-json{");
      const logs = await errorReporter.getCrashLogs();
      expect(logs).toEqual([]);

      // Writing another error should recover
      await errorReporter.reportError(new Error("Recovered Error"));
      const newLogs = await errorReporter.getCrashLogs();
      expect(newLogs.length).toBe(1);
      expect(newLogs[0].message).toBe("Recovered Error");
    });
  });

  describe("Tauri Environment", () => {
    beforeEach(() => {
      mockIsTauri = true;
    });

    it("should read and write Tauri file system for error reports", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true);
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(
        JSON.stringify([{ message: "Old Error" }]),
      );

      await errorReporter.reportError(new Error("New Desktop Error"));

      expect(NativeAdapter.writeFile).toHaveBeenCalled();
      const [path, content] = vi.mocked(NativeAdapter.writeFile).mock.calls[0];
      expect(path).toContain("crash.log");

      const parsed = JSON.parse(content as string);
      expect(parsed.length).toBe(2);
      expect(parsed[0].message).toBe("Old Error");
      expect(parsed[1].message).toBe("New Desktop Error");
    });

    it("should get logs from file system when file exists", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true);
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(
        JSON.stringify([{ message: "File Log" }]),
      );

      const logs = await errorReporter.getCrashLogs();
      expect(logs).toEqual([{ message: "File Log" }]);
    });

    it("should return empty array if file does not exist", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(false);
      const logs = await errorReporter.getCrashLogs();
      expect(logs).toEqual([]);
    });

    it("should clear desktop logs by writing empty array to file", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true);
      await errorReporter.clearCrashLogs();
      expect(NativeAdapter.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("crash.log"),
        "[]",
      );
    });

    it("should cap desktop logs at 100", async () => {
      vi.mocked(NativeAdapter.fileExists).mockResolvedValue(true);
      // Simulate existing 105 logs
      const existing = Array(105)
        .fill(null)
        .map((_, i) => ({ message: `Error ${i}` }));
      vi.mocked(NativeAdapter.readFile).mockResolvedValue(JSON.stringify(existing));

      await errorReporter.reportError(new Error("One More"));

      const [, content] = vi.mocked(NativeAdapter.writeFile).mock.calls[0];
      const parsed = JSON.parse(content as string);
      expect(parsed.length).toBe(100);
      expect(parsed[0].message).toBe("Error 6");
      expect(parsed[99].message).toBe("One More");
    });
  });
});
