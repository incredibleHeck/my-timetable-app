# Plan: Automatic Unique Home Room Assignment

## Phase 1: Data Model & Foundation [checkpoint: f9d6e83]
- [x] Task: Update Type Definitions (Already present) 0bf4871
    - [x] Add `defaultRoomId: string` to `ClassGroup` in `src/features/classes/types.ts`.
- [x] Task: Automatic Home Room Assignment Logic 0bf4871
    - [x] Write failing test for a utility that maps each class to a unique room.
    - [x] Implement the assignment utility (ensuring 1-to-1 unique mapping).
    - [x] Hook the utility into the class creation/loading flow.
- [x] Task: Conductor - User Manual Verification 'Data Model & Foundation' (Protocol in workflow.md)

## Phase 2: Engine & Rendering Fallbacks
- [ ] Task: Update Room Resolution Logic (Engine)
    - [ ] Write failing tests for room resolution (explicit room vs. default fallback).
    - [ ] Update the `SchedulerState` and `AllocationUnit` logic to resolve the effective room ID using the hierarchy.
- [ ] Task: Update Schedule Grid Rendering
    - [ ] Write failing tests for UI room resolution.
    - [ ] Update grid components to display lessons in the class's `defaultRoomId` if `subject.roomId` is missing.
- [ ] Task: Conductor - User Manual Verification 'Engine & Rendering Fallbacks' (Protocol in workflow.md)

## Phase 3: Validation & Quality
- [ ] Task: Update Room Conflict Detection
    - [ ] Write failing tests for conflicts between explicit room assignments and class fallback rooms.
    - [ ] Update the room overlap validator to use the resolved effective room ID.
- [ ] Task: Update Conflict Audit Utility
    - [ ] Write failing tests for the `runConflictAudit` utility regarding fallback rooms.
    - [ ] Update the audit logic to accurately report overlaps using resolved room IDs.
- [ ] Task: Conductor - User Manual Verification 'Validation & Quality' (Protocol in workflow.md)

## Phase 4: UI Visibility & Cleanup
- [ ] Task: Display Home Room in Classes Table
    - [ ] Add a "Home Room" column to the Classes management table.
- [ ] Task: Conductor - User Manual Verification 'UI Visibility & Cleanup' (Protocol in workflow.md)
