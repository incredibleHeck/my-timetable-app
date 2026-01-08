# Plan: Exam Logistics Engine (Interactive Swapping)

## Phase 1: Interactive DND Foundation
*Goal: Implement basic drag-and-drop movement for exams within the grid.*

- [x] Task: Refactor Exam Grid for DND
    - [x] Sub-task: Write Tests: Verify that `ExamGrid` and `ExamCard` can handle drag events and identify source/destination IDs.
    - [x] Sub-task: Implement Feature: Integrate `@dnd-kit` into `src/features/exams/components/ExamGrid.tsx`. Implement `DraggableExam` and `DroppableSlot` components.
- [x] Task: Implement Exam Move Logic
    - [x] Sub-task: Write Tests: Unit tests for state updates when an exam is moved to a new slot.
    - [x] Sub-task: Implement Feature: Update `useExamSchedule` hook to handle `MOVE_EXAM` actions and persist changes to the active profile.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Interactive DND Foundation' (Protocol in workflow.md)

## Phase 2: Real-time Constraint Validation
*Goal: Prevent invalid moves and provide technical feedback on conflicts.*

- [x] Task: Develop Exam Constraint Engine
    - [x] Sub-task: Write Tests: Test `validateExamMove` with various scenarios (student clashes, room over-capacity).
    - [x] Sub-task: Implement Feature: Create `src/features/exams/logic/examValidation.ts`. Implement checks for Student, Room, and Invigilator constraints.
- [x] Task: Integration of Validation into DND Flow
    - [x] Sub-task: Write Tests: Verify that dropping an exam on an invalid slot triggers a visual warning.
    - [x] Sub-task: Implement Feature: Update DND sensors to prevent drops on high-severity conflicts or provide a confirmation modal for soft conflicts.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Environment Detection & UI Polish' (Protocol in workflow.md)

## Phase 3: Conflict Visualization & Tooltips
*Goal: Provide a professional "Studio" look for conflict reporting.*

- [x] Task: Implement High-Contrast Conflict Highlighting
    - [x] Sub-task: Write Tests: Component tests for `ExamCard` error states.
    - [x] Sub-task: Implement Feature: Apply high-contrast accent colors (red/amber) to cards and slots with active conflicts.
- [x] Task: Detailed Conflict Tooltips
    - [x] Sub-task: Write Tests: Ensure tooltips correctly display the specific technical reason for a conflict.
    - [x] Sub-task: Implement Feature: Use a robust tooltip library (or custom implementation) to show comprehensive error details on hover.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Conflict Visualization & Tooltips' (Protocol in workflow.md)
