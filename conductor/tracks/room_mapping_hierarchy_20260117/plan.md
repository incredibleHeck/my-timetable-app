# Implementation Plan: room_mapping_hierarchy_20260117

## Phase 1: Data Model & Types
- [x] Task: Update Global Types and Mock Data [f1d2e46]
    - [ ] Add `requiredRoomId` to `Subject` interface in `src/types/index.ts`.
    - [ ] Add `defaultRoomId` to `ClassGroup` interface in `src/types/index.ts`.
    - [ ] Update mock data in tests and services to include these new fields.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Types' (Protocol in workflow.md)

## Phase 2: Solver Engine Refactor
- [x] Task: Implement `determineRoom` Hierarchy [956df12]
    - [ ] Write failing tests in `tests/scheduler-validation.test.ts` for hierarchy-based room assignment.
    - [ ] Refactor `determineRoom` in `src/features/generator/solver.ts` to implement Subject-Priority fallback logic.
    - [ ] Ensure room occupancy checks account for double periods.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Solver Engine Refactor' (Protocol in workflow.md)

## Phase 3: Heuristics & Prioritization
- [ ] Task: Update MRV Heuristics for Bottleneck Rooms
    - [ ] Write failing tests in `tests/time-aware-generator.test.ts` demonstrating prioritization of Lab-based subjects.
    - [ ] Update `calculatePriority` in `src/features/generator/heuristics.ts` to boost scores for subjects with `requiredRoomId`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Heuristics & Prioritization' (Protocol in workflow.md)

## Phase 4: UI Integration (Modals)
- [ ] Task: Update Subject Editor Modal
    - [ ] Write failing tests in `src/features/subjects/SubjectEditorModal.test.tsx` (or similar) for room selection.
    - [ ] Add Room selection dropdown to Subject Editor UI.
- [ ] Task: Update Class Editor Modal
    - [ ] Write failing tests in `tests/ClassEditorModalUI.test.tsx` for default room selection.
    - [ ] Add Room selection dropdown to Class Editor UI.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: UI Integration (Modals)' (Protocol in workflow.md)

## Phase 5: Final Integration & Verification
- [ ] Task: End-to-End Scheduling Validation
    - [ ] Create a complex test scenario with competing room requirements.
    - [ ] Verify that the generator produces a valid schedule adhering to all room mappings.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Integration & Verification' (Protocol in workflow.md)
