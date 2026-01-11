# Track Specification: Unify Dashboard Controls & Enhance Dashboard

## Overview
This track aims to declutter the Dashboard interface by unifying redundant profile management controls (Create, Save, Load, Import, Export) into a single, cohesive set of actions located within the main content area. Additionally, it will enhance the dashboard's utility by adding missing features such as recent activity tracking, quick statistics, and system status indicators.

## Functional Requirements

### 1. Unification of Profile Controls
- **Consolidation:** Remove duplicate "Create Profile", "Save Profile", "Load Profile", "Import", and "Export" buttons from the Dashboard Header and other redundant locations.
- **Primary Location:** Implement a single, unified set of these controls within the main content area of the `DashboardView`.
- **Exclusion:** The "Save to Device" button in the main navigation bar must remain untouched.

### 2. Dashboard Enhancements
- **Quick Stats:** Add a "Quick Stats" section to the dashboard displaying:
    - Total number of Teachers.
    - Total number of Classes.
    - Total number of Subjects.
    - Current number of Conflicts (if available).
- **Recent Activity:** Implement a "Recent Activity" section that lists the last 3-5 actions or modified profiles (mocked if backend support is pending, but designed for integration).
- **System Status:** Add visual indicators for:
    - Auto-save status (e.g., "Saved", "Saving...", "Unsaved changes").
    - Scheduler status (e.g., "Idle", "Generating...").

## Non-Functional Requirements
- **UX/UI:** The new controls and sections must adhere to the existing design system (Tailwind CSS) and responsiveness guidelines.
- **Maintainability:** Code refactoring should reduce duplication and improve component reusability.

## Acceptance Criteria
- All duplicate profile management buttons are removed from the header.
- A functional, unified control panel for profile actions exists in the `DashboardView` content area.
- The "Save to Device" button in the navigation bar is preserved.
- The dashboard displays accurate counts for Teachers, Classes, and Subjects.
- A placeholder or functional "Recent Activity" list is visible.
- System status indicators are present and update based on state (mocked or real).
