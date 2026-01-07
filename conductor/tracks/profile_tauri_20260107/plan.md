# Plan: Core Profile Management & Tauri Integration

## Phase 1: Tauri Setup & Native I/O
*Goal: Establish the desktop environment and replace browser APIs with native system calls.*

- [ ] Task: Install and Configure Tauri
    - [ ] Sub-task: Write Tests: Verify Tauri build scripts and configuration validation.
    - [ ] Sub-task: Implement Feature: Run `npm install @tauri-apps/cli @tauri-apps/api` and `npx tauri init`. Configure `tauri.conf.json` for Windows targets.
- [ ] Task: Implement Native File System Service
    - [ ] Sub-task: Write Tests: Mock Tauri API to test `FileSystemService` methods (read, write, exists).
    - [ ] Sub-task: Implement Feature: Create `src/services/fileSystem/nativeAdapter.ts` using Tauri FS APIs. Implement robust error handling.
- [ ] Task: Replace Browser Downloads with Native Save
    - [ ] Sub-task: Write Tests: Ensure export functions call the new Native Adapter instead of `file-saver`.
    - [ ] Sub-task: Implement Feature: Refactor `src/services/export/*.ts` to use the `NativeAdapter`. Add "Save As" dialog support.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Tauri Setup & Native I/O' (Protocol in workflow.md)

## Phase 2: Profile Data Architecture
*Goal: Refactor the state management to support multiple isolated profiles.*

- [ ] Task: Define Profile Types and Schema
    - [ ] Sub-task: Write Tests: Unit tests for Profile validation logic (zod or manual).
    - [ ] Sub-task: Implement Feature: Create `src/types/profile.ts`. Define `Profile`, `ProfileManifest`, and `ProfileMetadata` interfaces.
- [ ] Task: Create Profile Storage Service
    - [ ] Sub-task: Write Tests: Test CRUD operations (create, list, update, delete) for profiles using the Native Adapter.
    - [ ] Sub-task: Implement Feature: Implement `src/services/profile/profileStorage.ts`. Handle `manifest.json` indexing and individual profile file IO.
- [ ] Task: State Migration Strategy
    - [ ] Sub-task: Write Tests: Verify that legacy `localStorage` data is correctly transformed into a Profile object.
    - [ ] Sub-task: Implement Feature: Create `src/services/profile/migration.ts`. run on startup to convert existing data to "Default Profile".
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Profile Data Architecture' (Protocol in workflow.md)

## Phase 3: Profile Management UI
*Goal: Build the visual tools for users to manage and switch contexts.*

- [ ] Task: Implement Global Profile Context
    - [ ] Sub-task: Write Tests: Test `ProfileContext` provider for switching active profile ID and exposing current data.
    - [ ] Sub-task: Implement Feature: Wrap `App.tsx` with `ProfileProvider`. Refactor `useDashboard` etc. to consume from this context.
- [ ] Task: Build Sidebar Profile Switcher
    - [ ] Sub-task: Write Tests: Component tests for `Sidebar.tsx` rendering the list of profiles from the manifest.
    - [ ] Sub-task: Implement Feature: Update `src/components/layout/Sidebar.tsx` to include a dynamic list of profiles. Add "Active" visual state.
- [ ] Task: Build Profile Creation Wizard
    - [ ] Sub-task: Write Tests: Interaction tests for the wizard flow (Name input -> Template selection -> Create).
    - [ ] Sub-task: Implement Feature: Create `src/features/configuration/components/ProfileWizard.tsx`. Implement "Clone" and "New" logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Profile Management UI' (Protocol in workflow.md)

## Phase 4: Desktop Polish & Packaging
*Goal: Ensure the app feels native and produce the final executable.*

- [ ] Task: Window & Menu Bar Customization
    - [ ] Sub-task: Write Tests: Verify menu commands trigger correct app actions (mocked).
    - [ ] Sub-task: Implement Feature: Configure custom native menu bar (File -> New Profile, View -> Zoom).
- [ ] Task: End-to-End Workflow Verification
    - [ ] Sub-task: Write Tests: E2E test (if possible with Tauri driver) or detailed manual test script for full lifecycle.
    - [ ] Sub-task: Implement Feature: Perform final polish on transitions and loading states.
- [ ] Task: Build Windows Installer
    - [ ] Sub-task: Write Tests: Verify build artifacts exist in `src-tauri/target/release/bundle`.
    - [ ] Sub-task: Implement Feature: Run `npm run tauri build`. Verify `.msi` or `.exe` installation.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Desktop Polish & Packaging' (Protocol in workflow.md)
