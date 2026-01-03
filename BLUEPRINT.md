# EduScheduler Pro — System Blueprint & Specifications

**Status:** Production Ready (Version 5.2)
**Target:** Robust, school-wide resource & assessment management.

---

## 1. Functional Blueprint

### 1.1. Resource Management
- **Subjects:** Define "Examinable" status, identifier colors, and paper counts.
- **Teachers:** Manage availability matrix, workload targets, and specialty subjects.
- **Classes:** Define unique curriculum and "Streams" (Levels) for automatic synchronization.

### 1.2. Exam Management Module (Master Table Grid)
- **Session-Based Layout:** Grid displays **Days as Rows** and **Sessions as Columns**.
- **Intra-Column Split:** Supports subjects with multiple papers (P1 on Left, P2 on Right) within a single column boundary.
- **Multi-Stream Synchronization:** Automatic propagation of split/swap modifications across parallel classes in the same level.
- **Master Roster:** A specialized **Class vs. Date** view for high-level staffing overviews.

### 1.3. Automated Invigilator Allocation
- **Min/Max Roster Rules:** Define a staffing range (e.g. 2-4 teachers) per room.
- **Workload Fairness:** Randomized distribution prioritized by "least busy" faculty members.
- **Strict Availability:** Automated cross-check against teacher constraints and overlapping exam sessions.

---

## 2. Roadmap

### 2.1. Phase 3: School-Wide Operations (Completed)
- [x] **Exam Timetable:** Chronological grid with multi-session support.
- [x] **Duty Roster:** Supervision management for non-teaching periods.
- [x] **Workload Analysis:** Capacity planning and usage reporting.
- [x] **Multi-Stream Sync:** Logic to keep parallel class groups aligned.

### 2.2. Phase 4: Interaction & Polish (Completed)
- [x] **Advanced Sensors:** Activation constraints for high-precision DND.
- [x] **Anchored Swapping:** Decoupling subjects from staff during grid moves.
- [x] **Internal Splitting:** Intra-cell UI for multi-paper exams.

### 2.3. Phase 5: Future Enterprise (Planned)
- [ ] **Multi-Week Cycles:** Support for A/B week rotation.
- [ ] **Native Undo/Redo:** Versioning stack in local state.
- [ ] **Cloud Sync:** Optional backend integration for cross-device access.

---

## 3. Engineering Standards

### State Commitment Rules
1.  **Forking:** Updates to a subset of classes in a shared exam must trigger a record fork (New ID for target group, filter original).
2.  **Immutability:** All state updates use `onUpdate` with deep-copied data snapshots.
3.  **Synchronization:** Modifications to one stream member must query and update all siblings sharing the same `level` attribute.

---

**Blueprint Version:** 5.2  
**Ref:** `ARCHITECTURE.md` for technical implementation details.
