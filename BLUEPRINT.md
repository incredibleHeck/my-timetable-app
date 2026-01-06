# EduScheduler Pro — System Blueprint & Specifications

**Status:** Production Ready (Version 10.0)
**Target:** High-capacity resource planning and assessment logistics.

---

## 1. Functional Blueprint

### 1.1. Resource Management
- **Smart Faculty:** Track specialties and complex availability constraints (e.g., "Mornings Only").
- **Room Dynamics:** Manage capacities and types (Labs, Gyms, Classrooms) with automated assignment.
- **Curriculum Control:** Configure doubles vs. singles and assign staff with specialty matching.

### 1.2. Automated Timetable Generation
- **Worker-Backed Solving:** Background heuristic solver prevents UI freezing.
- **Constraint Compliance:** Enforces fatigue guards, daily subject limits, and single-resource rules.
- **Advanced Grouping:** Handles horizontal links (Joint Classes) and vertical blocks (Electives) natively.

### 1.3. Exam Coordination Suite
- **Generation Strategies:** Choose between "Uniform" (Level-wide) and "Random" (Staggered) scheduling.
- **Invigilation Roster:** Intelligent staff allocation with cohort rotation and exclusion controls.
- **Intra-Column Split:** Optimized grid rendering for multi-paper subjects (P1/P2 side-by-side).

### 1.4. Duty & Supervision
- **Multi-Roster Support:** Maintain separate rosters for Recess, Lunch, or Special Events.
- **Fair Rotation:** Cycle-based generator ensures no staff member is unfairly burdened.
- **Interactive Swaps:** Manual override tools with staff availability validation.

---

## 2. Technical Standards

### 2.1. Reliability & Integrity
- **Sanitized Imports:** All incoming JSON data is validated against core interfaces to prevent state corruption.
- **Persistent Profiles:** Local-first architecture with auto-save and manual backup/restore.
- **Conflict Reporting:** Real-time feedback loop detailing the "Reason" and "Severity" of scheduling failures.

### 2.2. User Experience (UX)
- **Fluid Grids:** CSS Grid-powered schedules that adapt to custom period counts (4 to 15 blocks).
- **Tool-Context:** Headers and sidebars adapt to active views, providing relevant quick actions.
- **Visual Color Mapping:** High-contrast palette for distinct subject identification.

---

## 3. Roadmap & Progress

### 3.1. Completed Milestones (Phase 4 & 5)
- [x] **Web Worker Solver:** Iterative background optimization.
- [x] **Multi-Tenant Profiles:** Switchable schedule contexts.
- [x] **Advanced Duty System:** Multiple rotations and multi-week support.
- [x] **Room Allocation:** Type-based resource requirements.

### 3.2. Future Enterprise (Next Steps)
- [ ] **A/B Week Cycles:** Support for fortnightly timetable rotations.
- [ ] **Cloud Workspace:** Optional encrypted cloud sync for administrative teams.
- [ ] **Audit Logs:** Track change history within a specific profile session.

---

**Blueprint Version:** 10.0  
**Ref:** `ARCHITECTURE.md` for technical design patterns and system internals.
