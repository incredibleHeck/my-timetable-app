# Specification: Fix Swap Validation Logic Error

## Overview
Currently, swapping two periods for a teacher (e.g., swapping a double English for a double Math on the same day) can trigger a 'Max periods exceeded' error. This occurs because the validation logic evaluates the "addition" of the new periods before fully accounting for the "removal" of the old ones, or it validates an inconsistent intermediate state. This bug affects both Drag-and-Drop and dedicated swap tools.

## Functional Requirements
- **Simulated State Validation:** The validator must be updated to evaluate the "final state" of the schedule after a proposed swap is completed, rather than validating individual moves in isolation.
- **Holistic Constraint Check:** The fix must apply to all constraints, including:
    - Daily Load Limits
    - Weekly Load Limits
    - Consecutive Period Limits
    - Teacher and Room availability
- **Prevent False Positives:** Swapping periods already assigned to a teacher/room must not trigger "Max Limit" errors if the net period count remains the same or decreases for that day/week.

## Non-Functional Requirements
- **Performance:** The validation check for swaps must remain performant to ensure smooth Drag-and-Drop interactions.
- **Consistency:** Use the same "simulated state" approach for all schedule modifications (moves and swaps) to ensure predictable behavior.

## Acceptance Criteria
- [ ] Swapping two double periods for the same teacher on the same day does not trigger a 'Max periods exceeded' error.
- [ ] Swapping a period with an empty slot (a "move") correctly validates against limits.
- [ ] Swapping two periods between different teachers correctly validates both teachers' constraints against the final state.
- [ ] All existing automated tests for scheduling constraints pass.
- [ ] New unit tests specifically reproducing the swap-limit bug are created and pass.

## Out of Scope
- Modifying the values of the limits themselves.
- Implementing new types of constraints.
- Refactoring the UI components of the scheduler (focus is on the logic layer).
