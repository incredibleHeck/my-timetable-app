# Implementation Plan: room_mapping_hierarchy_20260117

## Phase 1: Data Model & Types [checkpoint: 1f3c354]
- [x] Task: Update Global Types and Mock Data [f1d2e46]
    - [x] Add `requiredRoomId` to `Subject` interface in `src/types/index.ts`.
    - [x] Add `defaultRoomId` to `ClassGroup` interface in `src/types/index.ts`.
    - [x] Update mock data in tests and services to include these new fields.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Types' (Protocol in workflow.md)

## Phase 2: Solver Engine Refactor [checkpoint: 1f3c354]
- [x] Task: Implement `determineRoom` Hierarchy [956df12]
    - [x] Write failing tests in `tests/scheduler-validation.test.ts` for hierarchy-based room assignment.
    - [x] Refactor `determineRoom` in `src/features/generator/solver.ts` to implement Subject-Priority fallback logic.
    - [x] Ensure room occupancy checks account for double periods.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Solver Engine Refactor' (Protocol in workflow.md)

## Phase 3: Heuristics & Prioritization [checkpoint: 1f3c354]
- [x] Task: Update MRV Heuristics for Bottleneck Rooms [8389cf2]
    - [x] Write failing tests in `tests/time-aware-generator.test.ts` demonstrating prioritization of Lab-based subjects.
    - [x] Update `calculatePriority` in `src/features/generator/heuristics.ts` to boost scores for subjects with `requiredRoomId`.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Heuristics & Prioritization' (Protocol in workflow.md)

## Phase 4: UI Integration (Modals) [checkpoint: 1f3c354]
- [x] Task: Update Subject Editor Modal [f1d2e46]
    - [x] Write failing tests in `tests/SubjectsView.test.tsx` for room selection.
    - [x] Add Room selection dropdown to Subject Editor UI.
- [x] Task: Update Class Editor Modal [f1d2e46]
    - [x] Write failing tests in `tests/ClassEditorModalUI.test.tsx` for default room selection.
    - [x] Add Room selection dropdown to Class Editor UI.
- [x] Task: Conductor - User Manual Verification 'Phase 4: UI Integration (Modals)' (Protocol in workflow.md)

## Phase 5: Final Integration & Verification
- [x] Task: End-to-End Scheduling Validation [78a599a]
    - [x] Create a complex test scenario with competing room requirements.
    - [x] Verify that the generator produces a valid schedule adhering to all room mappings.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Integration & Verification' (Protocol in workflow.md)