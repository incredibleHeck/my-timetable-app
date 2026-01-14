# Specification: Class Settings UI Reorganization

## Overview
Reorganize the Class Settings modal to improve logical grouping. Foundational identity and reservations will remain in "Basics", while all time-based structural settings—including new class-specific break and lunch durations—will move to the "Structure" area.

## Functional Requirements
- **Data Model Updates:**
    - Update the `ClassGroup` interface in `src/features/classes/types.ts` to include optional `breakDuration` and `lunchDuration` fields (numbers).
- **UI Reorganization (`ClassEditorModal.tsx`):**
    - **Basics Tab:**
        - **Keep:** "Class Name" input.
        - **Keep:** "Class-Specific Events" (Reservations) grid.
        - **Remove:** "Periods/Day" and "Duration" fields.
    - **Structure Tab:**
        - **Visual Grid:** Keep the interactive period toggle grid at the top.
        - **Moved Fields:** Relocate "Periods/Day" and "Class Duration" from the Basics tab to this section.
        - **New Fields:** Add "Break Duration (min)" and "Lunch Duration (min)" input fields.
        - **Layout:** Use a 2x2 grid for these four numeric inputs (Periods, Class Duration, Break Duration, Lunch Duration) placed below the visual structure grid.
- **Logic & Defaults:**
    - **Default Values:** Initialize the new duration fields using global defaults (`data.settings.defaultBreakDuration`, etc.) if class-specific values aren't set.
    - **Persistence:** Ensure all fields (including the two new ones) are saved to the class object.

## Non-Functional Requirements
- **Zero Regression:** Modifying the location of "Periods/Day" must not break the logic that resizes the Reservation grid (Basics tab) or the Structure grid (Structure tab).
- **Styling:** Maintain consistency with existing UI components.

## Acceptance Criteria
- [ ] Basics tab contains only Class Name and the Reservations grid.
- [ ] Structure tab contains the visual grid plus numeric inputs for Periods, Class Duration, Break Duration, and Lunch Duration.
- [ ] Break and Lunch durations are correctly persisted to the database/profile.
- [ ] Changing "Periods/Day" in the Structure tab correctly updates the grids in both tabs.

## Out of Scope
- Implementation of these durations in the scheduling engine.
