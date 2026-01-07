import { writeTextFile, readTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';

/**
 * Writes text content to a file at the specified path.
 * @param path - The absolute path or path relative to BaseDirectory.
 * @param content - The string content to write.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    await writeTextFile(path, content);
  } catch (error) {
    console.error(`Failed to write file to ${path}:`, error);
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
export async function saveDialog(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
  try {
    const result = await save({
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result;
  } catch (error) {
    console.error('Failed to open save dialog:', error);
    return null;
  }
}

/**
 * Opens a native open dialog.
 * @param options - Dialog options.
 * @returns The selected path(s) or null.
 */
export async function openDialog(options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }): Promise<string | string[] | null> {
  try {
    const result = await open({
      multiple: options?.multiple,
      filters: options?.filters,
    });
    return result;
  } catch (error) {
    console.error('Failed to open dialog:', error);
    return null;
  }
}
