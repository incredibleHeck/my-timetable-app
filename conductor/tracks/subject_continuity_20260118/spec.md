# Specification: Subject Continuity Validation Rule

## Overview
Implement a "Subject Continuity" validation rule that ensures every subject scheduled for a specific class on a specific day exists as a single continuous block. This prevents "split" subjects where a class has the same subject multiple times in a day with other instructional periods in between.

## Functional Requirements

### 1. Continuity Logic
For a given Class Group and Day:
- All periods assigned to the same **SubjectID** must be contiguous.
- **Valid Continuity:**
    - Adjacent period indexes (e.g., P1, P2).
    - Non-adjacent period indexes separated **only** by "Bridge" slots (types `BREAK` or `LUNCH`).
- **Invalid Continuity (Split Subject):**
    - Non-adjacent period indexes separated by any instructional slot (type `CLASS`), whether that slot is:
        - Occupied by a different subject.
        - Empty.
- **Scope:** Applies to all subjects in the curriculum.

### 2. Validation Integration
- **Hard Constraint:** This rule is classified as a high-priority hard constraint.
- **Penalty:** Violation results in high penalty points (1500) to ensure the automated solver prioritizes resolving or avoiding splits.
- **Conflict Count:** A violation counts as 1 conflict, triggering eviction logic in the Min-Conflicts solver.
- **Placement:** The check will be integrated into the `checkSlotValidity` pipeline, likely within `load-checks.ts` or a new dedicated file.

### 3. User Interface Behavior
- **Manual Moves:** If a user attempts to drag and drop a subject into a position that would create a split, the validation must return `valid: false`.
- **Feedback:** The UI should block the move and display an error message: "Subject '[Subject Name]' must be in a continuous block."

## Non-Functional Requirements
- **Performance:** The check must be efficient (O(P) where P is the number of periods in a day) to maintain real-time validation during drag-and-drop and high performance during automated generation.

## Acceptance Criteria
- [ ] `checkSubjectContinuity` function correctly identifies valid blocks (including those bridged by breaks).
- [ ] `checkSubjectContinuity` correctly flags split subjects as invalid.
- [ ] Automated generator successfully avoids creating split subject schedules.
- [ ] Manual drag-and-drop is blocked when a move would result in a split subject.
- [ ] Unit tests cover various scenarios: continuous blocks, break-bridged blocks, split by different subject, split by empty slot.

## Out of Scope
- Configurable "opt-out" for specific subjects (all subjects are currently included).
- Soft constraint mode (this is strictly a hard constraint).
