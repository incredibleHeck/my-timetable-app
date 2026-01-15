# Specification: Workload Refactoring & Model Improvements

## Overview
This track refactors teacher workload calculations to count unique time slots and improves the underlying data models for `JointClass` and `ElectiveBlock` to support more complex, cross-class scheduling scenarios.

## 1. Entity Model Improvements

### 1.1 ElectiveBlock Refactor
- Update `ElectiveBlock` interface in `src/features/classes/types.ts`:
    - Replace `classId: string` with `classIds: string[]`.
- Update `preparation.ts` and `solver.ts` to ensure that when an elective block is scheduled, all classes in `classIds` are marked as occupied for that period.

### 1.2 JointClass Refactor
- Update `JointClass` interface in `src/features/classes/types.ts`:
    - Add `teacherId?: string` (optional override).
- Update `preparation.ts`: If `JointClass.teacherId` is present, use it; otherwise, fallback to the current logic of checking the first class's curriculum.

## 2. Workload Calculation Logic

### 2.1 Requested Workload (Curriculum-based)
- Update `useWorkloadStats` to de-duplicate requirements.
- **Logic:** 
    1. Identify all `CurriculumItems` for a teacher.
    2. Group items that belong to the same `JointClass` (shared `subjectId` and `classIds`) or the same `ElectiveBlock`.
    3. Count each group's `periodsPerWeek` only once toward the teacher's total.

### 2.2 Scheduled Workload (Timetable-based)
- Update `useWorkloadStats` and `Dashboard` metrics.
- **Logic:** Calculate "Actual Load" by counting unique `(Day, PeriodIndex)` pairs in the global `schedule` where the `teacherId` matches.

## 3. Engine & Validation Updates

### 3.1 Validation Logic (`checkSlotValidity`)
- **Teacher Daily Load Check:** When calculating `dailyLoad` for a teacher on a specific day, count unique period indices instead of summing assignments.
- This allows a teacher to be in two places at once (Joint Class) without violating their "Max Periods Per Day" limit.

### 3.2 Solver Logic (`solveSmart`)
- **Scoring:** The "Workload Balancing" penalty (which prevents piling all of a teacher's classes onto one day) must use the unique period count.
- **Constraints:** The `maxTeacherPeriodsPerDay` hard constraint must check unique period occupancy.

## Acceptance Criteria
- [ ] A teacher assigned to "PE" for both Class 7A and 7B (Joint) shows 1 hour of work in the stats, not 2.
- [ ] Elective Blocks can now be defined across multiple classes (e.g., "Year 9 Science Elective" for 9A, 9B, and 9C).
- [ ] "Daily Load" validation no longer triggers errors for teachers of Joint Classes.
- [ ] Existing schedules remain valid after the refactor.
