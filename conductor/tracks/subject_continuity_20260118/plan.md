# Plan: Subject Continuity Validation Rule

## Phase 1: Core Logic Implementation (TDD)
- [x] Task: Create failing unit tests for subject continuity logic dbbdedd
    - [x] Create `tests/subject-continuity.test.ts` dbbdedd
    - [x] Define test cases for: dbbdedd
        - [x] Adjacent periods (Valid) dbbdedd
        - [x] Periods bridged by BREAK/LUNCH (Valid) dbbdedd
        - [x] Periods split by another subject later in the day (Invalid) dbbdedd
        - [x] Periods split by an empty CLASS slot (Invalid) dbbdedd
        - [x] Multiple blocks of the same subject on the same day (Invalid) dbbdedd
- [x] Task: Implement `checkSubjectContinuity` logic dbbdedd
    - [x] Add `checkSubjectContinuity` to `src/features/generator/scheduler/validation/load-checks.ts` dbbdedd
    - [x] Logic: dbbdedd
        - [x] For the `targetDay` and `classId`, iterate through all periods (0 to `maxPeriods`). dbbdedd
        - [x] Identify all slots occupied by `subjectId` (including those in `proposedSlots` and excluding those in `ignoredSlots`). dbbdedd
        - [x] Find the `minPeriod` and `maxPeriod` occupied by the subject on that day. dbbdedd
        - [x] Iterate from `minPeriod` to `maxPeriod`: dbbdedd
            - [x] If a slot is type `CLASS` and is NOT occupied by `subjectId`, return a violation. dbbdedd
- [x] Task: Verify logic with tests dbbdedd
    - [x] Run `npm test tests/subject-continuity.test.ts` dbbdedd
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Logic Implementation (TDD)' (Protocol in workflow.md) dbbdedd

## Phase 2: System Integration
- [x] Task: Integrate into `checkSlotValidity` pipeline dbbdedd
    - [x] Update `src/features/generator/scheduler/validation/index.ts` dbbdedd
    - [x] Call `checkSubjectContinuity` in the pattern/curriculum checks section. dbbdedd
    - [x] Assign 1500 penalty points and 1 conflict count for violations (Hard Constraint). dbbdedd
- [x] Task: Verify integration with existing validation tests dbbdedd
    - [x] Run `npm test tests/swap-validation.test.ts` and `tests/scheduler-validation.test.ts`. dbbdedd
- [x] Task: Conductor - User Manual Verification 'Phase 2: System Integration' (Protocol in workflow.md) dbbdedd

## Phase 3: UI & Solver Validation
- [x] Task: Manual Verification of UI Blocking
    - [x] Start dev server
    - [x] Attempt to drag a subject to create a "split" on a day that already has that subject elsewhere.
    - [x] Confirm error message and blocked drop.
- [x] Task: Final regression and audit
    - [x] Run `validateFullSchedule` on a generated state to ensure no splits exist.
- [x] Task: Conductor - User Manual Verification 'Phase 3: UI & Solver Validation' (Protocol in workflow.md)
