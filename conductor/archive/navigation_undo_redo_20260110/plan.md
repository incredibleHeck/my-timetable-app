# Plan: Navigation Refactor & Global Undo/Redo

## Phase 1: Sidebar Reorganization [checkpoint: 62f91c5]
- [x] Task: Create `SidebarSection` component for category headers.
- [x] Task: Refactor `Sidebar.tsx` to implement the workflow-based grouping (General, Academic Data, Scheduling, Operations, System).
- [x] Task: Update Sidebar styling to match "Option A" (small, uppercase labels as dividers).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Sidebar Reorganization' (Protocol in workflow.md)

## Phase 2: Undo/Redo State Management [checkpoint: f6ba812]
- [x] Task: Design and implement a `useHistory` or `UndoRedoContext` to track scheduling state changes.
- [x] Task: Define the "Undoable Action" interface and state structure (limited to scheduling actions).
- [x] Task: Write tests for the Undo/Redo logic (History stack, limits, push/undo/redo operations).
- [x] Task: Integrate the history manager with the primary state (likely `ProfileContext`).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Undo/Redo State Management' (Protocol in workflow.md)

## Phase 3: Header UI & Shortcuts [checkpoint: 05ebd5b]
- [x] Task: Create `UndoRedoControls` component for the Header.
- [x] Task: Implement global keyboard shortcut listeners for Undo/Redo.
- [x] Task: Add the controls to `Header.tsx` (right-aligned, standard Lucide icons).
- [x] Task: Ensure buttons correctly reflect the state of the history stack (enabled/disabled).
- [x] Task: Conductor - User Manual Verification 'Phase 3: Header UI & Shortcuts' (Protocol in workflow.md)

## Phase 4: Feature Integration (The "Scheduling" Bridge) [checkpoint: 05ebd5b]
- [x] Task: Hook the Undo/Redo system into the Class Grid (moving/swapping).
- [x] Task: Hook the Undo/Redo system into Exam Scheduling (swapping slots).
- [x] Task: Hook the Undo/Redo system into Teacher Assignments.
- [x] Task: Verify end-to-end functionality: perform a move -> undo -> redo.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Feature Integration' (Protocol in workflow.md)
