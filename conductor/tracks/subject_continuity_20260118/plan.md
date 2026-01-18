# Plan: Subject Continuity Validation Rule

## Phase 1: Core Logic Implementation (TDD)
- [ ] Task: Create failing unit tests for subject continuity logic
    - [ ] Create `tests/subject-continuity.test.ts`
    - [ ] Define test cases for:
        - [ ] Adjacent periods (Valid)
        - [ ] Periods bridged by BREAK/LUNCH (Valid)
        - [ ] Periods split by another subject later in the day (Invalid)
        - [ ] Periods split by an empty CLASS slot (Invalid)
        - [ ] Multiple blocks of the same subject on the same day (Invalid)
- [ ] Task: Implement `checkSubjectContinuity` logic
    - [ ] Add `checkSubjectContinuity` to `src/features/generator/scheduler/validation/load-checks.ts`
    - [ ] Logic:
        - [ ] For the `targetDay` and `classId`, iterate through all periods (0 to `maxPeriods`).
        - [ ] Identify all slots occupied by `subjectId` (including those in `proposedSlots` and excluding those in `ignoredSlots`).
        - [ ] Find the `minPeriod` and `maxPeriod` occupied by the subject on that day.
        - [ ] Iterate from `minPeriod` to `maxPeriod`:
            - [ ] If a slot is type `CLASS` and is NOT occupied by `subjectId`, return a violation.
- [ ] Task: Verify logic with tests
    - [ ] Run `npm test tests/subject-continuity.test.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Core Logic Implementation (TDD)' (Protocol in workflow.md)

## Phase 2: System Integration
- [ ] Task: Integrate into `checkSlotValidity` pipeline
    - [ ] Update `src/features/generator/scheduler/validation/index.ts`
    - [ ] Call `checkSubjectContinuity` in the pattern/curriculum checks section.
    - [ ] Assign 1500 penalty points and 1 conflict count for violations (Hard Constraint).
- [ ] Task: Verify integration with existing validation tests
    - [ ] Run `npm test tests/swap-validation.test.ts` and `tests/scheduler-validation.test.ts`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: System Integration' (Protocol in workflow.md)

## Phase 3: UI & Solver Validation
- [ ] Task: Manual Verification of UI Blocking
    - [ ] Start dev server
    - [ ] Attempt to drag a subject to create a "split" on a day that already has that subject elsewhere.
    - [ ] Confirm error message and blocked drop.
- [ ] Task: Final regression and audit
    - [ ] Run `validateFullSchedule` on a generated state to ensure no splits exist.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI & Solver Validation' (Protocol in workflow.md)
