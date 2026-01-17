# Specification: Automatic Unique Home Room Assignment

## Overview
This track addresses a bug where subjects without assigned rooms disappear and implements a "Unique Home Room" system. Every Class Group will be automatically linked to its own unique "Home Room". The system will use this Home Room as a fallback for any subject that does not have its own specific room assignment.

## Functional Requirements

### 1. Data Model & Logic
- **Unique Mapping:** Ensure every `ClassGroup` is associated with a unique `defaultRoomId`.
- **Automatic Assignment:** When a class is created (or during a data stabilization phase), the system will automatically assign it a unique room if one isn't already set.
- **Fallback Hierarchy:** Update the scheduling engine and UI rendering to resolve rooms as follows:
    1. `Subject.AssignedRoom` (if defined)
    2. `ClassGroup.defaultRoomId` (fallback)

### 2. User Interface Updates
- **Class Management View:** Display the automatically assigned Home Room in the Classes table.
- **Schedule Grid:** Ensure all lessons appear in their Class's Home Room if no specific subject room is set.

### 3. Conflict Detection
- **Room Conflict Detector:** Update to consider the fallback `defaultRoomId`. Since each class has a *unique* Home Room, room overlaps between different classes using their defaults are naturally avoided, but the system must still check for overlaps between fallback lessons and lessons with explicit room assignments (e.g., if a class's Home Room is "Room 1", but an ICT lesson from another class is explicitly assigned to "Room 1").

## Acceptance Criteria
- [ ] Every class has a unique Home Room assigned by default.
- [ ] Lessons with no specific room assigned are visible in the Schedule Grid in their Class's Home Room.
- [ ] The system detects room conflicts if an explicitly assigned room overlaps with a class's fallback Home Room usage.
- [ ] No manual user assignment of Home Rooms is required.

## Out of Scope
- Automated room optimization.
- Support for multiple Home Rooms per class.
