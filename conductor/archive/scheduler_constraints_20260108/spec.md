# Track Specification: Refine and Validate Core Scheduler Constraints

## Context
The application currently has a basic scheduling engine and validation logic. However, to ensure reliability for complex educational schedules, we need to rigorously validate and refine the core constraints. This track focuses on the `src/services/scheduler/validation.ts` module and its integration with the frontend `ConflictPanel`.

## Goals
1.  **Comprehensive Validation:** Ensure all critical constraints (teacher availability, room capacity, subject grouping, consecutive periods) are correctly implemented in `validation.ts`.
2.  **Visual Feedback:** Verify that the `ConflictPanel` in `GeneratorView` accurately displays all constraint violations in real-time.
3.  **Test Coverage:** Increase unit test coverage for the validation logic to prevent regressions.

## Key Files
-   `src/services/scheduler/validation.ts`: The core logic for checking schedule validity.
-   `src/features/generator/components/ConflictPanel.tsx`: The UI component for displaying conflicts.
-   `src/services/scheduler/types.ts`: Type definitions for constraints and schedule slots.
-   `tests/scheduler-validation.test.ts` (New): Dedicated test file for validation logic.

## Detailed Requirements

### 1. Constraint Verification
-   **Teacher Availability:** A teacher cannot be booked for two classes at the same time.
-   **Room Capacity:** The number of students in a class cannot exceed the room's capacity.
-   **Room Availability:** A room cannot be booked for two different classes at the same time.
-   **Subject Constraints:** Specific subjects may require specific room types (e.g., Science Lab).

### 2. UI Integration
-   The `ConflictPanel` must listen to changes in the schedule state.
-   Violations should be categorized (e.g., "Critical", "Warning").
-   Clicking a conflict in the panel should highlight the problematic slot on the grid (if feasible).

### 3. Testing
-   Create a suite of unit tests covering edge cases for each constraint type.
-   Mock schedule data to simulate various conflict scenarios.
