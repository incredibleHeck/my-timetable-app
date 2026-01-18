# Specification: Classes Module Refactor and Automated Home Room Management

## Overview
This track involves a structural refactor of the Classes feature to improve maintainability and the implementation of a fully automated Home Room management system. The goal is to eliminate manual room assignment for classes, ensuring every class has a dedicated, system-managed physical space that stays in sync with the class identity.

## Functional Requirements

### 1. Codebase Refactoring (Best Practices)
- **`ClassesView.tsx` Splitting**:
    - Extract class card grid and metrics to `ClassList.tsx`.
    - Extract Joint Classes and Elective Blocks to `ClassGroups.tsx`.
    - Create `useClassActions.ts` hook to encapsulate logic for saving, duplicating, and deleting classes (including the side effects for rooms).
- **`ClassEditorModal.tsx` Splitting**:
    - Create `useClassForm.ts` hook to manage complex multi-tab form state and validation.
    - Split UI into `ClassBasicsSection.tsx`, `ClassStructureSection.tsx`, and `ClassCurriculumSection.tsx`.

### 2. Automated Home Room Management
- **UI Removal**: Remove the 'Select Home Room' dropdown. The system now manages this relationship.
- **Home Room Display**: Show the name of the assigned Home Room in the 'Basics' section of the editor as read-only text.
- **Lifecycle Logic**:
    - **Creation**: When a class is created, a Room is generated with name `[Class Name] Classroom`, type `Classroom`, and `isHomeRoom: true`.
    - **Linking**: The `defaultRoomId` (or `classroomId`) of the class is set to this new Room's ID.
    - **Duplication**: Duplicating a class generates a fresh Home Room for the copy; IDs are never shared.
    - **Deletion**: Deleting a class automatically deletes its associated system-managed Home Room.
    - **Strict Sync**: Renaming a class automatically triggers a rename of its associated Home Room to maintain consistency.

## Acceptance Criteria
- [ ] `src/features/classes/` directory is organized into smaller, focused components and hooks.
- [ ] Users can no longer manually select a Home Room in the Class Editor.
- [ ] Creating a new class results in a corresponding Room appearing in the Rooms list.
- [ ] Renaming a class (e.g., "10A" to "10A-Gold") updates the Room name (e.g., "10A Classroom" to "10A-Gold Classroom").
- [ ] Deleting a class removes the associated Home Room from the system.
- [ ] Duplicating a class creates a new, unique Home Room for the copy.

## Out of Scope
- Converting existing manually assigned rooms to "Auto-managed" rooms (this track focuses on new/updated classes).
- Bulk editing of Home Room properties.
