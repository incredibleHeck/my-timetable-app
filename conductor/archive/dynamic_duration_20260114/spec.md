# Specification: Dynamic State Handling - Auto-Update Duration

## Overview
Improve the user experience in the `ClassEditorModal` by automatically populating duration fields when a user begins using a new period type (Class, Break, or Lunch) in the structure grid. This prevents users from having to manually enter common default values when they first add a break or lunch to a class structure.

## Functional Requirements
- **Trigger:** Toggling a slot in the `ClassEditorModal` structure grid.
- **Logic:**
    - When a slot's type is changed (e.g., from `CLASS` to `BREAK`):
        - Identify the new type.
        - Determine if that type is "new" to the current class structure (i.e., there were zero slots of this type before the toggle).
        - If it is the first slot of that type:
            - Update the corresponding duration state (`cDuration`, `cBreakDuration`, or `cLunchDuration`) to the global default value found in `data.settings`.
- **Target Fields:**
    - `CLASS` -> `cDuration` (Default Class Duration)
    - `BREAK` -> `cBreakDuration` (Default Break Duration)
    - `LUNCH` -> `cLunchDuration` (Default Lunch Duration)

## Non-Functional Requirements
- **User Intent Preservation:** If a user has already manually adjusted a duration field, it should not be overwritten by subsequent toggles of slots to that same type. The auto-update only triggers for the *first* instance of a type in the grid.
- **Zero Regression:** Ensure existing state hydration (from `editingClass`) still works correctly upon opening the modal.

## Acceptance Criteria
- [ ] Toggling the first slot to "Break" in a class with no breaks automatically sets the "Break (min)" input to the global default.
- [ ] Toggling a second or third slot to "Break" does NOT change the "Break (min)" value if it has already been set (either by the first toggle or manually).
- [ ] Toggling the first slot to "Lunch" sets "Lunch (min)" to the global default.
- [ ] Toggling the first slot to "Class" sets "Duration (min)" to the global default (relevant if a class was initialized with no class periods).

## Out of Scope
- Updating global settings from the class editor.
- Support for multiple different durations for the same type within one class.
