# Specification: Fix False Positive Validation for Same-Day Moves

## Overview
A bug exists in the scheduling validation logic where moving or swapping existing periods on the same day triggers "Max periods per day" and "Max consecutive periods" errors. The system currently validates the target position as if it were an addition, failing to account for the fact that the period is being moved/swapped within the same day, which preserves the total count.

## Problem Statement
- **Context**: A teacher has multiple subjects (e.g., English and Math) on the same day.
- **Trigger**: Dragging a period to another slot (occupied or empty) on the same day.
- **Current Behavior**: Immediate UI validation error: "Max X periods of [Subject] per day" or "Max consecutive periods exceeded".
- **Root Cause**: The validation logic likely treats the "move" as "remove + add" but performs the "add" check before the "remove" is processed or without considering the net change in the daily context.

## Functional Requirements
- **Holistic Validation**: Validation during moves/swaps must consider the state of the schedule *after* the operation is completed.
- **Same-Day Exemption**: Daily limits (Max periods per subject per day) should remain valid if the period stays within the same day.
- **Consecutive Check Fix**: Moving a period within a day should correctly recalculate consecutive blocks based on the new arrangement rather than stacking on top of the old arrangement.

## Acceptance Criteria
1. Swapping two subjects (e.g., English and Math) for the same teacher on the same day does not trigger a daily limit error.
2. Moving a period to an empty slot on the same day for the same teacher does not trigger a daily limit error.
3. Moving periods to resolve a consecutive period violation actually resolves it without triggering a false positive based on the old state.
4. UI feedback correctly reflects the valid state after the drag-and-drop operation.

## Out of Scope
- Modifying the actual limit values (e.g., changing max periods from 2 to 3).
- Changes to cross-day validation logic unless directly shared with the same-day logic.
