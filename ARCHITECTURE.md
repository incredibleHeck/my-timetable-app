# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 5.1 (Full School Management Suite)
**Last Updated:** January 3, 2026
**Framework:** React 18 + Vite + TypeScript

---

## 1. Executive Summary

**EduScheduler Pro** is a high-performance, client-side resource scheduling application designed for educational institutions. It solves the complex constraint satisfaction problem (CSP) of school timetabling and exam coordination using a **constructive heuristic algorithm** running in a dedicated Web Worker.

The architecture emphasizes:
1.  **Zero-Backend:** Full functionality offline via LocalStorage and File System Access (JSON).
2.  **Type Safety:** Strict TypeScript interfaces acting as the single source of truth.
3.  **Performance:** Heavy computational tasks (scheduling) offloaded to background threads.
4.  **Feature-First Design:** Domain logic is encapsulated within feature modules for high cohesion.

---

## 2. Technology Stack

| Category | Technology | Reasoning |
| :--- | :--- | :--- |
| **Runtime** | Vite (Rollup) | Instant HMR, optimized production builds, ES modules. |
| **Framework** | React 18.2 | Concurrent rendering features, efficient DOM reconciliation. |
| **Language** | TypeScript 5+ | Strict typing for complex resource relationship models. |
| **Styling** | Tailwind CSS 3.4 | Utility-first UI system with consistent design tokens. |
| **Persistence** | LocalStorage + File API | Local-only data ownership. `FileService` abstracts Web (Blob) vs Desktop (Tauri FS). |
| **Export** | ExcelJS | Professional `.xlsx` generation for administrative use. |

---

## 3. Directory Structure

The project follows a **Feature-Driven** architecture.

```text
src/
├── App.tsx                     # 👑 Root: Orchestrates state, profiles, and routing.
├── main.tsx                    # Entry point.
├── types/                      # Domain interfaces and shared types.
│
├── features/                   # Encapsulated Business Domains
│   ├── dashboard/              # Landing view, health metrics, quick actions.
│   ├── configuration/          # Global school rules (Periods, Structure).
│   ├── subjects/               # Subject library and room requirements.
│   ├── teachers/               # Faculty directory and availability.
│   ├── classes/                # Student groups and curriculum.
│   ├── rooms/                  # Physical resource management.
│   ├── generator/              # ⚡ Timetable Auto-Solver & Interactive Grid.
│   ├── exams/                  # 📝 Exam Timetable & Bulk Scheduler.
│   ├── duty/                   # 🛡️ Break/Lunch Supervision Roster.
│   └── workload/               # 📊 Faculty Capacity & Utilization Analysis.
│
├── services/                   # Business Logic & Singletons
│   ├── scheduler/              # Heuristic engine (Solver, Preparation, Types).
│   ├── export/                 # Excel and PDF generation services.
│   └── fileSystem/             # Persistence and I/O handlers.
│
├── components/                 # Atomic UI Components
│   ├── layout/                 # Sidebar, Header, Page Shells.
│   └── ui/                     # Buttons, Modals, Inputs (Generic).
│
└── utils/                      # Low-level helpers and constants.
```

---

## 4. Core Data Architecture (`AppData`)

The application state is managed as a single immutable tree, allowing for easy serialization and reliable persistence.

### 4.1. Entity Relationships

```typescript
interface AppData {
  settings: Settings;       // Global rules & structure
  subjects: Subject[];      // Exam paper counts, durations, room requirements
  teachers: Teacher[];      // Blocked periods, target load
  rooms: Room[];            // Capacity and type (Lab, Classroom, etc.)
  classes: ClassGroup[];    // Curriculum items, custom structure overrides
  jointClasses: JointClass[]; // Merged classes for specific subjects
  electives: ElectiveBlock[]; // Parallel option blocks
  exams: ExamSession[];     // Sequential or staggered assessments
  dutyLocations: DutyLocation[]; // Supervision zones (Playground, Hall, etc.)
  dutyAssignments: DutyAssignment[];  // Supervision during break/lunch periods
  schedule: ScheduleResult; // The generated 5-day cycle timetable
}
```

---

## 5. The Scheduling Engines

### 5.1. Class Timetable Solver
- **Mode:** Constructive heuristic.
- **Backbackground Thread:** Dedicated Web Worker prevents UI blockage.
- **Constraints:** Teacher fatigue, subject daily limits (max 2), room collision, elective "Gang Scheduling", sandwich/gap prevention.

### 5.2. Exam Auto-Scheduler
- **Mode:** Sequential placement with conflict lookahead.
- **Logic:** Groups class cohorts together for school-wide subjects. Handles rest gaps between papers and skips weekends automatically.

---

## 6. Engineering Standards

### 6.1. State Management Rules
1.  **Top-Down Data Flow:** `App.tsx` holds the state. It passes `data` and `onUpdate` down to views.
2.  **Immutable Updates:** Never mutate `AppData` directly.

### 6.2. Component Design
- **Structure Overrides:** Components like `ScheduleGrid` and `schedulerValidation` must select the correct timetable structure (Class-specific vs Global) based on context.
- **Memoization:** Rigorous use of `React.memo` and `useMemo` for performance in large grids.

### 6.3. File System & Persistence
- JSON project files include a sanitized snapshot of the entire `AppData`.
- Automatic migration logic in `utils.ts` ensures legacy files remain compatible with new schema versions.

---

## 7. Known Limitations (As of v5.0)

1.  **Mobile Optimization:** Complex grid views (Timetable, Duty Roster) require a Desktop viewport for full functionality.
2.  **Historical Records:** System focuses on the current active schedule; archiving requires manual profile saving.

---