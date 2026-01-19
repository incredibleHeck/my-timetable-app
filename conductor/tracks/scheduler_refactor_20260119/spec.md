# Track: Refactor Scheduler File Structure

## Overview
This track involves refactoring the `src/features/generator/scheduler/` directory by organizing the existing flat file structure into functional subdirectories. This aims to improve code maintainability, navigation, and logical separation of concerns.

## Functional Requirements
- **No functional changes** are to be made to the application logic. The behavior of the scheduler must remain exactly the same.
- The refactoring is purely structural (moving files and updating imports).

## Proposed Directory Structure
The files will be organized into the following folders:

### `core/`
*   `generator.ts`
*   `worker.ts`
*   `state.ts`
*   `types.ts`

### `solver/`
*   `solver.ts`
*   `search.ts`
*   `repair.ts`
*   `tabu.ts`
*   `heuristics.ts`

### `logic/`
*   `constraints.ts`
*   `evaluation.ts`
*   `scoring.ts`
*   `preparation.ts`
*   `rooms.ts`

### `validation/`
*   *(Existing contents of `validation/`)*
*   `audit.ts` (Moved from root)

### `diagnostics/`
*   `smoke-test.ts`
*   `test-real-world.ts`
*   `school-data.json`

### `utils/`
*   `utils.ts`

## Acceptance Criteria
- [ ] All files are moved to their respective folders as defined above.
- [ ] All internal imports within the `scheduler` module are updated to reflect the new paths.
- [ ] All external imports (from other parts of the app) referencing these files are updated.
- [ ] The application compiles without errors (`tsc`).
- [ ] The scheduler functionality works as before (verified via smoke test or manual run).
