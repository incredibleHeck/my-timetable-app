# Plan: Class Settings UI Reorganization

## Phase 1: Data Model and State Setup [checkpoint: a2c159b]
- [x] Task: Update the `ClassGroup` interface in `src/features/classes/types.ts` to include `breakDuration` and `lunchDuration`. [8a06b3a]
- [x] Task: Add new state variables `cBreakDuration` and `cLunchDuration` to `ClassEditorModal.tsx`. [7e3f5d1]
- [x] Task: Update the hydration logic in `useEffect` to initialize these new states from `editingClass` or global defaults (`data.settings`). [d791cb2]
- [x] Task: Update the `handleSave` function to include the new duration fields in the `newClass` object. [6a9806d]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Data Model and State Setup' (Protocol in workflow.md) [a2c159b]

## Phase 2: UI Reorganization
- [x] Task: Modify the "Basics" tab content in `ClassEditorModal.tsx` to remove "Periods/Day" and "Duration". [b64a7af]
- [ ] Task: Create a new sub-component or helper function `renderStructureTimingInputs` to house the 2x2 grid of numeric inputs. [7d7f8ca]
- [x] Task: Update the "Structure" tab content to include the visual grid followed by the new timing inputs grid. [d18b6bc]
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Reorganization' (Protocol in workflow.md)

## Phase 3: Validation and Verification
- [ ] Task: Create a unit test in `tests/` to verify that `ClassEditorModal` correctly initializes and saves the new fields.
- [ ] Task: Verify that changing "Periods/Day" in the "Structure" tab correctly updates the Reservations grid in the "Basics" tab.
- [ ] Task: Run full build (`npm run build`) to ensure no type mismatches.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation and Verification' (Protocol in workflow.md)
