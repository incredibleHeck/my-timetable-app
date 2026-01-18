# Implementation Plan: Fix Configuration Synchronization

This plan addresses the synchronization issues between configuration inputs and the interactive schedule structure by centralizing state logic through the `useGlobalConfig` hook.

## Phase 1: Slider and Timeline Synchronization
Reconnect the UI controls to the appropriate hook handlers.

- [x] **Task: Update Period Slider** [bf7a1e2]
    - [x] Modify `GlobalConfigView.tsx` to call `handlePeriodCountChange(val)` instead of updating state directly.
- [x] **Task: Update Automation Durations** [bf7a1e2]
    - [x] Update `TimelineAutomationSection.tsx` inputs (Class, Break, Lunch) to use `handleDurationChange`.
- [x] **Task: Update Start of Day** [bf7a1e2]
    - [x] Ensure "Start of Day" input in `TimelineAutomationSection.tsx` triggers `handleDurationChange("schoolStartTime", val)` to force a full recalculation.

## Phase 2: Activity Feed Integration
Ensure all hook-driven updates are still logged in the activity feed.

- [x] **Task: Implement Logging in View/Section Components** [bf7a1e2]
    - [x] Add `addActivity` calls to `GlobalConfigView.tsx` and its child sections to mirror the hook updates.

## Phase 3: Verification
Verify that the timetable remains valid across multiple configuration changes.

- [x] **Task: End-to-End Functional Test** [bf7a1e2]
    - [x] Change periods from 8 to 10. Verify 10 cards exist.
    - [x] Change Start of Day from 08:00 to 09:00. Verify all card times shifted by 1 hour.
    - [x] Verify "Recent Activity" shows all changes.
- [x] **Task: Conductor - User Manual Verification 'Config Synchronization' (Protocol in workflow.md)** [bf7a1e2]