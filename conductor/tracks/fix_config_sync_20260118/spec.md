# Track Specification: Fix Configuration Synchronization

## Overview
The configuration view currently has a synchronization bug where adjusting the "Total Daily Periods" slider updates the numeric state but fails to add or remove cards from the "Interactive Schedule Chain". Additionally, changes to "Smart Timeline Automation" inputs (Start of Day, Durations) do not consistently trigger the recalculation logic, leading to stale clock times in the UI.

This track will ensure that all configuration controls use the optimized logic provided by the `useGlobalConfig` hook to maintain a consistent and valid timetable structure.

## Functional Requirements

### 1. Period Slider Synchronization
*   Update the "Total Daily Periods" slider in `GlobalConfigView.tsx` to call `handlePeriodCountChange` from the `useGlobalConfig` hook.
*   Ensure that increasing/decreasing the count correctly grows or shrinks the `dayStructure` and `fixedOccasions` arrays.

### 2. Timeline Automation Fixes
*   Update "Smart Timeline Automation" inputs (Class, Break, and Lunch minutes) to use `handleDurationChange`.
*   Ensure the "Start of Day" input triggers a full timeline recalculation so all card clock times shift accordingly.

### 3. Activity Logging
*   Maintain "Activity Feed" logging for all configuration changes. 
*   Coordinate logging within the view components or by updating the hook to ensure every change is captured.

## Acceptance Criteria
*   [ ] Adjusting the periods slider instantly adds or removes cards from the interactive chain.
*   [ ] Changing any duration (Class/Break/Lunch) instantly updates the start/end times displayed on all cards.
*   [ ] Changing the "Start of Day" time shifts the entire schedule chain's timeline correctly.
*   [ ] All configuration changes generate a corresponding entry in the "Recent Activity" feed.
