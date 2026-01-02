# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 4.0 (Advanced Resource Logic)
**Last Updated:** January 2, 2026
**Framework:** React 18 + Vite + TypeScript

---

## 1. Executive Summary

**EduScheduler Pro** is a high-performance, client-side resource scheduling application designed for educational institutions. It solves the complex constraint satisfaction problem (CSP) of school timetabling using a **constructive heuristic algorithm** running in a dedicated Web Worker.

The architecture emphasizes:
1.  **Zero-Backend:** Full functionality offline via LocalStorage and File System Access (JSON).
2.  **Type Safety:** Strict TypeScript interfaces acting as the single source of truth.
3.  **Performance:** Heavy computational tasks (scheduling) offloaded to background threads.
4.  **Immutability:** Centralized state management with functional update patterns.

---

## 2. Technology Stack

| Category | Technology | Reasoning |
| :--- | :--- | :--- |
| **Runtime** | Vite (Rollup) | Instant HMR, optimized production builds, ES modules. |
| **Framework** | React 18.2 | Concurrent rendering features, efficient DOM reconciliation. |
| **Language** | TypeScript 5+ | Strict typing prevents 90% of runtime errors in complex data models. |
| **Styling** | Tailwind CSS 3.4 | Utility-first, consistently designed UI system with minimal CSS bundle size. |
| **Icons** | Lucide React | Consistent, lightweight SVG icons. |
| **Persistence** | LocalStorage + File API | Privacy-first, local-only data ownership. |
| **Export** | ExcelJS | Native `.xlsx` generation for administrative use. |
| **Printing** | react-to-print | High-fidelity browser-based PDF generation. |

---

## 3. Directory Structure & Domain Logic

The codebase is organized by **features** rather than technical layers, keeping related logic (UI, hooks, types) collocated.

```text
src/
├── App.tsx                     # 👑 Root Orchestrator: Manages Profiles, Persistence, and Routing.
├── main.tsx                    # Entry point (Tailwind import, ReactDOM mount).
├── types/
│   └── index.ts                # 📜 THE CONTRACT. All core interfaces (AppData, ScheduleSlot, etc.).
│
├── services/
│   ├── scheduler/              # 🧠 The Brain (Optimization Engine)
│   │   ├── worker.ts           # Web Worker entry point (runs in separate thread).
│   │   ├── solver.ts           # Core greedy algorithm with "Gang Scheduling" support.
│   │   ├── heuristics.ts       # Scoring functions (weighted constraints & workload balance).
│   │   ├── preparation.ts      # Data transformation (State -> AllocationUnits).
│   │   └── validation.ts       # Constraint checking (Teacher overlaps, Room double-booking).
│   │
│   └── fileSystem.ts           # I/O Service (Save/Load JSON, sanitization, legacy migration).
│
├── features/
│   ├── dashboard/              # Landing view, health metrics, quick actions.
│   ├── configuration/          # Global settings (Periods, Times, School Info).
│   ├── subjects/               # Resource definitions (Subjects, Room Requirements).
│   ├── teachers/               # Faculty management (Skills, Workload, Availability).
│   ├── rooms/                  # Physical Resource management.
│   ├── classes/                # Student Group management (Curriculum, Custom Structures).
│   ├── exams/                  # Assessment scheduling (NEW).
│   ├── duty/                   # Supervision management (NEW).
│   │
│   └── generator/              # ⚡ The Powerhouse
│       ├── GeneratorView.tsx   # Main UI for running the solver.
│       ├── components/
│       │   ├── ScheduleGrid.tsx # Interactive timeline (Respects class-specific structures).
│       │   └── DraggableSlot.tsx # The atomic lesson card.
│       └── hooks/              # Complex UI logic (DnD state, worker communication).
│
├── components/                 # Shared "Dumb" UI Components
│   ├── layout/                 # Sidebar, Header.
│   └── ui/                     # Button, Card, Input, Modal, Badge (Atomic Design).
│
└── utils/
    ├── constants.ts            # Configuration defaults, Color palettes.
    └── utils.ts                # Helpers: ID generation, Deep cloning, Sanitization.
```

---

## 4. Core Data Architecture

The application state is monolithic but compartmentalized within the `AppData` interface. This ensures simplified serialization/deserialization for save/load operations.

### 4.1. The Data Tree (`AppData`)

```typescript
interface AppData {
  settings: Settings;       // Global rules (Period definitions, Breaks, Times)
  subjects: Subject[];      // What is taught + Room Requirements
  teachers: Teacher[];      // Who teaches + Constraints + Target Load
  rooms: Room[];            // Physical spaces (NEW in v4.0)
  classes: ClassGroup[];    // Who learns + Curriculum + Custom Structure
  jointClasses: JointClass[]; // Horizontal linking
  electives: ElectiveBlock[]; // Vertical blocking (Option lines)
  exams: ExamSession[];     // Academic assessments
  dutyLocations: DutyLocation[]; // Supervision spots
  dutyAssignments: DutyAssignment[]; // Teacher supervision roster
  schedule: ScheduleResult; // The solution: Map<ClassId, Day, Period, Slot>
  conflicts: Conflict[];    // Unsolved problems: List of unplaced lessons
  lastGenerated: string;    // Timestamp of last solver run
}
```

### 4.2. The Schedule Matrix (`ScheduleResult`)

The schedule is stored as a nested hash map for O(1) lookups during rendering and collision detection.

```typescript
// Structure:
// schedule[ClassID][DayIndex][PeriodIndex] = Slot

type ScheduleResult = Record<string, Record<number, Record<number, ScheduleSlot>>>;

interface ScheduleSlot {
  subjectId: string;
  teacherId: string;
  classId: string;
  roomId?: string;         // Explicit Room assignment
  electiveBlockId?: string; // Links units scheduled simultaneously
  isFixed?: boolean;       // True if this is the 2nd half of a double period
  locked?: boolean;        // User-invoked lock
}
```

---

## 5. The Scheduler Engine (Architecture Deep Dive)

The scheduler is not a generic CSP solver but a **domain-specific constructive heuristic solver**.

### 5.1. Threading Model
- **Main Thread:** Handles UI, React updates, and Drag & Drop interactions.
- **Worker Thread (`worker.ts`):** Runs the heavy `generateSchedule` loop. This prevents UI freezing even during 10,000+ iteration runs.

### 5.2. The Algorithm Pipeline

1.  **Ingestion:** The worker receives a copy of `AppData`.
2.  **Transformation (`preparation.ts`):** 
    - Converts abstract `Curriculum` into concrete `AllocationUnit` objects.
    - **Sorting/Prioritization:** Harder-to-place units are sorted first (Joint Classes > Double periods > Constrained Teachers > Room-specific subjects).
3.  **Solver Loop (`solver.ts`):**
    - Iterates through `AllocationUnits`.
    - **Gang Scheduling:** Detects units belonging to `ElectiveBlocks` and schedules them simultaneously.
    - **Structure Awareness:** Prioritizes Class-specific structure overrides (Breaks/Lunch) over Global settings.
    - **Validation:** Checks 10+ constraints (Teacher avail, Class avail, Single Resource, Room Availability, Fatigue Limit, Daily Subject Limit, Sandwich Prevention).
    - **Scoring (`heuristics.ts`):** Picks the "best" slot based on weights (Core morning bias, Teacher continuity, Workload balancing).
4.  **Output:** Returns a new `schedule` object and a list of `conflicts`.

---

## 6. Engineering Standards

### 6.1. State Management Rules
1.  **Top-Down Data Flow:** `App.tsx` holds the state. It passes `data` and `onUpdate` down to views.
2.  **Immutable Updates:** Never mutate `AppData` directly.

### 6.2. Component Design
- **Structure Overrides:** Components like `ScheduleGrid` must use `useMemo` to select the correct timetable structure (Class vs Global) for rendering.
- **Memoization:** Use `React.memo` for grid cells and `useMemo` for heavy derived statistics.

### 6.3. File System & Sanitization
- Input data from JSON files is **never trusted**.
- It passes through `sanitizeAppData` which ensures all mandatory arrays (rooms, electives, etc.) exist.

---

## 7. Operational Workflows

### 7.1. Adding a New Constraint
1.  **Define:** Add the property to `types/index.ts`.
2.  **Input:** Add the UI control in the relevant View.
3.  **Logic:** Add a check in `src/services/scheduler/solver.ts` inside the slot validation loop.
4.  **Validation:** Ensure `checkSlotValidity` in `schedulerValidation.ts` and `useDragAndDrop.ts` also respect this constraint.

---

## 8. Known Limitations (As of v4.0)

1.  **Mobile Support:** The `ScheduleGrid` is optimized for Desktop.
2.  **Multi-Week Schedules:** Currently supports a standard 5-day repeating cycle only.
3.  **Undo/Redo:** Not implemented natively. Relies on manual "Save Profile" checkpoints.

---