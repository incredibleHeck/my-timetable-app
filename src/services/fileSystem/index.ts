import { AppData } from "../../types";
import { sanitizeAppData } from "./sanitization";

// --- TAURI TYPES (Desktop Wrapper) ---
declare global {
  interface Window {
    __TAURI__?: {
      dialog: {
        save(options?: any): Promise<string | null>;
        open(options?: any): Promise<string | string[] | null>;
      };
      fs: {
        writeTextFile(path: string, contents: string): Promise<void>;
        readTextFile(path: string): Promise<string>;
      };
    };
  }
}

export const FileService = {
  get isTauri(): boolean {
    return typeof window !== "undefined" && !!window.__TAURI__;
  },

  /**
   * Saves the current project state.
   * - Desktop: Opens Native Save Dialog.
   * - Web: Triggers "Download" of .json file.
   */
  async saveProject(
    data: AppData,
    filename: string = "school_schedule"
  ): Promise<{ success: boolean; path?: string }> {
    const content = JSON.stringify(data, null, 2);
    const defaultName = `${filename}_${
      new Date().toISOString().split("T")[0]
    }.json`;

    if (this.isTauri) {
      try {
        const savePath = await window.__TAURI__!.dialog.save({
          defaultPath: defaultName,
          filters: [{ name: "JSON Schedule", extensions: ["json"] }],
        });

        if (savePath) {
          await window.__TAURI__!.fs.writeTextFile(savePath, content);
          return { success: true, path: savePath };
        }
        return { success: false }; // User cancelled
      } catch (e) {
        console.error("Tauri Save Error:", e);
        return { success: false };
      }
    } else {
      // --- WEB FALLBACK ---
      try {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = defaultName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { success: true };
      } catch (e) {
        console.error("Web Save Error:", e);
        return { success: false };
      }
    }
  },

  /**
   * Loads a project file.
   * - Desktop: Opens Native Open Dialog.
   * - Web: Returns null (Web must use <input type="file"> and call parseJsonFile).
   */
  async loadProjectNative(): Promise<{ data: AppData | null; path: string }> {
    if (!this.isTauri) return { data: null, path: "" };

    try {
      const selected = await window.__TAURI__!.dialog.open({
        multiple: false,
        filters: [{ name: "JSON Schedule", extensions: ["json"] }],
      });

      if (selected && typeof selected === "string") {
        const content = await window.__TAURI__!.fs.readTextFile(selected);
        const raw = JSON.parse(content);
        return { data: sanitizeAppData(raw), path: selected };
      }
      return { data: null, path: "" };
    } catch (e) {
      console.error("Tauri Open Error:", e);
      return { data: null, path: "" };
    }
  },

  /**
   * Helper for Web Mode: Parses a File object from an <input>
   */
  async parseJsonFile(file: File): Promise<AppData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          if (!event.target?.result) throw new Error("File is empty");
          const raw = JSON.parse(event.target.result as string);
          const cleanData = sanitizeAppData(raw);
          resolve(cleanData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },
};

