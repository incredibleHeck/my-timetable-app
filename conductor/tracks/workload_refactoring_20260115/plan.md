# Plan: Workload Refactoring & Model Improvements

This plan refactors the data models for `JointClass` and `ElectiveBlock` and updates workload calculation logic across the UI and the scheduling engine to count unique time slots.

## Phase 1: Model Updates & Data Integrity [checkpoint: 9a669ed]
- [x] Task: Update Entity Interfaces (8b72b2e)
    - [x] Update `ElectiveBlock` in `src/features/classes/types.ts`: `classId: string` -> `classIds: string[]`
    - [x] Update `JointClass` in `src/features/classes/types.ts`: add `teacherId?: string`
    - [x] Update `CurriculumItem` in `src/features/classes/types.ts`: add `isWorkloadExempt?: boolean`
- [x] Task: Update Default Data & Preparation (d18e649)
    - [x] Update `DEFAULT_DATA` in `src/utils/constants.ts` to reflect model changes
    - [x] Update `prepareAllocationUnits` in `src/features/generator/scheduler/preparation.ts` to handle `ElectiveBlock.classIds` and `JointClass.teacherId`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Models' (Protocol in workflow.md)

## Phase 2: Workload Calculation Logic
- [x] Task: Refactor `useWorkloadStats` hook (7a68037)
    - [x] Write tests for de-duplicated workload calculation
    - [x] Implement de-duplication for "Requested Workload" (Curriculum-based)
    - [x] Implement de-duplication for "Scheduled Workload" (Timetable-based)
- [ ] Task: Update Dashboard Metrics
    - [ ] Ensure dashboard workload metrics use the new de-duplicated logic
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Workload Logic' (Protocol in workflow.md)

## Phase 3: Engine & Validation Refactoring
- [ ] Task: Update Validation Logic
    - [ ] Write tests for `checkSlotValidity` with concurrent teacher assignments
    - [ ] Refactor `checkSlotValidity` in `src/features/generator/scheduler/validation.ts` to count unique periods for `dailyLoad`
- [ ] Task: Update Solver Logic
    - [ ] Update `solveSmart` in `src/features/generator/scheduler/solver.ts` to use unique period counts for "Workload Balancing" score
    - [ ] Update `solveSmart` to use unique period counts for `maxTeacherPeriodsPerDay` constraint
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Engine' (Protocol in workflow.md)

## Phase 4: Final Integration & Regression
- [ ] Task: Regression Testing
    - [ ] Verify that existing "Joint Class" and "Elective" test cases still pass
- [ ] Task: UI Cleanup
    - [ ] Ensure any UI components (Modals, Editors) that create Joint Classes or Electives handle the new fields
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final' (Protocol in workflow.md)
