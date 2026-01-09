# Track Plan: Fix Split Double Period Swap Logic

## Phase 1: Research and Test Reproduction [checkpoint: fe42874]
- [x] Task: Create a reproduction test case for split double period swaps. 4645be8
    - [x] Subtask: Add a test case in `tests/scheduler-validation.test.ts` (or a new file) that defines a class structure with a Break between two CLASS periods.
    - [x] Subtask: Mock a schedule with the same subject/teacher/class on both sides of the break.
    - [x] Subtask: Assert that `checkSlotValidity` currently fails to recognize this as a swappable double period unit.
- [x] Task: Conductor - User Manual Verification 'Research and Test Reproduction' (Protocol in workflow.md) 4645be8

## Phase 2: Validation Logic Refinement [checkpoint: 5b5e304]
- [x] Task: Update `checkSlotValidity` in `src/services/scheduler/validation.ts`. bb945df
    - [x] Subtask: Enhance the duration detection logic to look past BREAK/LUNCH periods if the same subject is scheduled on the other side.
    - [x] Subtask: Update the swap detection logic to treat these split slots as a single atomic unit.
- [x] Task: Verify fix with automated tests. bb945df
    - [x] Subtask: Run the reproduction tests and ensure they now pass.
    - [x] Subtask: Run full scheduler test suite to ensure no regressions.
- [x] Task: Conductor - User Manual Verification 'Validation Logic Refinement' (Protocol in workflow.md) bb945df

## Phase 3: Frontend & DND Integration
- [x] Task: Audit and update `src/features/generator/components/ScheduleGrid.tsx` and `useDndLogic.ts`. 9bbab61
    - [x] Subtask: Ensure `getDuration` helper in `ScheduleGrid.tsx` correctly identifies split double periods.
    - [x] Subtask: Verify that `handleDragEnd` and `checkDragValidity` correctly process the multi-slot swap for split periods.
- [x] Task: Final Manual Verification. 9bbab61
    - [x] Subtask: Manually test swapping split double periods in the UI.
    - [x] Subtask: Verify that both slots move together and correctly occupy target slots.
- [x] Task: Conductor - User Manual Verification 'Frontend & DND Integration' (Protocol in workflow.md) 9bbab61
