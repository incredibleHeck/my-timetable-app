# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 5.2 (Enterprise Assessment & Sync Edition)
**Last Updated:** January 3, 2026
**Framework:** React 18 + Vite + TypeScript

---

## 1. Executive Summary

**EduScheduler Pro** is a high-performance, client-side resource scheduling application. It handles the complex coordination of school timetables and examination periods using specialized heuristic engines.

The architecture emphasizes:
1.  **Zero-Backend:** Local-first data ownership via File System Access and LocalStorage.
2.  **Concurrency:** Background Web Workers for the class timetable solver.
3.  **Synchronized State:** Logic-driven propagation of changes across parallel class streams.
4.  **Decoupled Resource Management:** Separating "What" (Subjects) from "Where/Who" (Rooms/Staff) during rescheduling.

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
│   │   ├── components/         # Master Table Grid & Master Roster.
│   │   ├── logic/              # 🧠 Allocation algorithms & Stream-Sync engines.
│   │   └── hooks/              # CRUD & DND state management (Forking logic).
│   ├── duty/                   # 🛡️ Supervision Roster.
│   └── workload/               # 📊 Faculty Capacity Analysis.
│
├── services/                   # Cross-cutting concerns (File IO, Export).
├── components/ui/              # Atomic Design System components.
└── utils/                      # ID generation and math helpers.
```

---

## 3. Core Data Architecture

### 3.1. Entity Relationships (Updated)

```typescript
interface ExamSession {
  id: string;
  subjectId: string;
  classIds: string[];       // Support for multi-stream or single-class sessions
  date: string;
  startTime: string;
  duration: number;
  roomId?: string;
  invigilatorIds?: string[]; // Multi-invigilator support per session
  paperNumber: number;      // Supports P1/P2 horizontal splitting in UI
  locked: boolean;          // Prevents auto-allocator from overwriting
}
```

---

## 4. Specialized Scheduling Engines

### 4.1. The Invigilator Allocator
- **Team-per-Day Logic:** Groups sessions by date/class to ensure a consistent teacher team supervises a class for all exams in a single day.
- **Fairness Heuristic:** Uses a Fisher-Yates shuffle combined with a workload counter to distribute assignments randomly among the "least busy" available staff.
- **Availability Check:** Strictly respects the `Teacher.constraints` matrix (Blocked Periods) across all sessions in a class's daily schedule.

### 4.2. Multi-Stream Sync Engine
- **Stream Detection:** Automatically identifies sibling classes (same `level`) during updates.
- **Forking Mechanism:** When a shared exam is modified for only one stream, the engine "forks" the record—splitting the original and creating a new unique session for the target stream to prevent global overwrites.

---

## 5. Interaction Design

### 5.1. Decoupled Drag-and-Drop
- **Pointer Sensors:** Activation constraints (distance-based) allow for a high-precision feel, distinguishing between "Click to Edit" and "Drag to Reschedule."
- **Anchor Swapping:** Swapping two subjects on the grid exchanges the *Subject Content* but keeps the *Slot Context* (Invigilators, Room, Time) fixed to the grid position.

---