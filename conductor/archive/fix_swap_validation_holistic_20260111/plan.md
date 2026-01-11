# Plan: Fix Swap Validation Logic Error

## Phase 1: Reproduction and Analysis
- [x] Task: Create a reproduction test file `tests/repro_swap_limit.test.ts` that simulates swapping two different double periods for the same teacher on the same day.
- [x] Task: Run the reproduction test to confirm it fails with 'Max periods exceeded' error.
- [x] Task: Analyze `src/services/scheduler/validation.ts` to identify where daily/weekly counts are calculated and why they ignore the target's displacement.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Reproduction and Analysis' (Protocol in workflow.md)

## Phase 2: Refactor Validation to Final State Logic
- [x] Task: Update the validation service to support a "transactional" or "proposed" state check.
- [x] Task: Modify daily/weekly load limit checks to subtract the load of the periods being displaced by the swap before adding the load of the new ones.
- [x] Task: Ensure consecutive period checks also use the proposed final state.
- [x] Task: Verify the reproduction test passes with the new logic.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Refactor Validation to Final State Logic' (Protocol in workflow.md)

## Phase 3: Integration and Verification
- [x] Task: Ensure Drag-and-Drop and Swap operations correctly invoke the updated validator with the full context of the swap.
- [x] Task: Run all existing scheduler validation tests to ensure no regressions.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Integration and Verification' (Protocol in workflow.md)
