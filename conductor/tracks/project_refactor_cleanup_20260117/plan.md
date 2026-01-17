# Plan: Project-Wide Refactor and Test Audit

## Phase 1: Audit and Cleanup
- [x] Task: Static Code Analysis & Syntax Fixes e6b161f
    - [ ] Run typescript compiler (`tsc --noEmit`) to identify all type errors and syntax issues.
    - [ ] Run linter (if configured) to identify style violations and unused variables.
    - [ ] Fix all identified syntax errors, broken imports, and type mismatches.
- [x] Task: Dead Code Removal SKIP
    - [ ] Scan for and remove unused variables, imports, and commented-out code blocks across `src/`.
    - [ ] Remove any temporary debug logs.

## Phase 2: Logic Consolidation
- [ ] Task: Utility Audit
    - [ ] Review `src/utils` and feature-specific logic for duplicate functions.
    - [ ] Consolidate duplicate time calculation or data transformation logic into shared utilities.
    - [ ] Update call sites to use the consolidated functions.

## Phase 3: Verification (Test-Driven Repair)
- [ ] Task: Test Suite Execution - Core Modules
    - [ ] Run tests for `src/features/generator/scheduler` (Solver, Validator, State).
    - [ ] Fix any logic errors exposed by the tests.
- [ ] Task: Test Suite Execution - Data Management
    - [ ] Run tests for `src/features/classes`, `src/features/teachers`, `src/features/subjects`.
    - [ ] Fix any logic errors exposed by the tests.
- [ ] Task: Test Suite Execution - UI & Integration
    - [ ] Run tests for `src/components`, `src/hooks`, and integration flows.
    - [ ] Fix any rendering or state update issues exposed by the tests.
- [ ] Task: Missing Coverage Gap Fill
    - [ ] Identify critical paths not covered by existing tests.
    - [ ] Generate and run new tests for these gaps.

## Phase 4: Final Validation
- [ ] Task: Full Suite Run
    - [ ] Execute the entire test suite (`npm test`) to ensure no regressions.
- [ ] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
