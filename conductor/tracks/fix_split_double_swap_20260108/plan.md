# Track Plan: Fix Split Double Period Swap Logic

## Phase 1: Research and Test Reproduction [checkpoint: fe42874]
- [x] Task: Create a reproduction test case for split double period swaps. 4645be8
    - [x] Subtask: Add a test case in `tests/scheduler-validation.test.ts` (or a new file) that defines a class structure with a Break between two CLASS periods.
    - [x] Subtask: Mock a schedule with the same subject/teacher/class on both sides of the break.
    - [x] Subtask: Assert that `checkSlotValidity` currently fails to recognize this as a swappable double period unit.
- [x] Task: Conductor - User Manual Verification 'Research and Test Reproduction' (Protocol in workflow.md) 4645be8

## Phase 2: Validation Logic Refinement
- [ ] Task: Update `checkSlotValidity` in `src/services/scheduler/validation.ts`.
    - [ ] Subtask: Enhance the duration detection logic to look past BREAK/LUNCH periods if the same subject is scheduled on the other side.
    - [ ] Subtask: Update the swap detection logic to treat these split slots as a single atomic unit.
- [ ] Task: Verify fix with automated tests.
    - [ ] Subtask: Run the reproduction tests and ensure they now pass.
    - [ ] Subtask: Run full scheduler test suite to ensure no regressions.
- [ ] Task: Conductor - User Manual Verification 'Validation Logic Refinement' (Protocol in workflow.md)

## Phase 3: Frontend & DND Integration
- [ ] Task: Audit and update `src/features/generator/components/ScheduleGrid.tsx` and `useDndLogic.ts`.
    - [ ] Subtask: Ensure `getDuration` helper in `ScheduleGrid.tsx` correctly identifies split double periods.
    - [ ] Subtask: Verify that `handleDragEnd` and `checkDragValidity` correctly process the multi-slot swap for split periods.
- [ ] Task: Final Manual Verification.
    - [ ] Subtask: Manually test swapping split double periods in the UI.
    - [ ] Subtask: Verify that both slots move together and correctly occupy target slots.
- [ ] Task: Conductor - User Manual Verification 'Frontend & DND Integration' (Protocol in workflow.md)
