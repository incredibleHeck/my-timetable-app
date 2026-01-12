# Plan: Project Structure Refactoring and Cleanup

## Phase 1: Preparation and Global Cleanup
- [~] Task: Audit `src/types` and `src/utils` to identify domain-specific items that should move to `features`.
- [ ] Task: Create a list of "Shared UI" candidates in `src/components/ui` vs feature-specific components currently in `src/components`.
- [ ] Task: Standardize the `src/features` template (ensure `index.ts` exists for each feature to expose its public API).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Preparation and Global Cleanup' (Protocol in workflow.md)

## Phase 2: Feature Reorganization (Horizontal Refactor)
- [ ] Task: Refactor `src/features/teachers`: move specific types from `src/types/` into `src/features/teachers/types/`.
- [ ] Task: Refactor `src/features/classes`: ensure components, hooks, and types are correctly encapsulated.
- [ ] Task: Refactor `src/features/subjects`: align with the new standard structure.
- [ ] Task: Refactor `src/features/rooms`: align with the new standard structure.
- [ ] Task: Refactor `src/features/dashboard`: move any non-shared components from `src/components` into this feature.
- [ ] Task: Refactor other features (`generator`, `workload`, `duty`, `exams`, `configuration`) following the same pattern.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Feature Reorganization' (Protocol in workflow.md)

## Phase 3: Infrastructure and Layout Cleanup
- [ ] Task: Clean up `src/services`: ensure domain-agnostic services (fileSystem, persistence) are clearly separated from domain-orchestrators (scheduler).
- [ ] Task: Organize `src/components/layout`: ensure Sidebar, Header, and UndoRedo are correctly placed and their internal components are properly modularized.
- [ ] Task: Final audit of `src/hooks`, `src/utils`, and `src/types` to remove remaining "clutter" and ensure all imports are clean and use consistent paths (e.g., aliased imports if configured).
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Infrastructure and Layout Cleanup' (Protocol in workflow.md)

## Phase 4: Final Verification and Stabilization
- [ ] Task: Run full build (`npm run build`) to ensure no import errors or type mismatches.
- [ ] Task: Run all existing tests (`npm test`) to ensure zero regression.
- [ ] Task: Perform a manual walkthrough of the application to verify all views and interactions remain functional.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Verification and Stabilization' (Protocol in workflow.md)
