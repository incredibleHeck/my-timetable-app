# Plan: Extreme Project Refactor & Reorganization

## Phase 1: Analysis and Mapping
- [ ] Task: Audit the current `src` folder structure and identify all "God files" and architectural inconsistencies.
- [ ] Task: Create a target architecture map following modern feature-based best practices.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Analysis and Mapping' (Protocol in workflow.md)

## Phase 2: Foundation and Shared Layer
- [ ] Task: Standardize and centralize `src/components/ui` (Atomic UI components).
- [ ] Task: Reorganize global `src/utils`, `src/hooks`, and `src/types`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Foundation and Shared Layer' (Protocol in workflow.md)

## Phase 3: Feature Reorganization & Decomposition
- [ ] Task: Refactor `src/features/generator` (Splitting the "God file" `ScheduleGrid.tsx` into smaller hooks and sub-components).
- [ ] Task: Progressively migrate and refactor other features (`scheduler`, `duty`, `exams`, `teachers`, etc.) into the new standardized structure.
- [ ] Task: Decompose complex services in `src/services` into domain-specific modules with clear APIs.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Feature Reorganization & Decomposition' (Protocol in workflow.md)

## Phase 4: Verification and Test Alignment
- [ ] Task: Fix all broken imports across the project.
- [ ] Task: Update the test suite to match the new file structure and ensure all tests are passing.
- [ ] Task: Final cleanup: remove obsolete files and directories.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification and Test Alignment' (Protocol in workflow.md)
