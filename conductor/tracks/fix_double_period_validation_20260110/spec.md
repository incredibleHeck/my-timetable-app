# Specification: Fix Double Period Swap Validation

## Overview
Users reported that swapping or moving multi-period lessons (e.g., double periods) for the same teacher on the same day often resulted in false "Limit Exceeded" errors (Fatigue or Max Daily Periods). Investigation revealed that the validation logic failed to ignore the *entire duration* of the source slot, only ignoring the start period.

## Root Cause
In `src/services/scheduler/validation.ts`, the `checkSlotValidity` function uses an `ignoreSlot` parameter to exclude the slot being moved from conflict checks. However, the logic only compared `checkP === ignoreSlot.period`, meaning if the source was a double period (P0-P1), only P0 was ignored. P1 was still treated as occupied, leading to double-counting.

## Solution
Update `checkSlotValidity` to ignore the full range of the source slot:
`checkP >= ignoreSlot.period && checkP < ignoreSlot.period + duration`

This assumes the duration of the moved slot matches the duration of the ignored slot, which is true for standard drag-and-drop moves.

## Affected Areas
1.  **Teacher Fatigue Check:** Calculating consecutive periods and daily load.
2.  **Subject Constraints:** Calculating max periods per day for a subject.

## Verification
- Create a test case simulating a Double Period move.
- Verify that it passes valid moves that previously failed.
