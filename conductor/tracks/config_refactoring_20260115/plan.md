# Plan: Configuration Refactoring (Remove Hardcoding)

This track removes hardcoded scheduling constraints and makes them user-configurable via the Global Configuration UI.

## Phase 1: Schema and Defaults [checkpoint: 507c193]
- [x] Task: Update Settings interface (f99e23b)
    - [x] Add `maxSubjectPeriodsPerDay` and `maxTeacherPeriodsPerDay` to `Settings` in `src/types/index.ts`.
    - [x] Update `DEFAULT_DATA` in `src/utils/constants.ts` to include these new fields with defaults (2 and 6).
- [x] Task: Migration and Type Safety (56f89e8)
    - [x] Ensure `validateProfile` or initializers handle missing fields by providing defaults.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema' (Protocol in workflow.md)

## Phase 2: Global Configuration UI
- [ ] Task: Implement "Rules and Constraints" section
    - [ ] Add a new section to `GlobalConfigView.tsx` below "Timetable Structure".
    - [ ] Implement `Number` inputs for "Max Periods Per Subject" and "Max Teaching Periods".
    - [ ] Add tooltips or help text explaining each constraint.
- [ ] Task: Update `useGlobalConfig` hook
    - [ ] Add handlers for updating the new constraint fields in the settings state.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Logic Refactoring
- [ ] Task: Update Validation Logic
    - [ ] Refactor `checkSlotValidity` in `src/features/generator/scheduler/validation.ts` to use `settings.maxSubjectPeriodsPerDay` (fallback to 2).
    - [ ] Refactor `checkSlotValidity` to use `settings.maxTeacherPeriodsPerDay` (fallback to 6).
- [ ] Task: Update Solver Logic
    - [ ] Update `solveSmart` in `src/features/generator/scheduler/solver.ts` to respect the new teacher period limit during automated generation.
- [ ] Task: Add Regression Tests
    - [ ] Create tests in `tests/config-constraints.test.ts` to verify that changing these limits correctly triggers/resolves conflicts.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Logic Refactoring' (Protocol in workflow.md)

## Phase 4: Integration and Polishing
- [ ] Task: Trigger Re-validation
    - [ ] Ensure that updating these settings in the UI triggers a global conflict check.
- [ ] Task: Final Build and Cleanup
    - [ ] Run `npm run build` to ensure type safety across the project.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Integration' (Protocol in workflow.md)
