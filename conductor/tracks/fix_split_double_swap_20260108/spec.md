# Track Specification: Fix Split Double Period Swap Logic

## Overview
This bug fix addresses an issue in the Generator view's swap logic where double periods that are split by a break or lunch (e.g., Period 2 and Period 3 with a Recess in between) are treated as two separate single periods. This prevents the swap logic from correctly identifying and moving them as a single logical unit.

## Functional Requirements
1. **Logical Double Period Detection:** The swap logic must be enhanced to detect when two periods of the same subject for the same class and teacher are separated only by a non-class period (Break, Lunch, etc.).
2. **Unified Swap Operation:** When a user initiates a swap involving one part of a split double period, the system must treat both parts as a single unit.
3. **Target Context Awareness:** The logic must be able to swap these split periods into a new location. If the target location also has an intervening break or lunch, the split structure should be preserved.
4. **Validation Integration:** The `checkSlotValidity` service must be updated to correctly handle these split units during the swap validation phase.

## Acceptance Criteria
- Users can successfully drag and swap a double period that is split by a break or lunch.
- Swapping a split double period moves both the pre-break and post-break slots simultaneously.
- The swap correctly handles cases where the target location has a different period structure (e.g., swapping a split double into a contiguous double period slot, if valid).
- No regressions are introduced for contiguous double periods or standard single periods.

## Out of Scope
- Changing the underlying data structure of how slots are stored.
- Modifying the automatic scheduler (this fix is for manual manual swaps in the Generator view).
