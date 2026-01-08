# Specification: Core Profile Management & Tauri Integration

## 1. Overview
This track focuses on transforming EduScheduler Pro from a single-tenant web application into a multi-tenant, desktop-first Windows application using Tauri. The core objective is to enable users to manage multiple distinct "Profiles" (e.g., Term 1 2026, Draft Scenario B) with seamless switching and robust local file persistence.

## 2. Goals
*   **Desktop Foundation:** Initialize Tauri and configure the project for native Windows compilation.
*   **Native I/O:** Replace browser-based file handling with native OS file system dialogs and direct reads/writes.
*   **Multi-Tenancy:** Implement a robust `Profile` data structure that wraps all application state (`AppData`), allowing for isolated environments.
*   **Profile Management UI:** Create a persistent sidebar/switcher and a wizard-style interface for creating and managing profiles.

## 3. Key Features & Requirements

### 3.1 Tauri Integration
*   **Window Management:** App must launch in a dedicated window with native frame controls.
*   **File System:**
    *   Use `tauri-plugin-fs` (or equivalent) for secure file access.
    *   Implement "Save As" and "Open" using native Windows dialogs.
    *   Support auto-saving to a designated application data directory.

### 3.2 Profile Architecture
*   **Schema:**
    ```typescript
    interface Profile {
        id: string;
        name: string;
        created: number;
        lastModified: number;
        data: AppData; // The existing scheduling state
        meta: {
            description?: string;
            academicYear?: string;
        }
    }
    ```
*   **Persistence:** Profiles should be stored as individual JSON files in the user's local application data folder, indexed by a master `manifest.json`.

### 3.3 User Interface
*   **Sidebar Switcher:** A persistent vertical tab list on the left (collapsible) showing active profiles.
*   **Profile Wizard:** A non-modal or focused interface to:
    1.  Name the profile.
    2.  Select a starting template (Empty, Clone Existing, Demo).
    3.  Set basic metadata (Year, Term).

## 4. Technical Considerations
*   **State Migration:** Existing `localStorage` data must be migrated into a "Default Profile" upon first launch.
*   **Performance:** Loading a profile should be asynchronous and show a loading indicator, but switching should feel near-instant for cached profiles.
*   **Security:** Ensure file access is scoped strictly to the application's allowed directories.

## 5. Success Criteria
*   Application compiles to a `.exe` and runs on Windows 10/11.
*   User can create a new profile, switch to it, make changes, switch back to the old one, and see that states are preserved independently.
*   "Save" operation writes to a verified location on the disk.
