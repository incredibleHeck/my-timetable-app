# Implementation Plan: Per-Teacher Constraint Overrides

## Phase 1: Data Model & Type Definitions [checkpoint: 3bb3d87]
- [x] Task: Update `Teacher` interface to include `maxPeriodsPerDay` [d6c459b]
    - [ ] Add `maxPeriodsPerDay?: number` to `Teacher` in `src/features/teachers/types.ts`
    - [ ] Update any mock data or initial state in `src/utils/constants.ts` or relevant files
- [x] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Type Definitions' (Protocol in workflow.md) [3bb3d87]

## Phase 2: UI Implementation [checkpoint: 7e5e017]
- [x] Task: Update `TeacherEditorModal` component [21dd2bd]
    - [x] Add "Max Periods Per Day" number input field to the form [21dd2bd]
    - [x] Implement validation for the input (positive integer or empty) [21dd2bd]
    - [x] Ensure the value is correctly passed to the update/create handler [21dd2bd]
- [x] Task: Write Tests for `TeacherEditorModal` UI [21dd2bd]
    - [x] Verify the new field is rendered [21dd2bd]
    - [x] Verify it correctly handles numeric input and empty state [21dd2bd]
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md) [7e5e017]

## Phase 3: Validation Logic & Conflict Detection [checkpoint: 487074e]
- [x] Task: Implement teacher-specific limit fallback logic [61dfe77]
    - [x] Create/Update a helper function to get `effectiveMaxPeriods` for a teacher [61dfe77]
- [x] Task: Update Conflict Detection Engine [61dfe77]
    - [x] Modify `src/features/generator/scheduler/validation.ts` to use the `effectiveMaxPeriods` [61dfe77]
    - [x] Update the conflict message to be teacher-specific if an override is active [61dfe77]
- [x] Task: Write Tests for Teacher-Specific Validation [61dfe77]
    - [x] Create a test case where a teacher has a specific limit lower than the global limit [61dfe77]
    - [x] Create a test case where a teacher has a specific limit higher than the global limit [61dfe77]
    - [x] Verify that conflicts are correctly reported with the specific limit [61dfe77]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Validation Logic & Conflict Detection' (Protocol in workflow.md) [487074e]

## Phase 4: Integration & Real-time Updates [checkpoint: 3f1b2ae]
- [x] Task: Verify Real-time Conflict Updates [a81aaad]
    - [x] Ensure that editing a teacher's limit immediately updates the conflict report [a81aaad]
    - [x] Verify the visual feedback in the schedule grid [a81aaad]
- [x] Task: Final Regression Testing [a81aaad]
    - [x] Run all existing scheduler and teacher tests to ensure no regressions [a81aaad]
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration & Real-time Updates' (Protocol in workflow.md) [3f1b2ae]
