# Implementation Plan: Fix Conflict Reporting Logic

## Phase 1: Core Audit Engine (The "Fresh Audit")
Implement the standalone audit function that performs a complete, from-scratch validation of the final schedule, independent of the solver's internal trackers.

- [x] **Task: Create `src/features/generator/scheduler/validation/final-audit.ts`**
    - [ ] Define the `generateFinalReport` function.
    - [ ] Interface with `AppData` and `ScheduleResult`.
- [x] **Task: Implement `auditTeacherDoubleBookings`**
    - [ ] Iterate through all teachers and identify any overlapping time slots in the final schedule.
- [x] **Task: Implement `auditRoomDoubleBookings`**
    - [ ] Iterate through all rooms and identify any overlapping time slots in the final schedule.
- [x] **Task: Implement `auditClassGaps`**
    - [ ] Scan class schedules to find generic "gaps" or "windows" as defined by project guidelines.
- [x] **Task: Implement `auditSubjectContinuity`**
    - [ ] Verify that subject lessons follow continuity rules (e.g., no sandwiching).
- [x] **Task: Consolidate Audit Results**
    - [ ] Ensure `generateFinalReport` returns a unified `Conflict[]` array.

## Phase 2: Integration & State Management
Update the generator pipeline to prioritize this fresh audit for final reporting.

- [x] **Task: Update Worker Logic (`worker.ts`)**
    - [ ] Modify the worker to execute `generateFinalReport` upon solver completion.
    - [ ] Ensure `solveSmart`'s internal conflicts (unplaced units) are merged with this final audit.
- [x] **Task: Refactor `audit.ts` (if applicable)**
    - [ ] Align the existing `runConflictAudit` with the new post-generation logic to avoid redundancy or "stale" data leak.
- [x] **Task: UI Synchronization**
    - [ ] Verify that `GeneratorView` correctly receives and displays the fresh conflict list.

## Phase 3: Verification & Quality Assurance
Ensure the fix works as expected and doesn't regress.

- [x] **Task: Create Regression Test (`tests/conflict-reporting.test.ts`)**
    - [ ] Simulate a generation process where a conflict occurs mid-way but is resolved.
    - [ ] Assert that the final conflict report does NOT contain the resolved conflict.
- [x] **Task: Execute Test Suite**
    - [ ] `npm test tests/conflict-reporting.test.ts`
- [ ] **Task: Conductor - User Manual Verification 'Conflict Reporting Fix' (Protocol in workflow.md)**
