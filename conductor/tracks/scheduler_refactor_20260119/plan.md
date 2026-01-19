# Plan: Refactor Scheduler File Structure

## Phase 1: Setup [checkpoint: a87bf72]
- [x] Task: Create the new directory structure in `src/features/generator/scheduler/`. c55419e
    - Create: `core/`, `solver/`, `logic/`, `diagnostics/`, `utils/`.
- [ ] Task: Conductor - User Manual Verification 'Setup' (Protocol in workflow.md)

## Phase 2: Migration
- [x] Task: Move `core` files (`generator.ts`, `worker.ts`, `state.ts`, `types.ts`) to `core/` and update internal/relative imports. f98850b
- [x] Task: Move `utils` files (`utils.ts`) to `utils/` and update internal/relative imports. c0eec4f
- [x] Task: Move `logic` files (`constraints.ts`, `evaluation.ts`, `scoring.ts`, `preparation.ts`, `rooms.ts`) to `logic/` and update internal/relative imports. 008f05b
- [x] Task: Move `validation` root files (`audit.ts`) to `validation/` and update internal/relative imports. 39aecbe
- [ ] Task: Move `solver` files (`solver.ts`, `search.ts`, `repair.ts`, `tabu.ts`, `heuristics.ts`) to `solver/` and update internal/relative imports.
- [ ] Task: Move `diagnostics` files (`smoke-test.ts`, `test-real-world.ts`, `school-data.json`) to `diagnostics/` and update internal/relative imports.
- [ ] Task: Conductor - User Manual Verification 'Migration' (Protocol in workflow.md)

## Phase 3: Stabilization & Verification
- [ ] Task: Update external references.
    - Scan the codebase for imports importing from `scheduler/*` (old paths) and update them to the new specific paths (e.g., `scheduler/core/generator`).
- [ ] Task: Verify Compilation.
    - Run `tsc --noEmit` to ensure there are no import errors or type mismatches.
- [ ] Task: Verify Functionality.
    - Run the smoke test (now in `diagnostics/smoke-test.ts`) to ensure the scheduler logic is intact.
- [ ] Task: Conductor - User Manual Verification 'Stabilization & Verification' (Protocol in workflow.md)
