import { isTauriEnv, getTauriPath } from "../utils/platform";
import * as NativeAdapter from "./fileSystem/nativeAdapter";

export interface CrashReport {
  timestamp: string;
  message: string;
  stack?: string;
  type: "error" | "unhandledrejection" | "react" | "worker" | "manual";
  userAgent: string;
  environment: "tauri" | "web";
  context?: any;
}

const WEB_CRASH_LOG_KEY = "eduscheduler_crash_logs";
const MAX_WEB_LOGS = 50;

async function getTauriLogPath(): Promise<string> {
  const pathApi = await getTauriPath();
  if (!pathApi) return "crash.log";
  const base = await pathApi.appDataDir();
  const dir = await pathApi.join(base, "logs");
  return await pathApi.join(dir, "crash.log");
}

export const errorReporter = {
  /**
   * Initialize global error listeners.
   */
  init() {
    if (typeof window === "undefined") return;

    window.addEventListener("error", (event) => {
      this.reportError(event.error || new Error(event.message), {
        type: "error",
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.reportError(error, {
        type: "unhandledrejection",
      });
    });

    console.log("Structured error reporter initialized.");
  },

  /**
   * Core reporting function.
   */
  async reportError(
    error: Error,
    options?: {
      type?: CrashReport["type"];
      context?: any;
    },
  ) {
    const report: CrashReport = {
      timestamp: new Date().toISOString(),
      message: error.message || "Unknown error",
      stack: error.stack,
      type: options?.type || "manual",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Node/Unknown",
      environment: isTauriEnv() ? "tauri" : "web",
      context: options?.context,
    };

    // Print to console
    console.error("[Structured Error Report]:", report);

    try {
      if (isTauriEnv()) {
        const logPath = await getTauriLogPath();
        let existingContent = "";
        try {
          if (await NativeAdapter.fileExists(logPath)) {
            existingContent = await NativeAdapter.readFile(logPath);
          }
        } catch (e) {
          // File doesn't exist or read fails, ignore and overwrite
        }

        let logs: CrashReport[] = [];
        if (existingContent.trim()) {
          try {
            logs = JSON.parse(existingContent);
            if (!Array.isArray(logs)) logs = [];
          } catch (e) {
            logs = [];
          }
        }

        logs.push(report);
        // Keep last 100 logs in desktop app
        if (logs.length > 100) {
          logs = logs.slice(logs.length - 100);
        }

        await NativeAdapter.writeFile(logPath, JSON.stringify(logs, null, 2));
      } else {
        // Web LocalStorage save
        let logs: CrashReport[] = [];
        const existing = localStorage.getItem(WEB_CRASH_LOG_KEY);
        if (existing) {
          try {
            logs = JSON.parse(existing);
            if (!Array.isArray(logs)) logs = [];
          } catch (e) {
            logs = [];
          }
        }

        logs.push(report);
        if (logs.length > MAX_WEB_LOGS) {
          logs = logs.slice(logs.length - MAX_WEB_LOGS);
        }

        localStorage.setItem(WEB_CRASH_LOG_KEY, JSON.stringify(logs));
      }
    } catch (saveError) {
      console.error("Failed to save crash report:", saveError);
    }
  },

  /**
   * Retrieve all logged crashes.
   */
  async getCrashLogs(): Promise<CrashReport[]> {
    try {
      if (isTauriEnv()) {
        const logPath = await getTauriLogPath();
        if (await NativeAdapter.fileExists(logPath)) {
          const content = await NativeAdapter.readFile(logPath);
          return JSON.parse(content);
        }
        return [];
      } else {
        const existing = localStorage.getItem(WEB_CRASH_LOG_KEY);
        return existing ? JSON.parse(existing) : [];
      }
    } catch (e) {
      console.error("Failed to retrieve crash logs:", e);
      return [];
    }
  },

  /**
   * Clear crash logs.
   */
  async clearCrashLogs() {
    try {
      if (isTauriEnv()) {
        const logPath = await getTauriLogPath();
        if (await NativeAdapter.fileExists(logPath)) {
          await NativeAdapter.writeFile(logPath, JSON.stringify([]));
        }
      } else {
        localStorage.removeItem(WEB_CRASH_LOG_KEY);
      }
    } catch (e) {
      console.error("Failed to clear crash logs:", e);
    }
  },
};
