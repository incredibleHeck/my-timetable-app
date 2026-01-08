# Specification: Web Compatibility & Tauri Isolation

## Overview
This track addresses runtime crashes and functional regressions encountered when running the EduScheduler Pro application in a standard web browser environment after the initial Tauri migration.

## Goals
*   Isolate Tauri-specific dependencies to prevent crashes in non-Tauri environments.
*   Restore file saving and exporting capabilities for web users via browser-native APIs.
*   Provide clear visual indicators when the application is running in "Web Mode."

## Technical Changes
*   **Platform Detection:** Consolidated environment checks into `src/utils/platform.ts`.
*   **Dynamic Imports:** Refactored `nativeAdapter.ts` and `profileStorage.ts` to use dynamic `import()` for `@tauri-apps` packages, ensuring they are only loaded when `isTauriEnv()` is true.
*   **Profile Persistence:** Implemented `localStorage` fallback in `profileStorage.ts` for web-mode profile management.
*   **Web Fallbacks:** Ensured `FileService` correctly routes `saveProject` and `saveExport` to `webDownload` (Blob/URL-based) when native dialogs are unavailable.

## UI/UX Impact
*   **Header Badge:** A new "Web Mode" badge appears in the header when running in a browser.
*   **Visual Cues:** The header background shifts to a subtle blue tint in web mode to differentiate from the native white/slate desktop theme.
*   **Adaptive Labels:** Sidebar "Save" button text changes from "Save/Save As" to "Save to Device" in web mode.
