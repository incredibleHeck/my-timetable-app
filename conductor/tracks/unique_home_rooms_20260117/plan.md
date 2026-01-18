# Plan: Automatic Unique Home Room Assignment

## Phase 1: Data Model & Foundation [checkpoint: f9d6e83]
- [x] Task: Update Type Definitions (Already present) 0bf4871
    - [x] Add `defaultRoomId: string` to `ClassGroup` in `src/features/classes/types.ts`.
- [x] Task: Automatic Home Room Assignment Logic 0bf4871
    - [x] Write failing test for a utility that maps each class to a unique room.
    - [x] Implement the assignment utility (ensuring 1-to-1 unique mapping).
    - [x] Hook the utility into the class creation/loading flow.
- [x] Task: Conductor - User Manual Verification 'Data Model & Foundation' (Protocol in workflow.md)

## Phase 2: Engine & Rendering Fallbacks [checkpoint: f9d6e83]
- [x] Task: Update Room Resolution Logic (Engine)
    - [x] Write failing tests for room resolution (explicit room vs. default fallback).
    - [x] Update the `SchedulerState` and `AllocationUnit` logic to resolve the effective room ID using the hierarchy.
- [x] Task: Update Schedule Grid Rendering
    - [x] Write failing tests for UI room resolution.
    - [x] Update grid components to display lessons in the class's `defaultRoomId` if `subject.roomId` is missing.
- [ ] Task: Conductor - User Manual Verification 'Engine & Rendering Fallbacks' (Protocol in workflow.md)

## Phase 3: Validation & Quality [checkpoint: f9d6e83]
- [x] Task: Update Room Conflict Detection
    - [x] Write failing tests for conflicts between explicit room assignments and class fallback rooms.
    - [x] Update the room overlap validator to use the resolved effective room ID.
- [x] Task: Update Conflict Audit Utility
    - [x] Write failing tests for the `runConflictAudit` utility regarding fallback rooms.
    - [x] Update the audit logic to accurately report overlaps using resolved room IDs.
- [x] Task: Conductor - User Manual Verification 'Validation & Quality' (Protocol in workflow.md) bd59f32

## Phase 4: UI Visibility & Cleanup
- [x] Task: Display Home Room in Classes Table bd59f32
    - [x] Add a "Home Room" column to the Classes management table.
- [x] Task: Conductor - User Manual Verification 'UI Visibility & Cleanup' (Protocol in workflow.md) bd59f32
