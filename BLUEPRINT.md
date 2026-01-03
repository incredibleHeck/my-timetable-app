# EduScheduler Pro — System Blueprint & Specifications

**Status:** Production Ready (Version 5.1)
**Target:** Robust, school-wide resource & assessment management.

---

## 1. System Context Diagram

```mermaid
graph TD
    User((User))
    Browser[Web Browser / Tauri Shell]
    
            subgraph "EduScheduler Pro (Client-Side)"
                App[App Orchestrator]
                Store[FileService (Web/Tauri)]
                
                subgraph "UI Layer (React)"
                    Dash[Dashboard View]
                    InputViews[Data Entry]
                    GenView[Timetable Generator]
                    WorkView[Workload Analysis]
                    ExamView[Exam Module]
                    DutyView[Duty Roster]
                end
                
                subgraph "Logic Layer"
                    Solver[Constructive Heuristic Solver]
                    ExamGen[Exam Sequential Scheduler]
                    Exporter[ExcelJS Service]
                end
            end
    User --> Browser
    Browser --> App
    App --> Store
    App --> UI Layer
    
    UI Layer --> Solver
    UI Layer --> ExamGen
    UI Layer --> Exporter
    
    Solver --> App : Return Schedule
```

---

## 2. Functional Blueprint

### 2.1. Resource Management
- **Subjects:** Define examinable status, paper counts, and room requirements.
- **Teachers:** Manage availability, faculty assignments, and duty workload.
- **Classes:** Define unique curriculum and override global school structures.
- **Rooms:** Physical resource allocation.

### 2.2. Scheduling Engines
- **Class Timetable:** greedy allocation with complex constraints (fatigue, daily limits).
- **Exam Timetable:** Bulk cohort scheduling, staggered slots, rest gap calculation.
- **Duty Roster:** Smart stationing during breaks based on teaching free-time.

---

## 5. Roadmap

### 5.1. Phase 1: Foundations (Completed)
- [x] Basic Conflict Resolution.
- [x] Teacher Constraints & Double Periods.

### 5.2. Phase 2: Advanced Resources & Logic (Completed)
- [x] **Room Management:** Physical space allocation.
- [x] **Elective Blocks:** Horizontal/Vertical "Gang Scheduling".
- [x] **Structure Overrides:** Class-specific break/lunch times.
- [x] **Faculty Quick-Add:** Dynamic creation from faculty cards.

### 5.3. Phase 3: School-Wide Operations (Completed)
- [x] **Exam Timetable:** Cohort-synced assessment scheduler.
- [x] **Duty Roster:** Supervision management for non-teaching periods.
- [x] **Interactive Dashboard:** specific diagnostics and navigation shortcuts.
- [x] **Workload Analysis:** Faculty utilization reporting and capacity planning.

### 5.4. Phase 4: Enterprise & Polish (Planned)
- [ ] **Multi-Week Cycles:** Support for A/B week schedules.
- [ ] **Native Undo/Redo:** Versioning stack in local state.
- [ ] **Cloud Sync:** Optional backend integration for cross-device access.

---

## 6. Implementation Guide (For Developers)

### Adding a New Constraint
1.  **Data Layer:** Add the property to `types/index.ts`.
2.  **UI Layer:** Add the toggle/input in the specific Feature View.
3.  **Solver Layer:** 
    - Go to `src/services/scheduler/solver.ts`.
    - Locate the `// Constraints Check` block inside the nested loop.
    - Add `if (myNewConstraintViolated) continue;`.
4.  **Validation Layer:** Mirror the logic in `src/utils/schedulerValidation.ts` for the UI feedback.

### Modifying the Grid
- The Grid uses CSS Grid Layout.
- **Column Definition:** `minmax(120px, 1fr)` ensures responsiveness but enforces readability.
- **Scroll Handling:** The outer container handles X-scroll. Inner container handles Y-scroll only if needed, but currently page scroll is preferred.

---

**Blueprint Version:** 1.0  
**Author:** System Architect  
**Ref:** `ARCHITECTURE.md` for technical implementation details.
