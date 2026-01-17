# Track Specification: room_mapping_hierarchy_20260117

## Overview
Transition the scheduling engine from dynamic room discovery to a determined room mapping hierarchy. This ensures every lesson is assigned to a specific, predictable location: either a specialized subject room (e.g., Lab) or the class's home classroom.

## Functional Requirements
- **Data Model Updates:**
    - Update `Subject` type to include optional `requiredRoomId`.
    - Update `ClassGroup` type to include mandatory `defaultRoomId`.
- **Solver Logic (`determineRoom`):**
    - Implement hierarchy: `Subject.requiredRoomId` > `ClassGroup.defaultRoomId`.
    - Room occupancy check must block allocation if the target room is busy.
- **Heuristic Engine:**
    - Increase priority (MRV) for subjects requiring specific rooms to ensure they are scheduled while bottleneck resources (Labs) are available.
- **UI Integration:**
    - Add room selection dropdown to the Class Editor modal (`defaultRoomId`).
    - Add room selection dropdown to the Subject Editor modal (`requiredRoomId`).
- **Validation:**
    - Prevent scheduling units that cannot resolve a room.

## Non-Functional Requirements
- **Performance:** Ensure room occupancy checks in the solver remain high-performance during backtracking.
- **Predictability:** The solver must never assign a room outside of the defined hierarchy.

## Acceptance Criteria
- [ ] The solver successfully schedules lessons in their designated home rooms by default.
- [ ] Specialized subjects (e.g., ICT) are correctly prioritized and assigned to their required rooms.
- [ ] No two lessons are ever scheduled in the same room at the same time.
- [ ] Users can manage room assignments via the UI modals.

## Out of Scope
- Automated migration of existing data (users will need to assign rooms to existing classes/subjects).
- Support for multiple required rooms per subject.
