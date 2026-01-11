# Specification: Navigation Refactor & Global Undo/Redo

## Overview
This track aims to improve the application's information architecture by reorganizing the sidebar into logical, workflow-based categories. Additionally, it introduces a global Undo/Redo system in the header to provide a safety net for scheduling operations.

## Functional Requirements

### 1. Sidebar Reorganization
- Group navigation items into the following categories:
    - **General:** Dashboard
    - **Academic Data:** Teachers, Rooms, Subjects, Classes
    - **Scheduling:** Generator, Workload
    - **Operations:** Exams, Duty
    - **System:** Configuration
- Implement section headers with small, uppercase labels to visually separate categories.
- Ensure the sidebar remains responsive and consistent with existing styling.

### 2. Global Undo/Redo System
- **Scope:** Track state changes for scheduling-related actions, specifically:
    - Moving/Swapping classes on the grid.
    - Assigning/Unassigning teachers to classes/exams.
    - Swapping exam slots.
- **UI:** 
    - Add Undo and Redo buttons to the right side of the header using standard Lucide icons (`Undo2`, `Redo2` or similar).
    - Buttons must be visually disabled (reduced opacity/pointer-events-none) when no history is available.
- **Keyboard Shortcuts:**
    - Undo: `Ctrl+Z` (Windows/Linux) / `Cmd+Z` (macOS).
    - Redo: `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) / `Cmd+Shift+Z` (macOS).

## Non-Functional Requirements
- **Performance:** History tracking should not introduce noticeable lag during scheduling operations.
- **Consistency:** Use existing UI components (`Button`, `Tooltip` if applicable) and follow the project's Tailwind-based styling.

## Acceptance Criteria
- Sidebar items are correctly grouped under the specified headers.
- Undo/Redo buttons correctly revert and re-apply scheduling moves.
- Buttons visually reflect state (enabled/disabled).
- Keyboard shortcuts trigger the expected actions.
- No regressions in navigation functionality.

## Out of Scope
- Undo/Redo for global configuration changes or profile settings.
- Undo/Redo for text input fields (standard browser behavior is sufficient).
- A visible history list or log for the user to select specific points in time.
