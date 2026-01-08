# Specification: Exam Logistics Engine (Interactive Swapping)

## Overview
This track implements an advanced, interactive interface for managing examination schedules. It allows administrators to manually adjust exam timings and locations using drag-and-drop while receiving immediate feedback on constraint violations.

## Goals
*   **Tactile Interaction:** Implement a smooth drag-and-drop experience for moving exams between slots.
*   **Constraint Engine:** Real-time validation of scheduling rules (e.g., student conflicts, room capacity, invigilator availability).
*   **Visual Conflict Feedback:** Highlight valid/invalid drop zones and provide detailed tooltips explaining conflicts.
*   **State Integrity:** Ensure manual swaps maintain data consistency across the profile.

## Functional Requirements
1.  **Exam Grid:** A high-density grid showing Exam Slots (Time/Day) vs Rooms or Subjects.
2.  **Drag-and-Drop:** Ability to drag an exam from one slot and drop it into another.
3.  **Conflict Detection:**
    -   *Student Conflict:* A student/group cannot have two exams at the same time.
    -   *Room Conflict:* Room capacity exceeded or room double-booked.
    -   *Invigilator Conflict:* Invigilator assigned to overlapping sessions.
4.  **Interactive Swapping:** Option to "swap" two exams by dropping one onto another occupied slot.

## Technical Requirements
*   **DND Library:** Utilize `@dnd-kit` for all drag-and-drop interactions.
*   **Validation Logic:** Implement a `validateExamMove` utility that returns a list of specific constraint violations.
*   **Component Architecture:** Refactor `ExamGrid.tsx` and `ExamCard.tsx` to support the new interactive states.
