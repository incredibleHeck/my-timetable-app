# Plan: Fix False Positive Validation for Same-Day Moves

## Phase 1: Research and Reproduction
- [x] Task: Create comprehensive reproduction tests in `tests/repro_same_day_swap.test.ts` covering double period swaps and consecutive limits. [aaa9d1e]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Research and Reproduction' (Protocol in workflow.md) [checkpoint: aaa9d1e]

## Phase 2: Validation Logic Refactor
- [x] Task: Refactor `checkSlotValidity` in `src/services/scheduler/validation.ts` to calculate teacher load and subject counts holistically (considering both source and target removal). [a3d37ae]
- [x] Task: Fix the `while` loop logic to correctly handle multi-period moves for teacher constraints (consecutive/daily load). [a3d37ae]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Validation Logic Refactor' (Protocol in workflow.md) [checkpoint: a3d37ae]

## Phase 3: Verification and Finalization
- [x] Task: Verify all existing and new tests pass. [7b87afc]
- [x] Task: Check code coverage for `src/services/scheduler/validation.ts`. [7b87afc]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Verification and Finalization' (Protocol in workflow.md) [checkpoint: 7b87afc]
