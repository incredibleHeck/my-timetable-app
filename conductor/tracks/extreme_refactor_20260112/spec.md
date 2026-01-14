# Specification: Comprehensive Project Refactor & Reorganization

## Overview
This track involves a complete structural refactoring of the `src` directory to improve readability, maintainability, and testability. The goal is to adhere to modern React/TypeScript best practices by decomposing "God files," standardizing folder structures, and clarifying ownership of code.

## Functional Requirements
- **Review & Analyze**: Analyze the entire `src` directory to identify structural weaknesses (e.g., circular dependencies, tight coupling, poor naming).
- **Decompose God Files**: Identify files exceeding reasonable complexity (e.g., `ScheduleGrid.tsx`, complex services) and split them into smaller, single-responsibility units (hooks, sub-components, utility functions).
- **Standardize Structure**: Enforce a consistent architecture, likely Feature-Sliced Design (FSD) or a strict "Feature-based" structure:
  - `src/features/<feature>/`: specific logic, components, and hooks.
  - `src/components/ui/`: reusable, dumb UI atoms.
  - `src/lib/` or `src/utils/`: core business logic and helpers.
  - `src/hooks/`: global hooks.
- **Consolidate Shared Logic**: Move truly global utilities and UI components to central `src/utils` and `src/components/ui` directories, while keeping feature-specific helpers co-located.
- **Rename & Cleanup**: Rename files/folders to match their content and delete obsolete or empty directories.

## Non-Functional Requirements
- **Maintainability**: The new structure must make it obvious where code lives.
- **Testability**: Components and logic should be isolated enough to be easily tested.

## Acceptance Criteria
1. The `src` directory reflects a consistent, agreed-upon structure (e.g., Feature-based).
2. Large components (like `ScheduleGrid`) are broken down into smaller, manageable sub-components and hooks.
3. No file exceeds a reasonable LoC limit (e.g., ~300 lines) unless absolutely necessary.
4. All existing functionality remains intact (verified manually or via fixed tests).
5. Code that belongs together stays together (co-location).
6. Tests are updated and passing by the end of the track.

## Out of Scope
- Adding new user-facing features.
- Changing the underlying tech stack (React, Tauri, etc.).
