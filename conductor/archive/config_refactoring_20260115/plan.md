# Plan: Configuration Refactoring (Remove Hardcoding)

This track removes hardcoded scheduling constraints and makes them user-configurable via the Global Configuration UI.

## Phase 1: Schema and Defaults [checkpoint: 507c193]
- [x] Task: Update Settings interface (f99e23b)
    - [x] Add `maxSubjectPeriodsPerDay` and `maxTeacherPeriodsPerDay` to `Settings` in `src/types/index.ts`.
    - [x] Update `DEFAULT_DATA` in `src/utils/constants.ts` to include these new fields with defaults (2 and 6).
- [x] Task: Migration and Type Safety (56f89e8)
    - [x] Ensure `validateProfile` or initializers handle missing fields by providing defaults.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Schema' (Protocol in workflow.md)

## Phase 2: Global Configuration UI [checkpoint: d79e02a]
- [x] Task: Implement "Rules and Constraints" section (188564e)
    - [x] Add a new section to `GlobalConfigView.tsx` below "Timetable Structure".
    - [x] Implement `Number` inputs for "Max Periods Per Subject" and "Max Teaching Periods".
    - [x] Add tooltips or help text explaining each constraint.
- [x] Task: Update `useGlobalConfig` hook (188564e)
    - [x] Add handlers for updating the new constraint fields in the settings state.
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Logic Refactoring [checkpoint: 7acda40]
- [x] Task: Update Validation Logic (58f2299)
    - [x] Refactor `checkSlotValidity` in `src/features/generator/scheduler/validation.ts` to use `settings.maxSubjectPeriodsPerDay` (fallback to 2).
    - [x] Refactor `checkSlotValidity` to use `settings.maxTeacherPeriodsPerDay` (fallback to 6).
- [x] Task: Update Solver Logic (ee9807e)
    - [x] Update `solveSmart` in `src/features/generator/scheduler/solver.ts` to respect the new teacher period limit during automated generation.
- [x] Task: Add Regression Tests (67b6712)
    - [x] Create tests in `tests/config-constraints.test.ts` to verify that changing these limits correctly triggers/resolves conflicts.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Logic Refactoring' (Protocol in workflow.md)

## Phase 4: Integration and Polishing [checkpoint: 06dec50]
- [x] Task: Trigger Re-validation (ff009e3)
    - [x] Ensure that updating these settings in the UI triggers a global conflict check.
- [x] Task: Final Build and Cleanup (874132f)
    - [x] Run `npm run build` to ensure type safety across the project.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Integration' (Protocol in workflow.md)
