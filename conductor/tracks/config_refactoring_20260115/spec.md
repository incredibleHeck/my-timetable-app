# Specification: Configuration Refactoring (Remove Hardcoding)

## Overview
This track focuses on removing hardcoded constraints from the application and making them user-configurable. Specifically, it addresses the daily limit for periods per subject and the daily limit for teaching periods per teacher.

## Functional Requirements

### 1. Settings Schema Updates
- Add two new fields to the `Settings` interface in `src/types/index.ts`:
    - `maxSubjectPeriodsPerDay`: number (Default: 2)
    - `maxTeacherPeriodsPerDay`: number (Default: 6)

### 2. Global Configuration UI
- Add a new section titled **"Rules and Constraints"** to the `GlobalConfigView`.
- Implement input fields for the two new settings with appropriate labels and tooltips.
- Ensure the fields are initialized with the existing hardcoded values (2 and 6) for existing profiles.

### 3. Validation and Constraint Logic Refactoring
- **Subject Daily Limit:** Update the validation logic (likely in `src/features/generator/scheduler/validation.ts`) to use `settings.maxSubjectPeriodsPerDay` instead of the hardcoded `2`.
- **Teacher Daily Load:** Update the constraint logic (likely in `src/features/generator/scheduler/validation.ts` and `solver.ts`) to use `settings.maxTeacherPeriodsPerDay` instead of the hardcoded `6`.

### 4. Interactive Feedback
- **Real-time Re-validation:** When these limits are modified in the Global Settings, the application should trigger a re-validation of the current schedule.
- **Conflict Highlighting:** Any existing assignments that now violate the updated limits should be marked as conflicts in the UI.

## Non-Functional Requirements
- **Maintainability:** Eliminate magic numbers from the scheduler codebase.
- **Backward Compatibility:** Ensure existing user profiles migrate seamlessly by providing sensible defaults.

## Acceptance Criteria
- [ ] New settings fields are visible and editable in the "Rules and Constraints" section of Global Configuration.
- [ ] Changing "Max Periods Per Subject" to 1 immediately flags any class with 2 periods of the same subject on the same day as a conflict.
- [ ] Changing "Max Teaching Periods" to 5 immediately flags any teacher with 6 periods on the same day as a conflict.
- [ ] The generator respects these new variables during automated scheduling.

## Out of Scope
- Adding per-class or per-teacher overrides for these limits (this track focuses on global settings).
- Refactoring other hardcoded values not mentioned in the description.
