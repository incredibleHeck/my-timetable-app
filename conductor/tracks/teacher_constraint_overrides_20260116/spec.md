# Specification: Per-Teacher Constraint Overrides

## 1. Overview
This feature introduces the ability to set a `maxPeriodsPerDay` constraint for individual teachers, overriding the global configuration. This allows for more granular control over teacher schedules, accommodating specific part-time arrangements or workload agreements.

## 2. Functional Requirements

### 2.1 Data Model
-   **Update `Teacher` Interface:**
    -   Add an optional property `maxPeriodsPerDay?: number` to the `Teacher` interface in `src/features/teachers/types.ts`.
    -   Ensure this property is persisted with the application state.

### 2.2 User Interface
-   **Edit Teacher Modal:**
    -   Add a number input field labeled "Max Periods Per Day" to the teacher editing form.
    -   Include a placeholder or helper text indicating "Leave empty to use global setting".
    -   Validation: Input must be a positive integer or empty.
-   **Teachers List:**
    -   Do not modify the main teachers table (keep the override hidden in the list view to reduce clutter).

### 2.3 Core Logic & Validation
-   **Constraint Hierarchy:**
    -   Implement a fallback mechanism for retrieving the effective max periods limit:
        ```typescript
        const effectiveLimit = teacher.maxPeriodsPerDay ?? settings.maxTeacherPeriodsPerDay;
        ```
-   **Real-time Validation:**
    -   Update the conflict detection engine to use this `effectiveLimit`.
    -   Trigger validation immediately when a teacher's constraint is modified.
    -   If the current schedule violates a new specific limit, generate a conflict.

### 2.4 Feedback & Reporting
-   **Conflict Reporting:**
    -   **Severity:** Report violations as **High** severity conflicts.
    -   **Message:** distinct error message: "Exceeds [Teacher Name]'s daily limit of [X] periods" (distinguishing it from the global limit).
    -   **Visuals:** Highlight affected slots in the schedule grid consistent with existing conflict visualization.

## 3. Technical Considerations
-   **Migration:** Existing teacher records will have `undefined` for this new property, automatically falling back to the global setting (non-breaking change).
-   **Performance:** The fallback check is lightweight and should not impact generator performance.

## 4. Acceptance Criteria
-   [ ] A "Max Periods Per Day" field exists in the "Edit Teacher" modal.
-   [ ] Saving a teacher with a specific limit persists the value.
-   [ ] Leaving the field empty persists as `undefined` (or null).
-   [ ] The schedule validator uses the teacher's specific limit if set.
-   [ ] The schedule validator uses the global limit if the teacher's specific limit is not set.
-   [ ] Changing a limit triggers real-time validation of the existing schedule.
-   [ ] Conflicts caused by teacher-specific overrides are clearly labeled with the teacher's name and specific limit.
