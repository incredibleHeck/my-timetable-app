# Track Specification: Fix Conflict Reporting Logic

## Overview
The current Conflict Reporting mechanism displays a historical log of all collisions encountered during the generation process, including those that were subsequently resolved by the solver. This results in "stale" noise for the user. 

This track will implement a dedicated **Post-Generation Audit** phase. Once the generator completes, a new validation function (`generateFinalReport`) will run against the final schedule state to produce a clean, 100% accurate list of remaining issues, ensuring the Conflict Panel reflects "Current Reality" rather than "History".

## Functional Requirements

### 1. Final Audit Logic (`generateFinalReport`)
Create a pure function that accepts the final `TimetableData` (or `Schedule` object) and returns a list of active conflicts.
It must validate:
*   **Double Bookings:**
    *   **Teachers:** A teacher assigned to multiple classes in the same period.
    *   **Rooms:** A room assigned to multiple classes in the same period.
*   **Class Gaps (Windows):**
    *   Detect generic "gaps" in schedules (based on existing logic definitions).
*   **Subject Continuity:**
    *   Verify subject-specific placement rules (e.g., "Math" shouldn't be split weirdly if constraints exist).

### 2. Integration & Workflow
*   **During Generation:** The solver continues to use its internal, incremental audit for Iterative Repair. This data is *not* pushed to the public Conflict Panel as a final result.
*   **On Completion:**
    *   Trigger: Generation Status changes to `COMPLETED`.
    *   Action: Clear any accumulated "log" conflicts.
    *   Action: Execute `generateFinalReport`.
    *   Action: Update the Conflict Panel store/context with this fresh list.

### 3. User Interface
*   The Conflict Panel in the Generator View should only show the output of the Final Audit after generation finishes.

## Acceptance Criteria
*   [ ] After a successful generation, the Conflict Panel contains **zero** "fixed" conflicts (conflicts that existed mid-process but were resolved).
*   [ ] If a conflict *actually* exists in the final schedule (e.g., force-placed), it appears in the panel.
*   [ ] The report accurately identifies Double Bookings, Gaps, and Continuity issues.
*   [ ] The audit runs automatically without user intervention when generation finishes.
