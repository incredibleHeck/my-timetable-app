# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 5.5 (Enterprise Assessment & Sync Edition)
**Last Updated:** January 3, 2026
**Framework:** React 18 + Vite + TypeScript

---

## 1. Executive Summary

**EduScheduler Pro** is a high-performance, client-side resource scheduling application. It handles the complex coordination of school timetables and examination periods using specialized heuristic engines.

The architecture emphasizes:
1.  **Zero-Backend:** Local-first data ownership via File System Access and LocalStorage.
2.  **Concurrency:** Background Web Workers for the class timetable solver.
3.  **Synchronized State:** Logic-driven propagation of changes across parallel class streams.
4.  **Resource Anchoring:** Separating "What" (Subjects) from "Who" (Invigilators) during rescheduling to maintain staffing consistency.

---

## 2. Directory Structure

```text
src/
├── App.tsx                     # 👑 Root: State orchestration & full-screen view management.
├── types/                      # Single source of truth for domain interfaces.
│
├── features/                   # Feature-Encapsulated Domains
│   ├── generator/              # ⚡ Timetable Solver (Heuristics + Web Worker).
│   ├── exams/                  # 📝 Exam Coordination Suite.
│   │   ├── components/         # Master Table Grid, Roster, & Exclusion Modals.
│   │   ├── logic/              # 🧠 Allocation algorithms & Stream-Sync engines.
│   │   └── hooks/              # CRUD & DND state management (Forking logic).
│   ├── duty/                   # 🛡️ Supervision Roster.
│   └── workload/               # 📊 Faculty Capacity Analysis.
│
├── services/                   # Cross-cutting concerns (File IO, Export).
│   └── export/                 # 📄 Excel/PDF Engine (Context-aware).
├── components/ui/              # Atomic Design System components.
└── utils/                      # ID generation and math helpers.
```

---

## 3. Core Data Architecture

### 3.1. Entity Relationships

```typescript
interface ExamSession {
  id: string;
  subjectId: string;
  classIds: string[];       // Support for multi-stream synchronization
  date: string;
  startTime: string;        // Sequence determines Subject 1/2 column placement
  duration: number;         // Exported as "Xh XXm"
  invigilatorIds?: string[]; // Staff assigned to the slot
  paperNumber: number;      // Supports intra-column horizontal splitting
  status: ExamStatus;
  locked: boolean;          // Prevents auto-allocator from overwriting
}
```

---

## 4. Specialized Scheduling Engines

### 4.1. The Invigilator Allocator (Enhanced)
- **One Stream Per Week Rule:** Maintains a `teacherWeeklyStreams` set. Teachers cannot be assigned to the same class level (stream) more than once in an exam week to ensure variety and fairness.
- **Availability Management:** Integrated `InvigilatorExclusionModal` allows manual removal of staff from the candidate pool before generation.
- **Team-per-Day Logic:** Ensures consistency in staffing while respecting availability constraints.

### 4.2. Multi-Stream Sync Engine (Refined)
- **Smart Stream Grouping:** Uses regex-based parsing to identify parallel cohorts (e.g., "1A" and "1B" are grouped as Level "1").
- **Subject Integrity:** Swapping a subject on the grid automatically synchronizes all parallel streams.
- **Paired Swap Logic:** During swaps, specific resources (Rooms/Staff) are preserved for each individual stream to prevent resource collapsing.

---

## 5. Interaction & Presentation

### 5.1. Sequential Grid Layout
- **Time-Decoupled Columns:** The grid uses **Subject 1** and **Subject 2** columns. Placement is determined by the sequence of subjects on a day, not a rigid time cutoff.
- **Intra-Column Split:** Multi-paper subjects (P1, P2) are rendered side-by-side within a single subject column to maximize space.
- **Contextual UI:** Redundant class labels are automatically hidden when a specific class filter is active in the sidebar.

---

## 6. Export Systems

### 6.1. Professional Document Generator
- **Context-Aware Exports:** Buttons detect `viewMode`. Grid view exports student-ready timetables; Roster view exports staff-ready master sheets.
- **Print Optimization:** Student copies are optimized for **A4 Portrait** (No staff names, fit-to-page). Staff rosters are optimized for **A3 Landscape** (Stacked names, full detail).
- **Security:** Invigilator names are strictly omitted from student-facing exports to maintain assessment confidentiality.
