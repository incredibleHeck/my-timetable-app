# Implementation Plan: Refactor and Fix Configuration View

This plan covers the modular refactoring of the `GlobalConfigView.tsx` component and the implementation of requested layout changes for the schedule chain, rules section, and reservations grid.

## Phase 1: Modular Refactoring
Extract the monolithic JSX in `GlobalConfigView.tsx` into smaller, reusable components to improve maintainability and prepare for layout adjustments.

- [x] **Task: Create component directory and initial extraction**
    - [x] Create `src/features/configuration/components/` directory.
    - [x] Create `SchoolIdentitySection.tsx` and move the school name/academic year logic.
- [x] **Task: Extract Timeline and Rules**
    - [x] Create `TimelineAutomationSection.tsx` for the "Smart Timeline" controls.
    - [x] Create `RulesSection.tsx` (formerly RulesSidebar) and prepare it for full-width layout.
- [x] **Task: Extract Interactive Elements**
    - [x] Create `ScheduleChainSection.tsx` for the CLASS/BREAK/LUNCH interactive cards.
    - [x] Create `ReservationsGridSection.tsx` for the "Global Reservations" grid.
    - [x] Create `SlotEditModal.tsx` for the reserved slot configuration modal.
- [x] **Task: Update Main Orchestrator**
    - [x] Refactor `GlobalConfigView.tsx` to use the new components, passing necessary props from the `useGlobalConfig` hook.
- [ ] **Task: Conductor - User Manual Verification 'Modular Refactoring' (Protocol in workflow.md)**

## Phase 2: Layout Fixes and UI Improvements
Apply the specific design changes to the newly created components.

- [x] **Task: Implement Horizontal Schedule Chain**
    - [x] Update `ScheduleChainSection.tsx` styling to display cards in a horizontal, wrap-around row instead of a vertical stack.
    - [x] Ensure the section is positioned directly below the periods slider in `GlobalConfigView.tsx`.
- [x] **Task: Update Rules Layout**
    - [x] Modify `RulesSection.tsx` to use a full-width grid layout instead of the current sidebar structure.
    - [x] Reposition below the schedule chain.
- [x] **Task: Fix Reservations Grid**
    - [x] Audit the CSS grid logic in `ReservationsGridSection.tsx`.
    - [x] Ensure headers (P1, P2...) and day rows are perfectly aligned regardless of the total period count.
    - [x] Add a visual "scroll-hint" or ensure smooth horizontal scrolling for small screens.
- [ ] **Task: Conductor - User Manual Verification 'Layout Fixes' (Protocol in workflow.md)**

## Phase 3: Final Integration and Quality Gate
Final checks and verification.

- [x] **Task: Verification and Bug Fixing**
    - [x] Verify that all "Smart Timeline" calculations still work correctly after refactoring.
    - [x] Ensure "Apply to all days" in the reservation modal works as expected.
    - [x] Check responsive behavior on mobile/tablet views.
- [x] **Task: Conductor - User Manual Verification 'Final Integration' (Protocol in workflow.md)**
