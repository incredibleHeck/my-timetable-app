# Track Specification: Refactor and Fix Configuration View

## Overview
The current `GlobalConfigView.tsx` is a monolithic file that is difficult to maintain and has several layout regressions. This track focuses on refactoring the component into a modular structure and fixing specific UI issues: specifically, the "Interactive Schedule Chain" cards need to move from a vertical list to a horizontal layout under the periods slider, and the "Global Reservations" grid needs layout corrections.

## Functional Requirements

### 1. Component Refactoring
Extract the following sections into separate functional components within `src/features/configuration/components/`:
*   `SchoolIdentitySection`: Institutional metadata inputs.
*   `TimelineAutomationSection`: "Smart Timeline" duration and start time controls.
*   `ScheduleChainSection`: The interactive cards for Periods, Breaks, and Lunches.
*   `RulesSection`: Fatigue guards, subject limits, and teacher load constraints.
*   `ReservationsGridSection`: The "Global Reservations" interactive table.
*   `SlotEditModal`: The modal for configuring reserved slots.

### 2. UI & Layout Fixes
*   **Horizontal Schedule Chain:** Move the "Interactive Schedule Chain" cards from a vertical stack to a horizontal row. This section should sit directly under the "Total Periods" slider.
*   **Full-Width Rules Section:** Reposition the "Rules & Constraints" (Fatigue Guard, etc.) as a full-width section below the horizontal schedule chain, rather than a narrow sidebar.
*   **Reservations Grid Correction:** Fix the messed-up layout of the "Global Reservations" grid to ensure columns (Periods) and rows (Days) align correctly regardless of the period count.

## Acceptance Criteria
*   [ ] `GlobalConfigView.tsx` is reduced to a clean orchestrator component.
*   [ ] New components are modular, typed, and correctly receive props from the `useGlobalConfig` hook.
*   [ ] Schedule chain cards (CLASS/BREAK/LUNCH) are arranged horizontally.
*   [ ] "Rules & Constraints" section occupies the full width of the container.
*   [ ] The "Global Reservations" grid is legible, responsive, and correctly aligned with the period headers.
*   [ ] All existing functionality (Start of Day updates, duration changes, slot editing) remains fully functional.
