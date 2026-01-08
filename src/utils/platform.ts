/**
 * Platform and environment detection utilities.
 */

/**
 * Checks if the application is currently running within a Tauri environment.
 */
export const isTauriEnv = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__)
  );
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
    return await import('@tauri-apps/api/path');
  }
  return null;
};
