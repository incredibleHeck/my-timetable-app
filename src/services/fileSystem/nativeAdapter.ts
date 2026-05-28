import { isTauriEnv } from "../../utils/platform";

// Dynamic imports for Tauri plugins to prevent crashes in non-Tauri environments.

const getFs = async () => {
  if (isTauriEnv()) {
    return await import("@tauri-apps/plugin-fs");
  }
  throw new Error("Tauri FS plugin is not available in this environment");
};

const getPath = async () => {
  if (isTauriEnv()) {
    return await import("@tauri-apps/api/path");
  }
  throw new Error("Tauri Path API is not available in this environment");
};

const getDialog = async () => {
  if (isTauriEnv()) {
    return await import("@tauri-apps/plugin-dialog");
  }
  throw new Error("Tauri Dialog plugin is not available in this environment");
};

/**
 * Writes binary content to a file.
 * @param path - The absolute path.
 * @param content - The Uint8Array content.
 */
export async function writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
  const { writeFile, mkdir, rename } = await getFs();
  const { dirname } = await getPath();
  const dir = await dirname(path);
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, content);
  await rename(tempPath, path);
}

/**
 * Writes text content to a file at the specified path.
 * @param path - The absolute path or path relative to BaseDirectory.
 * @param content - The string content to write.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    const { writeTextFile, mkdir, rename } = await getFs();
    const { dirname } = await getPath();
    const dir = await dirname(path);
    if (dir) {
      await mkdir(dir, { recursive: true });
    }
    const tempPath = `${path}.tmp`;
    await writeTextFile(tempPath, content);
    await rename(tempPath, path);
  } catch (error) {
    console.error(`Failed to write file to ${path}:`, error);
    throw error;
  }
}

/**
 * Renames a file from one path to another.
 * @param oldPath - The absolute source path.
 * @param newPath - The absolute destination path.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  try {
    const { rename } = await getFs();
    await rename(oldPath, newPath);
  } catch (error) {
    console.error(`Failed to rename file from ${oldPath} to ${newPath}:`, error);
    throw error;
  }
}

/**
 * Reads text content from a file at the specified path.
 * @param path - The absolute path or path relative to BaseDirectory.
 * @returns The file content as a string.
 */
export async function readFile(path: string): Promise<string> {
  try {
    const { readTextFile } = await getFs();
    return await readTextFile(path);
  } catch (error) {
    console.error(`Failed to read file from ${path}:`, error);
    throw error;
  }
}

/**
 * Checks if a file exists at the specified path.
 * @param path - The absolute path.
 * @returns True if exists, false otherwise.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const { exists } = await getFs();
    return await exists(path);
  } catch (error) {
    console.error(`Failed to check existence of ${path}:`, error);
    return false;
  }
}

/**
 * Opens a native save dialog.
 * @param options - Dialog options (filters, default path).
 * @returns The selected path or null if cancelled.
 */
export async function saveDialog(options?: {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  try {
    const { save } = await getDialog();
    const result = await save({
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result;
  } catch (error) {
    console.error("Failed to open save dialog:", error);
    return null;
  }
}

/**
 * Opens a native open dialog.
 * @param options - Dialog options.
 * @returns The selected path(s) or null.
 */
export async function openDialog(options?: {
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | string[] | null> {
  try {
    const { open } = await getDialog();
    const result = await open({
      multiple: options?.multiple,
      filters: options?.filters,
    });
    return result;
  } catch (error) {
    console.error("Failed to open dialog:", error);
    return null;
  }
}

/**
 * Deletes a file.
 * @param path - The absolute path.
 */
export async function removeFile(path: string): Promise<void> {
  try {
    const { remove } = await getFs();
    await remove(path);
  } catch (error) {
    console.error(`Failed to remove file ${path}:`, error);
    throw error;
  }
}
