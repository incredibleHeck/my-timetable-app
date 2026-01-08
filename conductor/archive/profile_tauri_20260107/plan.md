# Plan: Core Profile Management & Tauri Integration

## Phase 1: Tauri Setup & Native I/O
*Goal: Establish the desktop environment and replace browser APIs with native system calls.*

- [x] Task: Install and Configure Tauri
    - [x] Sub-task: Write Tests: Verify Tauri build scripts and configuration validation.
    - [x] Sub-task: Implement Feature: Run `npm install @tauri-apps/cli @tauri-apps/api` and `npx tauri init`. Configure `tauri.conf.json` for Windows targets.
- [x] Task: Implement Native File System Service
    - [x] Sub-task: Write Tests: Mock Tauri API to test `FileSystemService` methods (read, write, exists).
    - [x] Sub-task: Implement Feature: Create `src/services/fileSystem/nativeAdapter.ts` using Tauri FS APIs. Implement robust error handling.
- [x] Task: Replace Browser Downloads with Native Save
    - [x] Sub-task: Write Tests: Ensure export functions call the new Native Adapter instead of `file-saver`.
    - [x] Sub-task: Implement Feature: Refactor `src/services/export/*.ts` to use the `NativeAdapter`. Add "Save As" dialog support.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Tauri Setup & Native I/O' (Protocol in workflow.md)

## Phase 2: Profile Data Architecture
*Goal: Refactor the state management to support multiple isolated profiles.*

- [x] Task: Define Profile Types and Schema
    - [x] Sub-task: Write Tests: Unit tests for Profile validation logic (zod or manual).
    - [x] Sub-task: Implement Feature: Create `src/types/profile.ts`. Define `Profile`, `ProfileManifest`, and `ProfileMetadata` interfaces.
- [x] Task: Create Profile Storage Service
    - [x] Sub-task: Write Tests: Test CRUD operations (create, list, update, delete) for profiles using the Native Adapter.
    - [x] Sub-task: Implement Feature: Implement `src/services/profile/profileStorage.ts`. Handle `manifest.json` indexing and individual profile file IO.
- [x] Task: State Migration Strategy
    - [x] Sub-task: Write Tests: Verify that legacy `localStorage` data is correctly transformed into a Profile object.
    - [x] Sub-task: Implement Feature: Create `src/services/profile/migration.ts`. run on startup to convert existing data to "Default Profile".
- [x] Task: Conductor - User Manual Verification 'Phase 2: Profile Data Architecture' (Protocol in workflow.md)

## Phase 3: Profile Management UI
*Goal: Build the visual tools for users to manage and switch contexts.*

- [x] Task: Implement Global Profile Context
    - [x] Sub-task: Write Tests: Test `ProfileContext` provider for switching active profile ID and exposing current data.
    - [x] Sub-task: Implement Feature: Wrap `App.tsx` with `ProfileProvider`. Refactor `useDashboard` etc. to consume from this context.
- [x] Task: Build Sidebar Profile Switcher
    - [x] Sub-task: Write Tests: Component tests for `Sidebar.tsx` rendering the list of profiles from the manifest.
    - [x] Sub-task: Implement Feature: Update `src/components/layout/Sidebar.tsx` to include a dynamic list of profiles. Add "Active" visual state.
- [x] Task: Build Profile Creation Wizard
    - [x] Sub-task: Write Tests: Interaction tests for the wizard flow (Name input -> Template selection -> Create).
    - [x] Sub-task: Implement Feature: Create `src/features/configuration/components/ProfileWizard.tsx`. Implement "Clone" and "New" logic.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Profile Management UI' (Protocol in workflow.md)

## Phase 4: Desktop Polish & Packaging
*Goal: Ensure the app feels native and produce the final executable.*

- [x] Task: Window & Menu Bar Customization
    - [x] Sub-task: Write Tests: Verify menu commands trigger correct app actions (mocked).
    - [x] Sub-task: Implement Feature: Configure custom native menu bar (File -> New Profile, View -> Zoom).
- [x] Task: End-to-End Workflow Verification
    - [x] Sub-task: Write Tests: E2E test (if possible with Tauri driver) or detailed manual test script for full lifecycle.
    - [x] Sub-task: Implement Feature: Perform final polish on transitions and loading states.
- [x] Task: Build Windows Installer
    - [x] Sub-task: Write Tests: Verify build artifacts exist in `src-tauri/target/release/bundle`.
    - [x] Sub-task: Implement Feature: Run `npm run tauri build`. Verify `.msi` or `.exe` installation.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Desktop Polish & Packaging' (Protocol in workflow.md)
