# Plan: Dynamic State Handling - Auto-Update Duration

## Phase 1: Implementation & Unit Testing [checkpoint: ]
- [x] Task: Create `tests/ClassEditorModalDynamic.test.tsx` with failing tests for auto-updating `cBreakDuration`, `cLunchDuration`, and `cDuration` when the first slot of each type is added. [770a746]
- [x] Task: Update the slot toggle logic in `src/features/classes/components/ClassEditorModal.tsx` to detect the first instance of a type and apply global defaults. [770a746]
- [x] Task: Add tests to verify that manual duration adjustments are NOT overwritten by subsequent toggles of the same type. [770a746]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Implementation & Unit Testing' (Protocol in workflow.md)

## Phase 2: Final Verification [checkpoint: ]
- [ ] Task: Run the full test suite (`npm test`) to ensure no regressions in existing `ClassEditorModal` tests.
- [ ] Task: Run the full build (`npm run build`) to ensure type safety.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Final Verification' (Protocol in workflow.md)
