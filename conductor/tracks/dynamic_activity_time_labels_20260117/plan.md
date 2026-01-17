# Implementation Plan: Dynamic Dashboard Activity & Timetable Time Labels

## Phase 1: Data Model & Activity Service [checkpoint: ]
- [x] Task: Update `AppData` and `Activity` type definitions (1d40cad)
    - [x] Add `Activity` interface to `src/types/index.ts`
    - [x] Update `AppData` to include `recentActivity: Activity[]`
- [x] Task: Implement `addActivity` service in `ProfileContext` (1d40cad)
    - [x] Create `addActivity` helper in `src/contexts/ProfileContext.tsx`
    - [x] Integrate `addActivity` into `updateActiveProfile`
- [x] Task: Write unit tests for activity logging service (1d40cad)
    - [x] Create `tests/activity-service.test.ts`
    - [x] Verify activities are correctly appended and persisted
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Activity Service' (Protocol in workflow.md)

## Phase 2: Scheduling Activity Integration [checkpoint: ]
- [x] Task: Integrate activity tracking into Drag-and-Drop operations (54b0eba)
    - [x] Update `src/features/generator/hooks/useDndLogic.ts` to call `addActivity` on move/swap
- [x] Task: Write unit tests for scheduling activities (54b0eba)
    - [x] Verify human-readable messages are generated for DnD actions
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Scheduling Activity Integration' (Protocol in workflow.md)

## Phase 3: Academic Data & Settings Integration [checkpoint: ]
- [x] Task: Integrate activity tracking into Academic Data editors (046b96d)
    - [x] Add logging to Teacher, Class, Room, and Subject create/update/delete handlers
- [x] Task: Integrate activity tracking into Global Settings (046b96d)
    - [x] Add logging to settings modification handlers
- [x] Task: Verify academic/system activities with unit tests (046b96d)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Academic Data & Settings Integration' (Protocol in workflow.md)

## Phase 4: Dashboard UI Update [checkpoint: ]
- [x] Task: Refactor `DashboardView` to use dynamic activity data (db71059)
    - [x] Update `src/features/dashboard/DashboardView.tsx` to map over `recentActivity`
    - [x] Implement category-based icons (Lucide React)
- [x] Task: Verify Dashboard UI updates in real-time (db71059)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Dashboard UI Update' (Protocol in workflow.md)

## Phase 5: Timetable Time Labels [checkpoint: ]
- [x] Task: Add time range labels to `DraggableSlot` (3802ad5)
    - [x] Update `src/features/generator/components/DraggableSlot.tsx` to display start/end times
    - [x] **Strictly enforce visibility:** Only render timestamps when `mode === 'TEACHER'`
- [x] Task: Optimize time label calculation and formatting (3802ad5)
- [x] Task: Verify Print Support for time labels (3802ad5)
    - [x] Check CSS print styles and verify labels appear in print preview
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Timetable Time Labels' (Protocol in workflow.md)

## Phase 6: Final Polish & Regression [checkpoint: ]
- [x] Task: Final regression testing (c010e42)
    - [x] Run full test suite: `npm test`
    - [x] Perform end-to-end manual walkthrough
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Final Polish & Regression' (Protocol in workflow.md)
