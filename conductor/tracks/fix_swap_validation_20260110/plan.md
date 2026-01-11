# Plan: Fix Swap Validation Logic for Same Teacher/Subject

## Phase 1: Validation Refinement [checkpoint: manual_fix]
- [x] Task: Create a reproduction test case specifically for swapping Math and Science periods for the same teacher.
- [x] Task: Update `src/services/scheduler/validation.ts` to ignore teacher occupancy at the target period if it's the same teacher being validated (indicating a self-swap).
- [x] Task: Update Section 6 (Subject Constraints) to ignore the current subject at the target period if it matches the subject being moved (preventing double-counting).
- [x] Task: Verify the fix with the reproduction test.
