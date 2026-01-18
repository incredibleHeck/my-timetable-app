# Plan: Classes Module Refactor and Automated Home Room Management

## Phase 1: Foundation Hooks
- [x] Task: Create `useClassActions` hook a2b65aa
    - [x] Write failing tests for class actions (create, duplicate, delete) ensuring Room side-effects (sync naming, deletion).
    - [x] Implement `useClassActions` in `src/features/classes/hooks/useClassActions.ts`.
- [x] Task: Create `useClassForm` hook a2b65aa
    - [x] Write failing tests for complex class form state logic (duration defaults, structure resizing).
    - [x] Implement `useClassForm` in `src/features/classes/hooks/useClassForm.ts`.
- [ ] Task: Conductor - User Manual Verification 'Foundation Hooks' (Protocol in workflow.md)

## Phase 2: Modal Refactoring
- [x] Task: Implement Sectional Components 39cc646
    - [x] Create `src/features/classes/components/ClassBasicsSection.tsx` (Read-only Home Room display).
    - [x] Create `src/features/classes/components/ClassStructureSection.tsx`.
    - [x] Create `src/features/classes/components/ClassCurriculumSection.tsx`.
- [x] Task: Refactor `ClassEditorModal` 39cc646
    - [x] Update `ClassEditorModal.tsx` to orchestrate `useClassForm` and the new sections.
- [ ] Task: Conductor - User Manual Verification 'Modal Refactoring' (Protocol in workflow.md)

## Phase 3: View Refactoring
- [x] Task: Extract Sub-Views 68ae0ec
    - [x] Create `src/features/classes/components/ClassList.tsx`.
    - [x] Create `src/features/classes/components/ClassGroups.tsx` (Joint & Elective blocks).
- [x] Task: Refactor `ClassesView` 68ae0ec
    - [x] Update `ClassesView.tsx` to use `useClassActions` and the new sub-components.
- [ ] Task: Conductor - User Manual Verification 'View Refactoring' (Protocol in workflow.md)

## Phase 4: Strict Sync & Final Quality [checkpoint: 83b84d7]
- [x] Task: Refine Strict Name Sync bd59f32
    - [x] Ensure that editing an existing class name immediately updates the associated `Room` object in state.
- [x] Task: Final Quality Pass bd59f32
    - [x] Verify test coverage for all new components and hooks (>80%).
    - [x] Run project linting and formatting.
- [x] Task: Conductor - User Manual Verification 'Strict Sync & Final Quality' (Protocol in workflow.md) bd59f32
