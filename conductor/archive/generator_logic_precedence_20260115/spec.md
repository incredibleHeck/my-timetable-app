# Specification: Generator Logic & Precedence (Class Overrides)

## Overview
This track updates the timetable generation algorithm to prioritize Class-specific settings over Global settings. It introduces time-aware scheduling to prevent teacher overlaps across different classes with varying schedules and ensures these times are captured in exports.

## Functional Requirements

### 1. Generation Logic Precedence
- The generation algorithm must calculate time slots based on a hierarchy:
    1. **Class Settings:** Class-specific durations for periods, breaks, or lunch take precedence.
    2. **Global Settings:** Fallback to global defaults if no class-level override exists.
- **Start Time:** The first period always begins at the **Global Start Time**.
- **Sequential Calculation:** Each slot starts immediately after the preceding slot ends.

### 2. Time-Aware Teacher Conflict Resolution
- **Absolute Time Validation:** The generator must prevent a teacher from being scheduled in two different classes if the calculated **Start Time** and **End Time** windows overlap.
- **Automated Resolution:** During generation, the algorithm must treat time overlaps as a hard constraint, automatically seeking slots where the teacher is free across all classes they are assigned to.

### 3. Generator View UI Updates
- **Column Headers:** Display calculated start and end times underneath period names in the grid.
    - Format: `(HH:mm - HH:mm)` (e.g., `(08:00 - 08:40)`).
- **Dynamic Updates:** Header times must refresh when switching between classes.

### 4. Export Integration
- **Time Inclusion:** Exported timetables (PDF, CSV, or Excel) must include the calculated Start and End times for each assigned period.

## Non-Functional Requirements
- **Constraint Complexity:** The generator's backtracking/search logic must be optimized to handle the increased complexity of time-window overlaps instead of simple period-index matches.

## Acceptance Criteria
- [ ] Changing a class-specific period duration updates all subsequent times for that class.
- [ ] **Conflict Prevention:** A teacher cannot be assigned to Class A (08:00 - 08:45) and Class B (08:30 - 09:10) simultaneously.
- [ ] **Successful Generation:** The generator successfully produces a conflict-free schedule even when classes have staggered break/period times.
- [ ] **Export Verification:** The final exported file contains a "Time" column or metadata for each period.

## Out of Scope
- Manual override of individual period times (must be set via Class/Global settings).
- Supporting "Floating" periods that don't follow a strict sequence.
