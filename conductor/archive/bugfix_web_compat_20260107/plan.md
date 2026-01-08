# Plan: Web Compatibility & Tauri Isolation

## Phase 1: Fix Web-Mode Runtime Crashes
*Goal: Ensure the application starts and functions correctly in a standard browser environment by isolating Tauri-specific dependencies.*

- [x] Task: Fix Tauri Plugin Import Crash
    - [x] Sub-task: Write Tests: Create a test case in `tests/web-compat.test.ts` that simulates a non-Tauri environment and verifies that `FileService` can be imported without throwing.
    - [x] Sub-task: Implement Feature: Refactor `src/services/fileSystem/nativeAdapter.ts` to use dynamic imports for `@tauri-apps` plugins, ensuring they are only loaded when `isTauri` is true.
- [x] Task: Restore Web-Mode File Downloads
    - [x] Sub-task: Write Tests: Verify that `FileService.saveProject` and `FileService.saveExport` successfully trigger `webDownload` when running in a browser.
    - [x] Sub-task: Implement Feature: Ensure `FileService` correctly routes all calls to web fallbacks and that the `webDownload` helper handles all necessary MIME types and blob conversions.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Fix Web-Mode Runtime Crashes' (Protocol in workflow.md)

## Phase 2: Environment Detection & UI Polish
*Goal: Refine how the app identifies its environment and provide clear feedback to the user.*

- [x] Task: Robust Environment Detection
    - [x] Sub-task: Write Tests: Test `isTauriEnv` helper across different mock window states.
    - [x] Sub-task: Implement Feature: Move `isTauriEnv` to a dedicated utility and ensure it is the single source of truth for environment-specific logic.
- [x] Task: Native UI Fallbacks
    - [x] Sub-task: Write Tests: Verify UI components (like the sidebar) don't crash when native features (like file paths) are unavailable.
    - [x] Sub-task: Implement Feature: Provide visual cues or "Web Mode" indicators in the UI when native desktop features are unavailable.
- [x] Task: Fix Profile Storage Web Crash
    - [x] Sub-task: Write Tests: Add test case in `tests/web-compat.test.ts` to verify `ProfileStorage` uses `localStorage` in web mode.
    - [x] Sub-task: Implement Feature: Refactor `src/services/profile/profileStorage.ts` to use dynamic imports for Tauri Path API and provide `localStorage` fallback.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Environment Detection & UI Polish' (Protocol in workflow.md)
