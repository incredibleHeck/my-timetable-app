# Track Plan: Refine and Validate Core Scheduler Constraints

## Phase 1: Validation Logic Hardening
- [ ] Task: Create a comprehensive test suite for `src/services/scheduler/validation.ts`.
    - [ ] Subtask: Create `tests/scheduler-validation.test.ts` and set up the testing harness.
    - [ ] Subtask: Write test cases for Teacher Availability (positive and negative).
    - [ ] Subtask: Write test cases for Room Availability (positive and negative).
    - [ ] Subtask: Write test cases for Room Capacity (positive and negative).
- [ ] Task: Refine `src/services/scheduler/validation.ts` based on test results.
    - [ ] Subtask: Fix any bugs identified by the new test suite.
    - [ ] Subtask: Optimize validation performance if bottlenecks are found.
- [ ] Task: Conductor - User Manual Verification 'Validation Logic Hardening' (Protocol in workflow.md)

## Phase 2: UI Integration & Feedback
- [ ] Task: Audit `ConflictPanel.tsx` for data accuracy.
    - [ ] Subtask: Verify that the component correctly subscribes to validation updates.
    - [ ] Subtask: Ensure all error types returned by `validation.ts` are rendered correctly.
- [ ] Task: Improve Visual Feedback.
    - [ ] Subtask: Add visual distinction between "Critical" errors (e.g., double booking) and "Warnings" (e.g., capacity nearing limit).
    - [ ] Subtask: Implement a mechanism to highlight the conflicting slot in `ScheduleGrid` when a conflict is selected in `ConflictPanel` (if not already present).
- [ ] Task: Conductor - User Manual Verification 'UI Integration & Feedback' (Protocol in workflow.md)

## Phase 3: Final Verification
- [ ] Task: Perform an end-to-end manual test of the scheduling workflow.
    - [ ] Subtask: Create a mock schedule with intentional conflicts.
    - [ ] Subtask: Verify that all conflicts are detected and reported in the UI.
    - [ ] Subtask: Resolve conflicts and verify that warnings disappear.
- [ ] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
