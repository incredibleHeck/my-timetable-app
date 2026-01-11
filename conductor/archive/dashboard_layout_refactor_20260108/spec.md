# Track Specification: Dashboard Layout Refactoring

## Overview
This track focuses on optimizing the Dashboard layout by repositioning key elements to improve space utilization and visual hierarchy. The Profile Management actions (currently scattered or in a separate card) will be consolidated into the main Header section (right side), and the Recent Activity feed will be moved to a more logical position below the System Health panel.

## Functional Requirements

### 1. Header Layout Update
- **Consolidation:** Move the "Action Buttons" (Export, Import, Save, Load, Settings, Run Scheduler) into the main dark header container.
- **Positioning:** Position these actions to the right side of the "Welcome back, Admin" text section, utilizing the available whitespace.
- **Responsiveness:** Ensure the header layout stacks gracefully on smaller screens (mobile/tablet), maintaining usability.

### 2. Recent Activity Repositioning
- **Move Component:** Move the `RecentActivity` component from its current location (right sidebar).
- **New Location:** Place `RecentActivity` vertically *below* the "System Health / Alerts Panel" within the main content grid (typically the larger left/center column).

## Non-Functional Requirements
- **Visual Consistency:** The moved elements must retain the existing styling (Tailwind CSS) and blend seamlessly with their new containers.
- **Code Maintainability:** Clean up any unused layout wrappers or empty `div`s resulting from the move.

## Acceptance Criteria
- The "Action Buttons" are visibly located in the right side of the Dashboard Header.
- The `RecentActivity` list appears immediately below the System Health panel.
- The layout remains responsive and does not break on mobile devices.
