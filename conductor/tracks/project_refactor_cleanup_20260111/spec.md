# Specification: Comprehensive Project Structure Refactoring

## Overview
The goal of this track is to reorganize the `src` directory to adhere to a scalable, professional, and industry-standard "Feature-Sliced Design" (lightweight adaptation). This will improve maintainability, discoverability, and separation of concerns. The refactor will enforce strict feature encapsulation while keeping shared primitives global.

## Functional Requirements
- **Directory Structure Reorganization:**
    - **`src/components/`**: Shall strictly contain *shared* UI primitives (buttons, inputs, modals) and layout components (sidebar, header) that are used across multiple features. Feature-specific components must be moved to their respective feature folders.
    - **`src/features/`**: Shall be the primary home for domain logic. Each feature (e.g., `dashboard`, `teacher`, `class`) must follow a standard structure:
        - `components/`: Feature-specific UI.
        - `hooks/`: Feature-specific logic hooks.
        - `types/`: Feature-specific TypeScript definitions.
        - `utils/` or `logic/`: Domain-specific business logic.
        - `index.ts`: Public API export for the feature.
    - **`src/services/`**: Shall be reserved for *global* or *cross-cutting* infrastructure logic that doesn't belong to a single feature (e.g., `fileSystem`, `persistence`, `electron/tauri` adapters). Domain-specific services (like `scheduler` logic) should be evaluated for moving into `features/scheduler` if they are isolated, OR kept in `services` if they orchestrate multiple features.
    - **`src/types/`**: Shall contain only *global* shared types (e.g., `AppData`, `ID`). Domain specific types should move to features.

- **File Cleanup:**
    - Detect and remove unused files.
    - Consolidate small, scattered utility files into logical groupings.
    - Break down monolithic files (if any found) into smaller modules.

## Non-Functional Requirements
- **Zero Regression:** The application must function exactly as before. This is a pure refactor.
- **Linting & Formatting:** All moved files must pass the project's linting rules.
- **Import Updates:** All import paths must be updated to reflect the new structure.

## Acceptance Criteria
- [ ] `src/components` contains only truly shared/global components.
- [ ] `src/features` contains self-contained modules for `dashboard`, `teachers`, `classes`, etc.
- [ ] Imports in all files are updated and resolve correctly.
- [ ] The application builds (`npm run build`) without errors.
- [ ] The application starts and runs (`npm run dev`) with all major features functioning.
- [ ] No "orphan" files or folders remain.

## Out of Scope
- Rewriting component logic (functionality changes).
- Changing the UI design.
- upgrading dependencies.
