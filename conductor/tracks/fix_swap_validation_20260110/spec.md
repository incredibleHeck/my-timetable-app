# Specification: Fix Swap Validation Logic for Same Teacher/Subject

## Overview
Swapping periods for the same teacher or class often triggers false validation conflicts (e.g., "Max 2 periods per day" or "Teacher is busy") because the validator sees both the new (proposed) and old (target) periods at once during the intermediate validation step.

## Root Cause
In `src/services/scheduler/validation.ts`, the `checkSlotValidity` function correctly ignores the source slot (via `ignoreSlot`), but it fails to ignore the target slot's current content during a swap. This results in double-counting subjects or teacher load at the target location.

## Solution
1. **Teacher Overlap:** In Section 4B, ignore target occupancy if the teacher found at that slot is the same teacher being validated.
2. **Subject Limits:** In Section 6, ignore the subject at the target slot when counting daily periods, as it will be displaced by the move.

## Affected Areas
- `src/services/scheduler/validation.ts`: Core validation logic for drag-and-drop and manual moves.
