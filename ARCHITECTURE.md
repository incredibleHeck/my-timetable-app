# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 3.0 (Worker-Optimized)
**Last Updated:** January 1, 2026
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
│   │   ├── solver.ts           # Core greedy algorithm with backtracking capabilities.
│   │   ├── heuristics.ts       # Scoring functions (weighted constraints).
│   │   ├── preparation.ts      # Data transformation (State -> AllocationUnits).
│   │   └── validation.ts       # Constraint checking (Teacher overlaps, Room double-booking).
│   │
│   └── fileSystem.ts           # I/O Service (Save/Load JSON, sanitization, legacy migration).
│
├── features/
│   ├── dashboard/              # Landing view, health metrics, quick actions.
│   ├── configuration/          # Global settings (Periods, Times, School Info).
│   ├── subjects/               # Resource definitions (Subjects, Rooms/SingleResources).
│   ├── teachers/               # Faculty management (Skills, Availability Constraints).
│   ├── classes/                # Student Group management (Curriculum Matrix).
│   │
│   └── generator/              # ⚡ The Powerhouse
│       ├── GeneratorView.tsx   # Main UI for running the solver.
│       ├── components/
│       │   ├── ScheduleGrid.tsx # The interactive timeline (Drag & Drop, Conflict Vis).
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
  subjects: Subject[];      // What is taught (Math, Science)
  teachers: Teacher[];      // Who teaches (Name, Specialties, Constraints)
  classes: ClassGroup[];    // Who learns (Name, Curriculum, Fixed Sessions)
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
  isFixed?: boolean; // True if this is the 2nd half of a double period
  locked?: boolean;  // User-invoked lock (prevent solver from moving this)
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
    - Converts abstract `Curriculum` (e.g., "Math: 5 periods/week") into concrete `AllocationUnit` objects (e.g., "Math Lesson 1", "Math Lesson 2").
    - **Sorting/Prioritization:** Harder-to-place units are sorted first (Double periods > Constrained Teachers > Single Resources).
3.  **Solver Loop (`solver.ts`):**
    - Iterates through `AllocationUnits`.
    - For each unit, scans the grid (`[Day, Period]`) for valid slots.
    - **Validation:** Checks 7+ constraints (Teacher avail, Class avail, Single Resource, Fatigue Limit, Spread).
    - **Scoring (`heuristics.ts`):** If multiple slots are valid, picks the "best" one based on scores (e.g., prefer mornings for Core subjects).
4.  **Output:** Returns a new `schedule` object and a list of `conflicts`.

---

## 6. Engineering Standards

### 6.1. State Management Rules
1.  **Top-Down Data Flow:** `App.tsx` holds the state. It passes `data` and `onUpdate` down to views.
2.  **Immutable Updates:** Never mutate `AppData` directly.
    ```typescript
    // ❌ BAD
    data.settings.schoolName = "New Name";

    // ✅ GOOD
    onUpdate({
      ...data,
      settings: { ...data.settings, schoolName: "New Name" }
    });
    ```

### 6.2. Component Design
- **Container/Presenter Pattern:** 
  - `*View.tsx` components act as Containers (connect to state/hooks).
  - `components/*` act as Presenters (pure UI, receive props).
- **Memoization:** Use `React.memo` for grid cells and `useMemo` for heavy derived statistics (Workload calculations).

### 6.3. File System & Sanitization
- Input data from JSON files is **never trusted**.
- It passes through `sanitizeAppData` (in `src/utils/utils.ts`) which:
  - Fills missing arrays (e.g., `electives: []`).
  - Ensures `settings` object exists.
  - Defaults missing configurations to safe values.

---

## 7. Operational Workflows

### 7.1. Adding a New Constraint
1.  **Define:** Add the boolean flag/property to `Settings` or `Teacher` in `types/index.ts`.
2.  **Input:** Add the toggle switch in the relevant View (e.g., `TeacherEditorModal.tsx`).
3.  **Logic:** Add a check in `src/services/scheduler/solver.ts` inside the slot validation loop.
4.  **Validation:** Ensure `checkSlotValidity` in `schedulerValidation.ts` also respects this constraint (for Drag & Drop feedback).

### 7.2. Creating a Release Build
1.  Run `npm run build` to generate the `dist/` folder.
2.  The build system runs `tsc` (TypeScript Compiler) first. **Zero type errors are allowed.**
3.  Assets are minified and fingerprinted by Vite.

---

## 8. Known Limitations (As of v3.0)

1.  **Mobile Support:** The `ScheduleGrid` is optimized for Desktop. Mobile views are functional but cramped.
2.  **Multi-Week Schedules:** Currently supports a standard 5-day repeating cycle only.
3.  **Undo/Redo:** Not implemented natively. Relies on manual "Save Profile" checkpoints.

---