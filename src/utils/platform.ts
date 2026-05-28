/**
 * Platform and environment detection utilities.
 */

interface TauriWindow extends Window {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
}

/**
 * Checks if the application is currently running within a Tauri environment.
 */
export const isTauriEnv = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as TauriWindow;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
};

/**
 * Checks if the application is running in a web browser (non-Tauri).
 */
export const isWebEnv = (): boolean => {
  return !isTauriEnv();
};

/**
 * Gets Tauri path API if available.
 */
export const getTauriPath = async () => {
  if (isTauriEnv()) {
    return await import("@tauri-apps/api/path");
  }
  return null;
};
