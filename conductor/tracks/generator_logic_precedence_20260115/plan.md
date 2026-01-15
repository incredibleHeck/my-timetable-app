# Plan: Generator Logic & Precedence (Class Overrides)

This plan implements hierarchical duration precedence (Class > Global), time-aware scheduling for teacher conflict resolution, UI updates for period times, and export integration.

## Phase 1: Foundation & Duration Resolution Logic
- [x] Task: Create duration resolution utility (7f74df2)
    - [x] Write tests for `getEffectiveDuration(classSettings, globalSettings, type, index)`
    - [x] Implement utility to prioritize Class overrides over Global defaults
- [x] Task: Update Profile Context/Types to support time calculations (d77c55c)
    - [x] Write tests for `calculateClassSchedule(classId, profile)`
    - [x] Implement logic to generate a full schedule of `[startTime, endTime]` for all slots in a day for a specific class
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)

## Phase 2: Generator View UI Updates
- [ ] Task: Update Grid Header UI
    - [ ] Write tests for `PeriodHeader` component (displaying times)
    - [ ] Implement time display in Generator View headers `(HH:mm - HH:mm)`
- [ ] Task: Ensure dynamic updates when switching classes
    - [ ] Write tests for header refresh on class selection change
    - [ ] Implement context/hook connection to update headers based on active class
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Updates' (Protocol in workflow.md)

## Phase 3: Time-Aware Generator Logic
- [ ] Task: Implement Absolute Time Validation
    - [ ] Write tests for `checkTeacherOverlap(teacherId, classA_TimeRange, classB_TimeRange)`
    - [ ] Implement validation logic to detect overlaps across different class schedules
- [ ] Task: Update Generator Algorithm
    - [ ] Write tests for Generator avoiding time-based teacher conflicts
    - [ ] Refactor the generation core to use time windows instead of just period indices for teacher availability
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Generator Logic' (Protocol in workflow.md)

## Phase 4: Export Integration
- [ ] Task: Update Export Services
    - [ ] Write tests for PDF/CSV export containing start/end times
    - [ ] Update export logic to include calculated period times for each class
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Export Integration' (Protocol in workflow.md)
