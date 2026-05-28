import { AppData } from "../../types";
import { sanitizeAppData } from "./sanitization";
import * as NativeAdapter from "./nativeAdapter";
import { isTauriEnv } from "../../utils/platform";
import { notify } from "../../components/ui/Toast";

export const FileService = {
  get isTauri(): boolean {
    return isTauriEnv();
  },

  /**
   * Saves the current project state.
   */
  async saveProject(
    data: AppData,
    filename: string = "school_schedule",
  ): Promise<{ success: boolean; path?: string }> {
    const content = JSON.stringify(data, null, 2);
    const defaultName = `${filename}_${new Date().toISOString().split("T")[0]}.json`;

    if (this.isTauri) {
      try {
        const savePath = await NativeAdapter.saveDialog({
          defaultPath: defaultName,
          filters: [{ name: "JSON Schedule", extensions: ["json"] }],
        });

        if (savePath) {
          await NativeAdapter.writeFile(savePath, content);
          return { success: true, path: savePath };
        }
        return { success: false };
      } catch (e) {
        console.error("Tauri Save Error:", e);
        return { success: false };
      }
    } else {
      return this.webDownload(content, defaultName, "application/json");
    }
  },

  /**
   * Loads a project file using native dialog.
   */
  async loadProjectNative(): Promise<{ data: AppData | null; path: string }> {
    if (!this.isTauri) return { data: null, path: "" };

    try {
      const selected = await NativeAdapter.openDialog({
        multiple: false,
        filters: [{ name: "JSON Schedule", extensions: ["json"] }],
      });

      if (selected && typeof selected === "string") {
        const content = await NativeAdapter.readFile(selected);
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
   * Generic export saver (Excel, PDF, etc.)
   */
  async saveExport(
    blob: Blob,
    defaultName: string,
    extension: string,
  ): Promise<{ success: boolean; path?: string }> {
    if (this.isTauri) {
      try {
        const savePath = await NativeAdapter.saveDialog({
          defaultPath: defaultName,
          filters: [{ name: `${extension.toUpperCase()} File`, extensions: [extension] }],
        });

        if (savePath) {
          const arrayBuffer = await blob.arrayBuffer();
          await NativeAdapter.writeBinaryFile(savePath, new Uint8Array(arrayBuffer));
          notify(`File saved to ${savePath}`, "success");
          return { success: true, path: savePath };
        }
        return { success: false };
      } catch (e) {
        console.error("Tauri Export Error:", e);
        const detail = e instanceof Error ? e.message : "Permission denied or path not writable.";
        notify(`Could not save file. ${detail} Try Desktop, Documents, or Downloads.`, "error");
        return { success: false };
      }
    } else {
      return this.webDownload(blob, defaultName, blob.type);
    }
  },

  /**
   * Web download helper
   */
  async webDownload(content: string | Blob, filename: string, mimeType: string) {
    try {
      const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (e) {
      console.error("Web Download Error:", e);
      return { success: false };
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
